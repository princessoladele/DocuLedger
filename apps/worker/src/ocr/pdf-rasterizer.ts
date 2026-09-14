import { execFile } from "child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Rasterizes each page of a PDF to a PNG buffer using poppler's `pdftoppm`, for scanned PDFs with no embedded text layer. */
export async function rasterizePdfPages(pdfBuffer: Buffer, maxPages = 10): Promise<Buffer[]> {
  const dir = await mkdtemp(join(tmpdir(), "doculedger-pdf-"));
  const inputPath = join(dir, "input.pdf");
  const outputPrefix = join(dir, "page");

  try {
    await writeFile(inputPath, pdfBuffer);
    await execFileAsync(
      "pdftoppm",
      ["-png", "-r", "200", "-f", "1", "-l", String(maxPages), inputPath, outputPrefix],
      { timeout: 60_000 },
    );
    const files = (await readdir(dir)).filter((f) => f.startsWith("page") && f.endsWith(".png")).sort();
    return Promise.all(files.map((f) => readFile(join(dir, f))));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
