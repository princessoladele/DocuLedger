import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "org"
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string) {
    const existing = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    let slug = slugify(dto.organizationName);
    let suffix = 0;
    while (await this.prisma.organization.findUnique({ where: { slug: suffix ? `${slug}-${suffix}` : slug } })) {
      suffix += 1;
    }
    if (suffix) slug = `${slug}-${suffix}`;

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const { org, user } = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: dto.organizationName, slug } });
      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: dto.email,
          name: dto.name,
          passwordHash,
          role: "OWNER",
        },
      });
      return { org, user };
    });

    await this.audit.record({
      organizationId: org.id,
      actorId: user.id,
      actorType: "USER",
      action: "auth.register",
      resourceType: "organization",
      resourceId: org.id,
      ipAddress,
    });

    const tokens = await this.issueTokens(user.id, user.organizationId, user.role, ipAddress);
    return { user: this.sanitizeUser(user), organization: org, ...tokens };
  }

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      actorType: "USER",
      action: "auth.login",
      resourceType: "user",
      resourceId: user.id,
      ipAddress,
    });

    const tokens = await this.issueTokens(user.id, user.organizationId, user.role, ipAddress);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string, ipAddress?: string): Promise<TokenPair> {
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(refreshToken, { secret: this.config.get("jwt.refreshSecret") });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token has been revoked or expired");
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("User not found or deactivated");
    }

    // Rotate: revoke the presented token and issue a brand new pair. This
    // limits the blast radius if a refresh token is ever leaked.
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    return this.issueTokens(user.id, user.organizationId, user.role, ipAddress);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    await this.prisma.refreshToken
      .updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  private async issueTokens(
    userId: string,
    organizationId: string,
    role: string,
    ipAddress?: string,
  ): Promise<TokenPair> {
    const accessTtl = this.config.get<string>("jwt.accessTtl")!;
    const accessToken = this.jwt.sign(
      { sub: userId, organizationId, role },
      { secret: this.config.get("jwt.accessSecret"), expiresIn: accessTtl },
    );

    const refreshTtlDays = this.config.get<number>("jwt.refreshTtlDays")!;
    const refreshToken = this.jwt.sign(
      { sub: userId, jti: randomBytes(16).toString("hex") },
      { secret: this.config.get("jwt.refreshSecret"), expiresIn: `${refreshTtlDays}d` },
    );

    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
        ipAddress,
      },
    });

    return { accessToken, refreshToken, expiresIn: this.parseTtlSeconds(accessTtl) };
  }

  private parseTtlSeconds(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const [, value, unit] = match;
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return Number(value) * multipliers[unit];
  }

  private sanitizeUser(user: { passwordHash: string; [key: string]: unknown }) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
