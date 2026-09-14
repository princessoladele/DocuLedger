import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

const STATUS_BUCKETS = [
  "UPLOADED",
  "QUEUED",
  "PROCESSING",
  "VALIDATING",
  "NEEDS_REVIEW",
  "REVIEWED",
  "ANCHORED",
  "FAILED",
  "ARCHIVED",
] as const;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(organizationId: string) {
    const grouped = await this.prisma.document.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    });

    const counts: Record<string, number> = Object.fromEntries(STATUS_BUCKETS.map((s) => [s, 0]));
    for (const row of grouped) counts[row.status] = row._count._all;

    const successful = counts.ANCHORED + counts.REVIEWED;
    const pending = counts.UPLOADED + counts.QUEUED + counts.PROCESSING + counts.VALIDATING;
    const failed = counts.FAILED;
    const needsReview = counts.NEEDS_REVIEW;

    const [totalDocuments, pendingReviewTasks, last7DaysDaily, deadLetterCount, anchoredCount] = await Promise.all([
      this.prisma.document.count({ where: { organizationId } }),
      this.prisma.reviewTask.count({ where: { status: "PENDING", document: { organizationId } } }),
      this.dailyThroughput(organizationId),
      this.prisma.processingJob.count({ where: { status: "DEAD_LETTER", document: { organizationId } } }),
      this.prisma.anchorRecord.count({ where: { status: "CONFIRMED", document: { organizationId } } }),
    ]);

    return {
      totalDocuments,
      byStatus: counts,
      buckets: { successful, pending, failed, needsReview },
      pendingReviewTasks,
      deadLetterCount,
      anchoredCount,
      last7DaysDaily,
    };
  }

  private async dailyThroughput(organizationId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const documents = await this.prisma.document.findMany({
      where: { organizationId, createdAt: { gte: since } },
      select: { createdAt: true, status: true },
    });

    const byDay = new Map<string, { total: number; failed: number; anchored: number }>();
    for (const doc of documents) {
      const day = doc.createdAt.toISOString().slice(0, 10);
      const bucket = byDay.get(day) ?? { total: 0, failed: 0, anchored: 0 };
      bucket.total += 1;
      if (doc.status === "FAILED") bucket.failed += 1;
      if (doc.status === "ANCHORED") bucket.anchored += 1;
      byDay.set(day, bucket);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats }));
  }
}
