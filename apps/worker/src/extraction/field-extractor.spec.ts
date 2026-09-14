import { FieldExtractor } from "./field-extractor";
import { financeInvoice } from "@doculedger/shared";

describe("FieldExtractor", () => {
  const extractor = new FieldExtractor();

  const sampleInvoiceText = [
    "Acme Supplies Inc.",
    "Invoice Number: INV-20394",
    "Bill To: DocuLedger Inc.",
    "Invoice Date: 01/15/2026",
    "Total Due: $1,204.50",
  ].join("\n");

  it("extracts fields present in the text with high confidence at full OCR confidence", () => {
    const fields = extractor.extractFields(sampleInvoiceText, 1.0, financeInvoice);
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));

    expect(byName.invoice_number.value).toBe("INV-20394");
    expect(byName.invoice_number.confidence).toBeGreaterThan(0.9);
    expect(byName.total_amount.value).toBe("$1,204.50");
  });

  it("returns null value and zero confidence for fields with no alias match", () => {
    const fields = extractor.extractFields("Nothing relevant here.", 1.0, financeInvoice);
    const vendor = fields.find((f) => f.name === "vendor_name")!;
    expect(vendor.value).toBeNull();
    expect(vendor.confidence).toBe(0);
    expect(vendor.valid).toBe(false);
  });

  it("scales confidence down with lower OCR engine confidence", () => {
    const highOcr = extractor.extractFields(sampleInvoiceText, 1.0, financeInvoice);
    const lowOcr = extractor.extractFields(sampleInvoiceText, 0.5, financeInvoice);
    const highField = highOcr.find((f) => f.name === "invoice_number")!;
    const lowField = lowOcr.find((f) => f.name === "invoice_number")!;
    expect(lowField.confidence).toBeLessThan(highField.confidence);
  });

  it("stops a captured value at the next line rather than swallowing the whole document", () => {
    const fields = extractor.extractFields(sampleInvoiceText, 1.0, financeInvoice);
    const invoiceNumber = fields.find((f) => f.name === "invoice_number")!;
    expect(invoiceNumber.value).not.toContain("\n");
    expect(invoiceNumber.value).not.toContain("Bill To");
  });
});
