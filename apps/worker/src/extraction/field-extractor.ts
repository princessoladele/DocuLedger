import { DocumentSchemaDefinition, ExtractedField, FieldDefinition } from "@doculedger/shared";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Cleans a raw regex capture down to a plausible single field value: trims
 * whitespace/punctuation, and truncates at the first run of 2+ spaces or a
 * newline (a common signal that OCR has run into the next label/column).
 */
function cleanCapture(raw: string): string {
  return raw
    .split(/\n|  +/)[0]
    .trim()
    .replace(/^[:\-–—\s]+/, "")
    .replace(/[.,;:\s]+$/, "")
    .slice(0, 120);
}

/**
 * Locates a field's value in OCR'd text by looking for one of its declared
 * aliases followed by a separator (":", "-", or whitespace) and capturing
 * what follows on the same line. This is a deliberately simple, auditable
 * heuristic — the extraction engine is pluggable (see OcrService/
 * FieldExtractor call sites) so a production deployment can swap in a
 * layout-aware ML model or an LLM-based extractor without touching the
 * pipeline around it.
 */
export class FieldExtractor {
  extractFields(rawText: string, ocrConfidence: number, schema: DocumentSchemaDefinition): ExtractedField[] {
    return schema.fields.map((def) => this.extractField(rawText, ocrConfidence, def));
  }

  private extractField(rawText: string, ocrConfidence: number, def: FieldDefinition): ExtractedField {
    // Longer aliases are tried before shorter ones so a specific alias like
    // "Total Due" wins over a shorter alias that happens to be its prefix,
    // like "Total" — otherwise the shorter one would match first and eat
    // "Due: <value>" as if it were the captured value.
    const byLength = def.aliases
      .map((alias, originalIndex) => ({ alias, originalIndex }))
      .sort((a, b) => b.alias.length - a.alias.length);

    for (const { alias, originalIndex } of byLength) {
      // Exact-line match: "Alias: value" or "Alias - value" at a line start scores highest.
      const lineStartPattern = new RegExp(`^\\s*${escapeRegExp(alias)}\\s*[:\\-]\\s*(.+)$`, "im");
      const lineStartMatch = rawText.match(lineStartPattern);
      if (lineStartMatch) {
        const value = cleanCapture(lineStartMatch[1]);
        if (value) {
          return this.buildField(def, value, lineStartMatch[1], this.confidenceFor(0.95, originalIndex, ocrConfidence));
        }
      }
    }

    for (const { alias, originalIndex } of byLength) {
      // Looser match: alias appears anywhere, capture trailing text on the same line.
      const anywherePattern = new RegExp(`${escapeRegExp(alias)}\\s*[:\\-]?\\s*([^\\n]{1,120})`, "i");
      const anywhereMatch = rawText.match(anywherePattern);
      if (anywhereMatch) {
        const value = cleanCapture(anywhereMatch[1]);
        if (value) {
          return this.buildField(def, value, anywhereMatch[1], this.confidenceFor(0.75, originalIndex, ocrConfidence));
        }
      }
    }

    return { name: def.name, label: def.label, value: null, rawMatch: null, confidence: 0, valid: false };
  }

  /** Later aliases in the list are synonyms of a synonym, so each step down the list slightly discounts confidence. */
  private confidenceFor(base: number, aliasIndex: number, ocrConfidence: number): number {
    const aliasDiscount = Math.max(0, 1 - aliasIndex * 0.05);
    return Math.max(0, Math.min(1, base * aliasDiscount * ocrConfidence));
  }

  private buildField(def: FieldDefinition, value: string, rawMatch: string, confidence: number): ExtractedField {
    return {
      name: def.name,
      label: def.label,
      value,
      rawMatch: rawMatch.trim(),
      confidence: Number(confidence.toFixed(3)),
      valid: true, // structural validity is checked separately by validateExtraction
    };
  }
}
