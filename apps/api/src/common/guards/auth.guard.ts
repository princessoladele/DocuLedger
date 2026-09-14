import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { AuthPrincipal } from "../decorators/current-user.decorator";

/**
 * Unified authentication guard: accepts either a JWT access token
 * (`Authorization: Bearer <token>`, issued to logged-in dashboard users) or
 * an API key (`x-api-key: <key>`, issued to programmatic integrations).
 * Either path populates `request.principal` with a common shape so
 * downstream guards/handlers don't need to care which one was used.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers["x-api-key"] as string | undefined;
    const authHeader = request.headers["authorization"] as string | undefined;

    if (apiKey) {
      request.principal = await this.authenticateApiKey(apiKey);
      return true;
    }

    if (authHeader?.startsWith("Bearer ")) {
      request.principal = await this.authenticateJwt(authHeader.slice(7));
      return true;
    }

    throw new UnauthorizedException("Missing credentials: provide a Bearer token or x-api-key header");
  }

  private async authenticateJwt(token: string): Promise<AuthPrincipal> {
    try {
      const payload = this.jwt.verify(token, { secret: this.config.get("jwt.accessSecret") });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException("User not found or deactivated");
      }
      return {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role,
        authType: "user",
        email: user.email,
      };
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }

  private async authenticateApiKey(rawKey: string): Promise<AuthPrincipal> {
    const hashedKey = createHash("sha256").update(rawKey).digest("hex");
    const key = await this.prisma.apiKey.findUnique({ where: { hashedKey } });
    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date())) {
      throw new UnauthorizedException("Invalid or revoked API key");
    }
    this.prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    return {
      id: key.id,
      organizationId: key.organizationId,
      role: key.role,
      authType: "api_key",
    };
  }
}
