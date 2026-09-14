import pdfParse from "pdf-parse";
import { simpleParser } from "mailparser";
import { runTesseract } from "./tesseract-runner";
import { rasterizePdfPages } from "./pdf-rasterizer";

export interface OcrOutput {
  text: string;
  confidence: number;
  engine: string;
}

/** Below this many characters, a PDF's embedded text layer is treated as absent (scanned/image-only) and OCR runs instead. */
const MIN_EMBEDDED_TEXT_CHARS = 40;

export class OcrService {
  async extract(buffer: Buffer, mimeType: string): Promise<OcrOutput> {
    if (mimeType === "application/pdf") {
      return this.extractPdf(buffer);
    }
    if (mimeType.startsWith("image/")) {
      const ext = mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1];
      const result = await runTesseract(buffer, ext);
      return { ...result, engine: "tesseract@5" };
    }
    if (mimeType === "message/rfc822") {
      return this.extractEmail(buffer);
    }
    throw new Error(`Unsupported mime type for OCR: ${mimeType}`);
  }

  private async extractPdf(buffer: Buffer): Promise<OcrOutput> {
    const parsed = await pdfParse(buffer).catch(() => null);
    const embeddedText = parsed?.text?.trim() ?? "";

    if (embeddedText.length >= MIN_EMBEDDED_TEXT_CHARS) {
      // Digital PDF with a real text layer: no OCR uncertainty at all.
      return { text: embeddedText, confidence: 1, engine: "pdf-text-layer" };
    }

    // Scanned/image-only PDF: rasterize pages and OCR each one.
    const pages = await rasterizePdfPages(buffer);
    const results = await Promise.all(pages.map((page) => runTesseract(page, "png")));
    const text = results.map((r) => r.text).join("\n\n");
    const confidence = results.length
      ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
      : 0;
    return { text, confidence, engine: "tesseract@5+pdftoppm" };
  }

  private async extractEmail(buffer: Buffer): Promise<OcrOutput> {
    const parsed = await simpleParser(buffer);
    const text = [parsed.subject, parsed.text ?? parsed.html ?? ""].filter(Boolean).join("\n\n");
    return { text, confidence: 1, engine: "mailparser" };
  }
}
