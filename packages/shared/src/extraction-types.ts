export interface ExtractedField {
  name: string;
  label: string;
  /** Value normalized to the field's declared type (string form for transport). */
  value: string | null;
  /** Raw substring the extractor matched, before normalization. */
  rawMatch: string | null;
  /** 0-1 confidence score for this single field. */
  confidence: number;
  /** True once the field has passed type + pattern validation. */
  valid: boolean;
}

export interface ExtractionOutput {
  engine: string;
  rawText: string;
  fields: ExtractedField[];
  /** Weighted average of per-field confidences (required fields weighted higher). */
  overallConfidence: number;
  durationMs: number;
}

export interface ValidationIssueDto {
  field: string;
  code:
    | "REQUIRED_FIELD_MISSING"
    | "LOW_CONFIDENCE"
    | "PATTERN_MISMATCH"
    | "TYPE_MISMATCH"
    | "ENUM_MISMATCH";
  message: string;
  severity: "WARNING" | "ERROR";
}

export interface ValidationOutput {
  passed: boolean;
  issues: ValidationIssueDto[];
  requiresReview: boolean;
}
