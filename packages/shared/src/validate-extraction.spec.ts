import { validateExtraction } from "./validate-extraction";
import { financeInvoice } from "./industry-templates/finance";
import { ExtractedField } from "./extraction-types";

function field(name: string, value: string | null, confidence = 0.99): ExtractedField {
  return { name, label: name, value, rawMatch: value, confidence, valid: true };
}

describe("validateExtraction", () => {
  it("passes a clean, fully-populated invoice", () => {
    const result = validateExtraction(financeInvoice, [
      field("invoice_number", "INV-1001"),
      field("vendor_name", "Acme Supplies"),
      field("customer_name", "DocuLedger Inc."),
      field("invoice_date", "2026-01-15"),
      field("total_amount", "$1,204.50"),
    ]);
    expect(result.passed).toBe(true);
    expect(result.requiresReview).toBe(false);
    expect(result.issues).toHaveLength(0);
  });

  it("flags a missing required field", () => {
    const result = validateExtraction(financeInvoice, [
      field("vendor_name", "Acme Supplies"),
      field("customer_name", "DocuLedger Inc."),
      field("invoice_date", "2026-01-15"),
      field("total_amount", "$1,204.50"),
    ]);
    expect(result.passed).toBe(false);
    expect(result.requiresReview).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ field: "invoice_number", code: "REQUIRED_FIELD_MISSING" }),
    );
  });

  it("flags a pattern mismatch on a malformed currency value", () => {
    const result = validateExtraction(financeInvoice, [
      field("invoice_number", "INV-1001"),
      field("vendor_name", "Acme Supplies"),
      field("customer_name", "DocuLedger Inc."),
      field("invoice_date", "2026-01-15"),
      field("total_amount", "not-a-number"),
    ]);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.field === "total_amount" && i.code === "TYPE_MISMATCH")).toBe(
      true,
    );
  });

  it("routes low-confidence fields to review without failing validation outright", () => {
    const result = validateExtraction(financeInvoice, [
      field("invoice_number", "INV-1001", 0.4),
      field("vendor_name", "Acme Supplies"),
      field("customer_name", "DocuLedger Inc."),
      field("invoice_date", "2026-01-15"),
      field("total_amount", "$1,204.50"),
    ]);
    expect(result.passed).toBe(true);
    expect(result.requiresReview).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ field: "invoice_number", code: "LOW_CONFIDENCE" }),
    );
  });

  it("flags an enum value outside the allowed set", () => {
    const result = validateExtraction(financeInvoice, [
      field("invoice_number", "INV-1001"),
      field("vendor_name", "Acme Supplies"),
      field("customer_name", "DocuLedger Inc."),
      field("invoice_date", "2026-01-15"),
      field("total_amount", "$1,204.50"),
      field("currency", "ZZZ"),
    ]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ field: "currency", code: "ENUM_MISMATCH" }),
    );
  });
});
