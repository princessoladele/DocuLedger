import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Queue } from "bullmq";
import {
  MAX_UPLOAD_BYTES,
  QUEUE_NAMES,
  SUPPORTED_MIME_TYPES,
  sha256Hex,
  hasPermission,
} from "@doculedger/shared";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StorageService } from "../../common/storage/storage.service";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { OCR_QUEUE } from "../../common/queue/queue.module";

export interface ListDocumentsParams {
  status?: string;
  industry?: string;
  schemaId?: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditLogService,
    @Inject(OCR_QUEUE) private readonly ocrQueue: Queue,
  ) {}

  async upload(
    principal: AuthPrincipal,
    file: Express.Multer.File,
    opts: { schemaId?: string; industry?: string },
    ipAddress?: string,
  ): Promise<any> {
    if (!file) throw new BadRequestException("No file uploaded");
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit`);
    }
    if (!SUPPORTED_MIME_TYPES.includes(file.mimetype as any)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Supported: ${SUPPORTED_MIME_TYPES.join(", ")}`,
      );
    }

    let schema = null;
    if (opts.schemaId) {
      schema = await this.prisma.documentSchema.findFirst({
        where: { id: opts.schemaId, OR: [{ organizationId: null }, { organizationId: principal.organizationId }] },
      });
      if (!schema) throw new BadRequestException("Unknown schemaId");
    }

    const sha256 = sha256Hex(file.buffer);

    const document = await this.prisma.document.create({
      data: {
        organizationId: principal.organizationId,
        uploadedById: principal.authType === "user" ? principal.id : (await this.systemUploaderId(principal.organizationId)),
        schemaId: schema?.id,
        industry: (opts.industry as any) ?? schema?.industry ?? "GENERAL",
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: "", // set below once we know the id
        sha256,
        status: "UPLOADED",
        source: principal.authType === "api_key" ? "API" : "UPLOAD",
      },
    });

    const storageKey = this.storage.buildKey(principal.organizationId, document.id, file.originalname);
    await this.storage.upload(storageKey, file.buffer, file.mimetype);
    await this.prisma.document.update({ where: { id: document.id }, data: { storageKey, status: "QUEUED" } });

    await this.prisma.processingJob.create({
      data: { documentId: document.id, queue: QUEUE_NAMES.OCR_EXTRACTION, status: "PENDING" },
    });

    await this.ocrQueue.add(
      "extract",
      { documentId: document.id, organizationId: principal.organizationId },
      { jobId: document.id },
    );

    await this.audit.record({
      organizationId: principal.organizationId,
      actorId: principal.authType === "user" ? principal.id : null,
      actorType: principal.authType === "user" ? "USER" : "API_KEY",
      action: "document.upload",
      resourceType: "document",
      resourceId: document.id,
      documentId: document.id,
      metadata: { filename: file.originalname, sizeBytes: file.size, mimeType: file.mimetype },
      ipAddress,
    });

    return this.get(principal, document.id);
  }

  async list(principal: AuthPrincipal, params: ListDocumentsParams): Promise<any> {
    const { status, industry, schemaId, skip = 0, take = 25 } = params;
    // "own" only makes sense for a human user's uploads — an API key isn't
    // attributable to a single user's uploadedById (see `systemUploaderId`
    // below), so key-authenticated callers see everything their role's
    // other permissions allow within the org instead of being scoped to a
    // single (arbitrary) user's documents.
    const scopedToOwn = principal.authType === "user" && !hasPermission(principal.role, "document:read:all");

    const where: any = {
      organizationId: principal.organizationId,
      ...(status ? { status } : {}),
      ...(industry ? { industry } : {}),
      ...(schemaId ? { schemaId } : {}),
      ...(scopedToOwn ? { uploadedById: principal.id } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: Math.min(take, 100),
        include: {
          schema: { select: { id: true, name: true, industry: true } },
          uploadedBy: { select: { id: true, name: true, email: true } },
          extractions: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async get(principal: AuthPrincipal, id: string): Promise<any> {
    const document = await this.prisma.document.findFirst({
      where: { id, organizationId: principal.organizationId },
      include: {
        schema: true,
        uploadedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        extractions: { orderBy: { createdAt: "desc" } },
        validationIssues: true,
        reviewTasks: { orderBy: { createdAt: "desc" } },
        processingJobs: { orderBy: { createdAt: "desc" } },
        anchorRecords: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!document) throw new NotFoundException("Document not found");

    const ownershipCheckApplies = principal.authType === "user" && !hasPermission(principal.role, "document:read:all");
    if (ownershipCheckApplies && document.uploadedById !== principal.id) {
      throw new ForbiddenException("You do not have access to this document");
    }
    return document;
  }

  async getDownloadUrl(principal: AuthPrincipal, id: string) {
    const document = await this.get(principal, id);
    const url = await this.storage.getDownloadUrl(document.storageKey);
    return { url, expiresInSeconds: 300 };
  }

  async retry(principal: AuthPrincipal, id: string) {
    const document = await this.get(principal, id);
    if (document.status !== "FAILED") {
      throw new BadRequestException("Only documents in FAILED status can be retried");
    }

    await this.prisma.document.update({
      where: { id },
      data: { status: "QUEUED", failureReason: null },
    });
    await this.prisma.processingJob.create({
      data: { documentId: id, queue: QUEUE_NAMES.OCR_EXTRACTION, status: "PENDING" },
    });
    await this.ocrQueue.add(
      "extract",
      { documentId: id, organizationId: principal.organizationId },
      { jobId: `${id}-retry-${Date.now()}` },
    );

    await this.audit.record({
      organizationId: principal.organizationId,
      actorId: principal.authType === "user" ? principal.id : null,
      actorType: principal.authType === "user" ? "USER" : "API_KEY",
      action: "document.retry",
      resourceType: "document",
      resourceId: id,
      documentId: id,
    });

    return { success: true };
  }

  async remove(principal: AuthPrincipal, id: string) {
    const document = await this.get(principal, id);
    await this.prisma.document.delete({ where: { id: document.id } });
    await this.audit.record({
      organizationId: principal.organizationId,
      actorId: principal.authType === "user" ? principal.id : null,
      actorType: principal.authType === "user" ? "USER" : "API_KEY",
      action: "document.delete",
      resourceType: "document",
      resourceId: id,
    });
    return { success: true };
  }

  /** API-key-driven uploads still need a valid `uploadedById` FK; attribute them to the org's earliest OWNER. */
  private async systemUploaderId(organizationId: string): Promise<string> {
    const owner = await this.prisma.user.findFirst({
      where: { organizationId, role: "OWNER" },
      orderBy: { createdAt: "asc" },
    });
    if (!owner) throw new BadRequestException("Organization has no owner to attribute API uploads to");
    return owner.id;
  }
}
