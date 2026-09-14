import { DocumentStatus } from "@/lib/types";

const STYLES: Record<DocumentStatus, string> = {
  UPLOADED: "bg-slate-100 text-slate-700",
  QUEUED: "bg-slate-100 text-slate-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  VALIDATING: "bg-blue-100 text-blue-700",
  NEEDS_REVIEW: "bg-amber-100 text-amber-800",
  REVIEWED: "bg-emerald-100 text-emerald-700",
  ANCHORED: "bg-indigo-100 text-indigo-700",
  FAILED: "bg-red-100 text-red-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

const LABELS: Record<DocumentStatus, string> = {
  UPLOADED: "Uploaded",
  QUEUED: "Queued",
  PROCESSING: "Processing",
  VALIDATING: "Validating",
  NEEDS_REVIEW: "Needs review",
  REVIEWED: "Reviewed",
  ANCHORED: "Anchored",
  FAILED: "Failed",
  ARCHIVED: "Archived",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <span className={`badge ${STYLES[status]}`}>{LABELS[status]}</span>;
}
