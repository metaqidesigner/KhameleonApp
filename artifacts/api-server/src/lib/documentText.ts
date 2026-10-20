/**
 * Reads the text of a company document on this computer (Build 5): PDFs
 * (their own text, or on-device OCR for scans), Word (.docx), photos of
 * pages (OCR), and plain text. Nothing is sent anywhere. Same approach as
 * the desktop app's reader (lib/integrations/src/documentImport.ts).
 *
 * OCR's English language file is downloaded once, the first time a scan is
 * read, and kept in ~/.khameleon/ocr-cache - after that it works offline.
 */
import path from "node:path";
import { homedir, tmpdir } from "node:os";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";

// KHAMELEON_HOME: the all-in-one app keeps everything in its own folder.
const ocrCachePath = () => path.join(process.env.KHAMELEON_HOME ?? path.join(homedir(), ".khameleon"), "ocr-cache");
const IMAGE = new Set([".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"]);

export class UnsupportedDocumentError extends Error {
  status = 400;
}

async function ocr(images: (string | Buffer)[]): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  await mkdir(ocrCachePath(), { recursive: true });
  const worker = await createWorker("eng", undefined, { cachePath: ocrCachePath() });
  try {
    const out: string[] = [];
    for (const img of images) out.push((await worker.recognize(img)).data.text);
    return out.join("\n\n");
  } finally {
    await worker.terminate();
  }
}

export async function readDocumentText(fileName: string, data: Buffer): Promise<{ text: string; how: "text" | "ocr" }> {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".txt" || ext === ".md") return { text: data.toString("utf8"), how: "text" };
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ buffer: data });
    return { text: r.value, how: "text" };
  }
  if (ext === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(data) });
    try {
      const r = await parser.getText();
      if (r.text.trim().length > 40) return { text: r.text, how: "text" };
      const shots = await parser.getScreenshot({ scale: 2, imageBuffer: true });
      const pages = shots.pages.filter(p => p.data).map(p => Buffer.from(p.data as Uint8Array));
      return { text: await ocr(pages), how: "ocr" };
    } finally {
      await parser.destroy();
    }
  }
  if (IMAGE.has(ext)) {
    const dir = await mkdtemp(path.join(tmpdir(), "khameleon-doc-"));
    try {
      const file = path.join(dir, `page${ext}`);
      await writeFile(file, data);
      return { text: await ocr([file]), how: "ocr" };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  if (ext === ".doc") throw new UnsupportedDocumentError("Older Word files (.doc) can't be read - save it as .docx or PDF and try again.");
  throw new UnsupportedDocumentError(`Khameleon can't read ${ext || "this kind of"} files yet - use a PDF, Word (.docx), a photo of the page, or plain text.`);
}
