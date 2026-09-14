import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { CreateSchemaDto } from "./dto/create-schema.dto";

@Injectable()
export class SchemasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** Built-ins (organizationId = null) plus this org's own custom schemas. */
  list(organizationId: string, industry?: string): Promise<any> {
    return this.prisma.documentSchema.findMany({
      where: {
        isActive: true,
        OR: [{ organizationId: null }, { organizationId }],
        ...(industry ? { industry: industry as any } : {}),
      },
      orderBy: [{ industry: "asc" }, { name: "asc" }],
    });
  }

  async get(organizationId: string, id: string): Promise<any> {
    const schema = await this.prisma.documentSchema.findFirst({
      where: { id, OR: [{ organizationId: null }, { organizationId }] },
    });
    if (!schema) throw new NotFoundException("Schema not found");
    return schema;
  }

  async create(principal: AuthPrincipal, dto: CreateSchemaDto): Promise<any> {
    const existing = await this.prisma.documentSchema.findFirst({
      where: { organizationId: principal.organizationId, key: dto.key, version: 1 },
    });
    if (existing) throw new ConflictException("A schema with this key already exists");

    const schema = await this.prisma.documentSchema.create({
      data: {
        organizationId: principal.organizationId,
        key: dto.key,
        name: dto.name,
        industry: dto.industry,
        description: dto.description,
        confidenceThreshold: dto.confidenceThreshold ?? 0.85,
        fields: dto.fields as any,
      },
    });

    await this.audit.record({
      organizationId: principal.organizationId,
      actorId: principal.id,
      actorType: "USER",
      action: "schema.create",
      resourceType: "document_schema",
      resourceId: schema.id,
      metadata: { key: schema.key },
    });

    return schema;
  }

  async update(principal: AuthPrincipal, id: string, dto: Partial<CreateSchemaDto>): Promise<any> {
    const schema = await this.prisma.documentSchema.findFirst({
      where: { id, organizationId: principal.organizationId },
    });
    if (!schema) throw new NotFoundException("Schema not found (built-in templates cannot be edited — clone them into your org instead)");

    // Bump the version on every edit so documents already processed under
    // the prior version keep their historical field definitions intact.
    const updated = await this.prisma.documentSchema.create({
      data: {
        organizationId: principal.organizationId,
        key: schema.key,
        name: dto.name ?? schema.name,
        industry: (dto.industry as any) ?? schema.industry,
        description: dto.description ?? schema.description,
        confidenceThreshold: dto.confidenceThreshold ?? schema.confidenceThreshold,
        fields: (dto.fields as any) ?? schema.fields,
        version: schema.version + 1,
      },
    });
    await this.prisma.documentSchema.update({ where: { id: schema.id }, data: { isActive: false } });

    await this.audit.record({
      organizationId: principal.organizationId,
      actorId: principal.id,
      actorType: "USER",
      action: "schema.update",
      resourceType: "document_schema",
      resourceId: updated.id,
      metadata: { key: schema.key, newVersion: updated.version },
    });

    return updated;
  }
}
