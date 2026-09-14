/**
 * Configurable schema types. A `DocumentSchemaDefinition` is what tenants
 * (or DocuLedger's built-in industry templates) author to tell the
 * extraction pipeline what fields to pull out of a document and how to
 * validate them. These are stored as JSON in `DocumentSchema.fields`.
 */

export type FieldType =
  | "string"
  | "number"
  | "date"
  | "currency"
  | "boolean"
  | "email"
  | "phone"
  | "address"
  | "enum";

export interface FieldDefinition {
  /** Stable machine name, e.g. "tenant_name". Used as the key in extracted output. */
  name: string;
  /** Human label shown in the review UI. */
  label: string;
  type: FieldType;
  required: boolean;
  /**
   * Ordered list of candidate labels/synonyms the extractor looks for in the
   * document text immediately preceding the value (e.g. "Invoice Number",
   * "Invoice #", "Inv. No."). The first match wins.
   */
  aliases: string[];
  /** Optional regex (as a string) the raw matched value must satisfy. */
  pattern?: string;
  /** For type "enum": the allowed values. */
  enumValues?: string[];
  /** Per-field confidence floor; falls back to the schema-level threshold when unset. */
  minConfidence?: number;
  description?: string;
}

export interface DocumentSchemaDefinition {
  key: string;
  name: string;
  industry:
    | "REAL_ESTATE"
    | "HEALTHCARE"
    | "FINANCE"
    | "LOGISTICS"
    | "COMPLIANCE"
    | "GENERAL";
  description: string;
  version: number;
  confidenceThreshold: number;
  fields: FieldDefinition[];
}
