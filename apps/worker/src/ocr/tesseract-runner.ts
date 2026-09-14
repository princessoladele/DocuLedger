import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface TesseractResult {
  text: string;
  /** Mean word-level confidence (0-1), computed from tesseract's own TSV confidence column. */
  confidence: number;
}

/**
 * Runs the `tesseract` CLI against an image buffer and parses its TSV
 * output (`-c tessedit_create_tsv=1`) to recover real per-word confidence
 * scores rather than a made-up number — this is what feeds the
 * per-field confidence shown in the review UI.
 */
export async function runTesseract(imageBuffer: Buffer, ext = "png"): Promise<TesseractResult> {
  const dir = await mkdtemp(join(tmpdir(), "doculedger-ocr-"));
  const inputPath = join(dir, `input.${ext}`);
  const outputBase = join(dir, "output");

  try {
    await writeFile(inputPath, imageBuffer);
    await execFileAsync("tesseract", [inputPath, outputBase, "tsv"], { timeout: 60_000 });
    const tsv = await readFile(`${outputBase}.tsv`, "utf-8");
    return parseTsv(tsv);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function parseTsv(tsv: string): TesseractResult {
  const lines = tsv.split("\n").slice(1); // skip header
  const words: string[] = [];
  const confidences: number[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split("\t");
    // Tesseract TSV columns: level page_num block_num par_num line_num word_num
    // left top width height conf text
    const conf = Number(cols[10]);
    const text = cols[11];
    if (text && text.trim() && conf >= 0) {
      words.push(text);
      confidences.push(conf);
    }
  }

  const meanConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length / 100
    : 0;

  return { text: reconstructLines(tsv), confidence: meanConfidence };
}

/** Rebuilds line-structured text (not just a flat word list) from the TSV so downstream alias matching can rely on "label: value" appearing on one line. */
function reconstructLines(tsv: string): string {
  const rows = tsv
    .split("\n")
    .slice(1)
    .map((l) => l.split("\t"))
    .filter((cols) => cols.length >= 12 && cols[11]?.trim());

  const lineKey = (cols: string[]) => `${cols[1]}-${cols[2]}-${cols[3]}-${cols[4]}`;
  const lines = new Map<string, string[]>();
  for (const cols of rows) {
    const key = lineKey(cols);
    const arr = lines.get(key) ?? [];
    arr.push(cols[11]);
    lines.set(key, arr);
  }
  return Array.from(lines.values())
    .map((words) => words.join(" "))
    .join("\n");
}
