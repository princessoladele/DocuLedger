import { DocumentSchemaDefinition, FieldDefinition } from "./schema-types";
import { ExtractedField, ValidationIssueDto, ValidationOutput } from "./extraction-types";

const TYPE_VALIDATORS: Record<FieldDefinition["type"], (v: string) => boolean> = {
  string: (v) => v.trim().length > 0,
  number: (v) => !Number.isNaN(Number(v.replace(/,/g, ""))),
  date: (v) => !Number.isNaN(Date.parse(normalizeDateLike(v))),
  currency: (v) => /^\$?-?[0-9][0-9,]*(\.[0-9]{1,2})?$/.test(v.trim()),
  boolean: (v) => /^(true|false|yes|no)$/i.test(v.trim()),
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  phone: (v) => /^[+]?[0-9()\-.\s]{7,20}$/.test(v.trim()),
  address: (v) => v.trim().length > 4,
  enum: () => true, // enum membership is checked separately against enumValues
};

function normalizeDateLike(v: string): string {
  // Accepts common human formats like "MM/DD/YYYY" in addition to ISO.
  const m = v.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, mm, dd, yyyy] = m;
    const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return v;
}

/**
 * Applies a schema's field rules against an extraction's output, producing
 * the validation issues that drive routing: any ERROR-severity issue or a
 * below-threshold field sends the document to the review queue instead of
 * auto-completing.
 */
export function validateExtraction(
  schema: DocumentSchemaDefinition,
  fields: ExtractedField[],
): ValidationOutput {
  const issues: ValidationIssueDto[] = [];
  const byName = new Map(fields.map((f) => [f.name, f]));

  for (const def of schema.fields) {
    const extracted = byName.get(def.name);
    const floor = def.minConfidence ?? schema.confidenceThreshold;

    if (!extracted || extracted.value === null || extracted.value.trim() === "") {
      if (def.required) {
        issues.push({
          field: def.name,
          code: "REQUIRED_FIELD_MISSING",
          message: `Required field "${def.label}" was not found in the document.`,
          severity: "ERROR",
        });
      }
      continue;
    }

    if (!TYPE_VALIDATORS[def.type](extracted.value)) {
      issues.push({
        field: def.name,
        code: "TYPE_MISMATCH",
        message: `"${def.label}" value "${extracted.value}" does not look like a valid ${def.type}.`,
        severity: "ERROR",
      });
    }

    if (def.pattern && !new RegExp(def.pattern).test(extracted.value.trim())) {
      issues.push({
        field: def.name,
        code: "PATTERN_MISMATCH",
        message: `"${def.label}" value did not match the expected format.`,
        severity: "ERROR",
      });
    }

    if (def.type === "enum" && def.enumValues && !def.enumValues.includes(extracted.value)) {
      issues.push({
        field: def.name,
        code: "ENUM_MISMATCH",
        message: `"${def.label}" value "${extracted.value}" is not one of: ${def.enumValues.join(", ")}.`,
        severity: "ERROR",
      });
    }

    if (extracted.confidence < floor) {
      issues.push({
        field: def.name,
        code: "LOW_CONFIDENCE",
        message: `"${def.label}" was extracted with confidence ${(extracted.confidence * 100).toFixed(0)}%, below the ${(floor * 100).toFixed(0)}% threshold.`,
        severity: "WARNING",
      });
    }
  }

  const hasError = issues.some((i) => i.severity === "ERROR");
  const hasLowConfidence = issues.some((i) => i.code === "LOW_CONFIDENCE");

  return {
    passed: !hasError,
    issues,
    requiresReview: hasError || hasLowConfidence,
  };
}
