import { Queue, Worker } from "bullmq";
import { QUEUE_NAMES } from "@doculedger/shared";
import { prisma } from "./db/prisma";
import { logger } from "./logger";
import { createExtractionProcessor } from "./processors/extraction.processor";
import { processAnchorJob } from "./processors/anchor.processor";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" } as any;
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 4);

async function main() {
  const anchorQueue = new Queue(QUEUE_NAMES.ANCHORING, { connection });

  const extractionWorker = new Worker(
    QUEUE_NAMES.OCR_EXTRACTION,
    createExtractionProcessor(anchorQueue),
    { connection, concurrency },
  );

  const anchorWorker = new Worker(QUEUE_NAMES.ANCHORING, processAnchorJob, { connection, concurrency });

  for (const [name, worker] of [
    ["extraction", extractionWorker],
    ["anchor", anchorWorker],
  ] as const) {
    worker.on("completed", (job) => logger.info({ worker: name, jobId: job.id }, "job completed"));
    worker.on("failed", (job, err) => onJobFailed(name, job, err));
    worker.on("error", (err) => logger.error({ worker: name, err: err.message }, "worker error"));
  }

  logger.info({ concurrency }, "DocuLedger worker started, listening for OCR extraction and anchoring jobs");

  const shutdown = async () => {
    logger.info("shutting down worker...");
    await Promise.all([extractionWorker.close(), anchorWorker.close(), anchorQueue.close()]);
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

/**
 * When a job exhausts all of BullMQ's configured retry attempts, it lands
 * here permanently rather than silently vanishing: the document moves to
 * FAILED and its ProcessingJob row moves to DEAD_LETTER, which is exactly
 * what the dashboard's "failed" bucket and the error-queue view read from.
 */
async function onJobFailed(
  workerName: "extraction" | "anchor",
  job: { id?: string; data: { documentId: string }; attemptsMade: number; opts: { attempts?: number } } | undefined,
  err: Error,
) {
  if (!job) return;
  const maxAttempts = job.opts.attempts ?? 1;
  logger.error(
    { worker: workerName, jobId: job.id, attempt: job.attemptsMade, maxAttempts, err: err.message },
    "job failed",
  );

  if (job.attemptsMade < maxAttempts) {
    return; // BullMQ will still retry this one
  }

  const documentId = job.data.documentId;
  const queueName = workerName === "extraction" ? QUEUE_NAMES.OCR_EXTRACTION : QUEUE_NAMES.ANCHORING;

  await prisma.document
    .update({ where: { id: documentId }, data: { status: "FAILED", failureReason: err.message } })
    .catch(() => undefined);

  const processingJob = await prisma.processingJob.findFirst({
    where: { documentId, queue: queueName },
    orderBy: { createdAt: "desc" },
  });
  if (processingJob) {
    await prisma.processingJob
      .update({ where: { id: processingJob.id }, data: { status: "DEAD_LETTER", lastError: err.message } })
      .catch(() => undefined);
  }
}

main().catch((err) => {
  logger.error({ err }, "worker failed to start");
  process.exit(1);
});
