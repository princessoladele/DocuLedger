import { Job } from "bullmq";
import { AnchorService, createAnchorServiceFromEnv } from "@doculedger/stellar";
import { fingerprintOf, QUEUE_NAMES } from "@doculedger/shared";
import { prisma } from "../db/prisma";
import { logger } from "../logger";
import { touchProcessingJob } from "../processing-job-tracker";

const anchorService: AnchorService = createAnchorServiceFromEnv();

export interface AnchorJobData {
  documentId: string;
  organizationId: string;
}

/**
 * Stage 2 of the pipeline: fingerprints the FINAL extracted data (post
 * human correction, if any review happened) and anchors that fingerprint
 * on Stellar via the configured AnchorService (mock in dev/CI, the
 * `attestation` Soroban contract in staging/prod — see
 * @doculedger/stellar's createAnchorServiceFromEnv).
 */
export async function processAnchorJob(job: Job<AnchorJobData>): Promise<void> {
  const { documentId, organizationId } = job.data;
  const log = logger.child({ documentId, jobId: job.id, queue: QUEUE_NAMES.ANCHORING });

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { extractions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!document) {
    log.warn("document not found, skipping job");
    return;
  }
  const extraction = document.extractions[0];
  if (!extraction) {
    throw new Error("cannot anchor a document with no extraction result");
  }

  await touchProcessingJob(documentId, QUEUE_NAMES.ANCHORING, "ACTIVE");

  // Fingerprint of the structured data only — never the raw file or PII.
  const fingerprint = fingerprintOf({ documentId, fields: extraction.fields });

  const anchorRecord = await prisma.anchorRecord.create({
    data: {
      documentId,
      fingerprint,
      network: process.env.STELLAR_NETWORK_LABEL ?? "mock",
      status: "PENDING",
    },
  });

  try {
    const submission = await anchorService.anchor(fingerprint, organizationId);

    await prisma.anchorRecord.update({
      where: { id: anchorRecord.id },
      data: {
        contractId: submission.contractId,
        stellarTxHash: submission.txHash || null,
        ledgerSequence: submission.ledgerSequence,
        status: submission.status,
        errorMessage: submission.errorMessage,
        confirmedAt: submission.status === "CONFIRMED" ? new Date() : null,
      },
    });

    if (submission.status === "FAILED") {
      throw new Error(submission.errorMessage ?? "Stellar anchoring failed");
    }

    await prisma.document.update({ where: { id: documentId }, data: { status: "ANCHORED" } });
    await touchProcessingJob(documentId, QUEUE_NAMES.ANCHORING, "COMPLETED");
    log.info({ txHash: submission.txHash, network: submission.network }, "document anchored on Stellar");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.anchorRecord.update({
      where: { id: anchorRecord.id },
      data: { status: "FAILED", errorMessage: message },
    });
    await touchProcessingJob(documentId, QUEUE_NAMES.ANCHORING, "FAILED", message);
    log.error({ err: message }, "anchoring job failed");
    throw err;
  }
}
