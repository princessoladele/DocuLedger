import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@doculedger/shared";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { AuthPrincipal } from "../../common/decorators/current-user.decorator";
import { ANCHOR_QUEUE } from "../../common/queue/queue.module";
import { ApproveReviewDto, RejectReviewDto } from "./dto/decide-review.dto";

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    @Inject(ANCHOR_QUEUE) private readonly anchorQueue: Queue,
  ) {}

  list(organizationId: string, status?: string): Promise<any> {
    return this.prisma.reviewTask.findMany({
      where: {
        status: (status as any) ?? "PENDING",
        document: { organizationId },
      },
      include: {
        document: {
          select: {
            id: true,
            originalFilename: true,
            industry: true,
            status: true,
            createdAt: true,
            schema: { select: { name: true } },
          },
        },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async get(organizationId: string, id: string): Promise<any> {
    const task = await this.prisma.reviewTask.findFirst({
      where: { id, document: { organizationId } },
      include: {
        document: {
          include: {
            schema: true,
            extractions: { orderBy: { createdAt: "desc" }, take: 1 },
            validationIssues: true,
          },
        },
      },
    });
    if (!task) throw new NotFoundException("Review task not found");
    return task;
  }

  async approve(principal: AuthPrincipal, id: string, dto: ApproveReviewDto) {
    const task = await this.get(principal.organizationId, id);
    if (task.status !== "PENDING" && task.status !== "IN_PROGRESS") {
      throw new BadRequestException("Review task has already been resolved");
    }

    const latestExtraction = task.document.extractions[0];
    let mergedFields = (latestExtraction?.fields as any[]) ?? [];
    if (dto.correctedFields) {
      mergedFields = mergedFields.map((f) =>
        dto.correctedFields![f.name] !== undefined
          ? { ...f, value: dto.correctedFields![f.name], confidence: 1, valid: true }
          : f,
      );
    }

    await this.prisma.$transaction([
      this.prisma.reviewTask.update({
        where: { id: task.id },
        data: {
          status: "APPROVED",
          assignedToId: principal.id,
          correctedFields: dto.correctedFields as any,
          reviewerNotes: dto.reviewerNotes,
          resolvedAt: new Date(),
        },
      }),
      this.prisma.document.update({
        where: { id: task.document.id },
        data: { status: "REVIEWED", reviewedById: principal.id },
      }),
      ...(latestExtraction
        ? [
            this.prisma.extractionResult.update({
              where: { id: latestExtraction.id },
              data: { fields: mergedFields as any },
            }),
          ]
        : []),
    ]);

    await this.prisma.processingJob.create({
      data: { documentId: task.document.id, queue: QUEUE_NAMES.ANCHORING, status: "PENDING" },
    });
    await this.anchorQueue.add(
      "anchor",
      { documentId: task.document.id, organizationId: principal.organizationId },
      { jobId: `${task.document.id}-anchor` },
    );

    await this.audit.record({
      organizationId: principal.organizationId,
      actorId: principal.id,
      actorType: "USER",
      action: "review.approve",
      resourceType: "review_task",
      resourceId: task.id,
      documentId: task.document.id,
      metadata: { correctedFieldCount: Object.keys(dto.correctedFields ?? {}).length },
    });

    return { success: true };
  }

  async reject(principal: AuthPrincipal, id: string, dto: RejectReviewDto) {
    const task = await this.get(principal.organizationId, id);
    if (task.status !== "PENDING" && task.status !== "IN_PROGRESS") {
      throw new BadRequestException("Review task has already been resolved");
    }

    await this.prisma.$transaction([
      this.prisma.reviewTask.update({
        where: { id: task.id },
        data: {
          status: "REJECTED",
          assignedToId: principal.id,
          reviewerNotes: dto.reviewerNotes,
          resolvedAt: new Date(),
        },
      }),
      this.prisma.document.update({
        where: { id: task.document.id },
        data: {
          status: "FAILED",
          failureReason: dto.reviewerNotes ?? "Rejected during manual review",
          reviewedById: principal.id,
        },
      }),
    ]);

    await this.audit.record({
      organizationId: principal.organizationId,
      actorId: principal.id,
      actorType: "USER",
      action: "review.reject",
      resourceType: "review_task",
      resourceId: task.id,
      documentId: task.document.id,
      metadata: { reason: dto.reviewerNotes },
    });

    return { success: true };
  }
}
