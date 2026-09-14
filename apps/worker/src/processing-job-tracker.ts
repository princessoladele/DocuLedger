import { prisma } from "./db/prisma";

/**
 * Updates the most recent ProcessingJob row for a document+queue pair.
 * This is a durable, DB-backed record of each queue attempt — independent
 * of BullMQ/Redis retention — so the dashboard's error-queue view and
 * per-document processing history survive Redis eviction. Used by both the
 * extraction and anchoring processors so the two stages report status the
 * same way.
 */
export async function touchProcessingJob(
  documentId: string,
  queue: string,
  status: "ACTIVE" | "COMPLETED" | "FAILED",
  lastError?: string,
): Promise<void> {
  const job = await prisma.processingJob.findFirst({
    where: { documentId, queue },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return;
  await prisma.processingJob.update({
    where: { id: job.id },
    data: {
      status,
      attempts: status === "ACTIVE" ? { increment: 1 } : undefined,
      lastError,
    },
  });
}
