import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";

const KEY_PREFIX = "dl_live_";

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async create(principal: AuthPrincipal, dto: CreateApiKeyDto) {
    const secret = randomBytes(24).toString("hex");
    const rawKey = `${KEY_PREFIX}${secret}`;
    const hashedKey = createHash("sha256").update(rawKey).digest("hex");

    const key = await this.prisma.apiKey.create({
      data: {
        organizationId: principal.organizationId,
        name: dto.name,
        role: dto.role ?? "MEMBER",
        keyPrefix: rawKey.slice(0, 12),
        hashedKey,
      },
    });

    await this.audit.record({
      organizationId: principal.organizationId,
      actorId: principal.id,
      actorType: "USER",
      action: "apikey.create",
      resourceType: "api_key",
      resourceId: key.id,
      metadata: { name: dto.name, role: key.role },
    });

    // The raw key is only ever returned here — it is not recoverable afterward.
    return {
      id: key.id,
      name: key.name,
      role: key.role,
      keyPrefix: key.keyPrefix,
      createdAt: key.createdAt,
      apiKey: rawKey,
    };
  }

  list(organizationId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        role: true,
        keyPrefix: true,
        lastUsedAt: true,
        revokedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async revoke(principal: AuthPrincipal, id: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, organizationId: principal.organizationId } });
    if (!key) throw new NotFoundException("API key not found");
    if (key.revokedAt) throw new ForbiddenException("API key already revoked");

    await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    await this.audit.record({
      organizationId: principal.organizationId,
      actorId: principal.id,
      actorType: "USER",
      action: "apikey.revoke",
      resourceType: "api_key",
      resourceId: id,
    });
    return { success: true };
  }
}
