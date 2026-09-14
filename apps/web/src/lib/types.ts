export type Role = "MEMBER" | "REVIEWER" | "ADMIN" | "OWNER";

export type DocumentStatus =
  | "UPLOADED"
  | "QUEUED"
  | "PROCESSING"
  | "VALIDATING"
  | "NEEDS_REVIEW"
  | "REVIEWED"
  | "ANCHORED"
  | "FAILED"
  | "ARCHIVED";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  organization?: { id: string; name: string; slug: string; plan: string };
}

export interface ExtractedFieldDto {
  name: string;
  label: string;
  value: string | null;
  rawMatch: string | null;
  confidence: number;
  valid: boolean;
}

export interface ExtractionResultDto {
  id: string;
  engine: string;
  overallConfidence: number;
  fields: ExtractedFieldDto[];
  createdAt: string;
}

export interface ValidationIssueDto {
  id: string;
  field: string;
  code: string;
  message: string;
  severity: "WARNING" | "ERROR";
}

export interface AnchorRecordDto {
  id: string;
  fingerprint: string;
  network: string;
  contractId: string | null;
  stellarTxHash: string | null;
  ledgerSequence: number | null;
  status: "PENDING" | "SUBMITTED" | "CONFIRMED" | "FAILED";
  createdAt: string;
  confirmedAt: string | null;
}

export interface DocumentDto {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  industry: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  schema?: { id: string; name: string; industry: string } | null;
  uploadedBy?: { id: string; name: string; email: string };
  reviewedBy?: { id: string; name: string; email: string } | null;
  extractions?: ExtractionResultDto[];
  validationIssues?: ValidationIssueDto[];
  anchorRecords?: AnchorRecordDto[];
}

export interface DashboardSummary {
  totalDocuments: number;
  byStatus: Record<DocumentStatus, number>;
  buckets: { successful: number; pending: number; failed: number; needsReview: number };
  pendingReviewTasks: number;
  deadLetterCount: number;
  anchoredCount: number;
  last7DaysDaily: { date: string; total: number; failed: number; anchored: number }[];
}

export interface SchemaDto {
  id: string;
  key: string;
  name: string;
  industry: string;
  description: string | null;
  version: number;
  confidenceThreshold: number;
  fields: { name: string; label: string; type: string; required: boolean }[];
  organizationId: string | null;
}

export interface ReviewTaskDto {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED";
  createdAt: string;
  document: {
    id: string;
    originalFilename: string;
    industry: string;
    status: DocumentStatus;
    createdAt: string;
    schema?: { name: string } | null;
  };
}
