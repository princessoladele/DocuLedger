import { Job, Queue } from "bullmq";
import { DocumentSchemaDefinition, QUEUE_NAMES, validateExtraction } from "@doculedger/shared";
import { prisma } from "../db/prisma";
import { StorageClient } from "../storage/storage-client";
import { OcrService } from "../ocr/ocr.service";
import { FieldExtractor } from "../extraction/field-extractor";
import { logger } from "../logger";
import { touchProcessingJob } from "../processing-job-tracker";

const ocrService = new OcrService();
const fieldExtractor = new FieldExtractor();
const storage = new StorageClient();

export interface ExtractionJobData {
  documentId: string;
  organizationId: string;
}

/**
 * Stage 1 of the pipeline: OCR -> heuristic field extraction -> schema
 * validation, all in one job since none of those steps need to cross a
 * network boundary. Routes the document to either the review queue
 * (NEEDS_REVIEW) or straight to anchoring (REVIEWED), matching the
 * DocumentStatus state machine documented on the Prisma model.
 */
export function createExtractionProcessor(anchorQueue: Queue) {
  return async function processExtractionJob(job: Job<ExtractionJobData>): Promise<void> {
    const { documentId, organizationId } = job.data;
    const log = logger.child({ documentId, jobId: job.id, queue: QUEUE_NAMES.OCR_EXTRACTION });

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { schema: true },
    });
    if (!document) {
      log.warn("document not found, skipping job");
      return;
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    await touchProcessingJob(documentId, QUEUE_NAMES.OCR_EXTRACTION, "ACTIVE");

    try {
      const start = Date.now();
      const buffer = await storage.getObjectBuffer(document.storageKey);
      const ocrResult = await ocrService.extract(buffer, document.mimeType);

      const schemaDef: DocumentSchemaDefinition | null = document.schema
        ? {
            key: document.schema.key,
            name: document.schema.name,
            industry: document.schema.industry as any,
            description: document.schema.description ?? "",
            version: document.schema.version,
            confidenceThreshold: document.schema.confidenceThreshold,
            fields: document.schema.fields as any,
          }
        : null;

      await prisma.document.update({ where: { id: documentId }, data: { status: "VALIDATING" } });

      const fields = schemaDef
        ? fieldExtractor.extractFields(ocrResult.text, ocrResult.confidence, schemaDef)
        : [];
      const overallConfidence = fields.length
        ? fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length
        : ocrResult.confidence;

      await prisma.extractionResult.create({
        data: {
          documentId,
          engine: ocrResult.engine,
          rawText: ocrResult.text.slice(0, 200_000),
          fields: fields as any,
          overallConfidence,
          durationMs: Date.now() - start,
        },
      });

      const validation = schemaDef
        ? validateExtraction(schemaDef, fields)
        : { passed: true, issues: [], requiresReview: false };

      if (validation.issues.length) {
        await prisma.validationIssue.createMany({
          data: validation.issues.map((issue) => ({
            documentId,
            field: issue.field,
            code: issue.code,
            message: issue.message,
            severity: issue.severity,
          })),
        });
      }

      if (validation.requiresReview) {
        await prisma.reviewTask.create({ data: { documentId, status: "PENDING" } });
        await prisma.document.update({ where: { id: documentId }, data: { status: "NEEDS_REVIEW" } });
        log.info({ issueCount: validation.issues.length }, "document routed to manual review");
      } else {
        await prisma.document.update({ where: { id: documentId }, data: { status: "REVIEWED" } });
        await prisma.processingJob.create({
          data: { documentId, queue: QUEUE_NAMES.ANCHORING, status: "PENDING" },
        });
        await anchorQueue.add(
          "anchor",
          { documentId, organizationId },
          { jobId: `${documentId}-anchor` },
        );
        log.info("document auto-validated with no review needed; queued for anchoring");
      }

      await touchProcessingJob(documentId, QUEUE_NAMES.OCR_EXTRACTION, "COMPLETED");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await touchProcessingJob(documentId, QUEUE_NAMES.OCR_EXTRACTION, "FAILED", message);
      log.error({ err: message }, "extraction job failed");
      throw err; // let BullMQ apply its retry/backoff policy
    }
  };
}
