import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface RecordAuditEntryInput {
  organizationId: string;
  actorId?: string | null;
  actorType: "USER" | "API_KEY" | "SYSTEM";
  action: string;
  resourceType: string;
  resourceId?: string;
  documentId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Every mutating action in the platform (auth events, uploads, review
 * decisions, schema changes, key rotation, anchoring) is recorded here.
 * Audit rows are append-only and never updated or deleted by application
 * code, so they form a reliable trail for compliance review.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEntryInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.actorId ?? null,
        actorType: input.actorType,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        documentId: input.documentId,
        metadata: input.metadata as any,
        ipAddress: input.ipAddress,
      },
    });
  }

  async list(
    organizationId: string,
    params: { skip?: number; take?: number; resourceType?: string },
  ): Promise<any> {
    const { skip = 0, take = 50, resourceType } = params;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { organizationId, ...(resourceType ? { resourceType } : {}) },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where: { organizationId, ...(resourceType ? { resourceType } : {}) } }),
    ]);
    return { items, total, skip, take };
  }
}
