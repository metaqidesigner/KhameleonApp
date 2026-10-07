import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { tmpdir, homedir } from "node:os";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { createWorker } from "tesseract.js";
import { PDFParse } from "pdf-parse";

const run = promisify(execFile);

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif"]);
const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);

// Tesseract.js defaults to caching its trained-data file in the CURRENT
// WORKING DIRECTORY, which for a real app is unpredictable and for a dev
// run meant it landed inside this package's own source folder (found this
// for real - khameleon-decisions-log.md, 2026-10-03). A stable path outside
// the repo, matching node-llama-cpp's own ~/.node-llama-cpp/models
// convention, so it downloads once and never pollutes wherever the process
// happens to be running from.
const OCR_CACHE_PATH = path.join(homedir(), ".khameleon", "ocr-cache");

/**
 * How a document's text was actually obtained - surfaced to callers (and
 * worth showing a user) since OCR is meaningfully less reliable than a
 * document's own real text layer, which matters when "detailed
 * identification of information is critical" (Newton's own words, asking
 * for this - Cross-App Control, khameleon-decisions-log.md, 2026-10-03).
 */
export type DocumentTextSource = "pdf-text-layer" | "ocr";

export interface ExtractedDocumentText {
  text: string;
  source: DocumentTextSource;
}

/**
 * Converts a HEIC/HEIF photo (the default format iPhone cameras save in)
 * to a JPEG that Tesseract can actually read. macOS: `sips`, built in,
 * verified working. Windows: best-effort via .NET's System.Drawing, which
 * depends on the optional "HEIF Image Extensions" Microsoft Store package
 * being installed - NOT guaranteed present on every Windows machine, and
 * genuinely unverified here (no Windows machine to test HEIC on) - throws
 * a clear, honest error rather than failing silently if it's missing.
 */
async function convertHeicToJpeg(filePath: string): Promise<string> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "khameleon-heic-"));
  const outputPath = path.join(tempDir, "converted.jpg");

  if (process.platform === "darwin") {
    await run("sips", ["-s", "format", "jpeg", filePath, "--out", outputPath]);
    return outputPath;
  }

  if (process.platform === "win32") {
    try {
      await run("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Add-Type -AssemblyName System.Drawing; ` +
          `$img = [System.Drawing.Image]::FromFile('${filePath.replace(/'/g, "''")}'); ` +
          `$img.Save('${outputPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Jpeg); ` +
          `$img.Dispose()`,
      ]);
      return outputPath;
    } catch (err) {
      throw new Error(
        "Couldn't convert this HEIC photo on Windows - this machine may be missing the optional " +
          "\"HEIF Image Extensions\" from the Microsoft Store. Converting the photo to JPEG first " +
          `(e.g. via the Windows Photos app) will work around this. Original error: ${(err as Error).message}`,
      );
    }
  }

  throw new Error(`HEIC photos aren't supported on ${process.platform} yet.`);
}

async function ocrImage(filePath: string): Promise<string> {
  // tesseract.js's cache writer is a plain fs.writeFile - it doesn't create
  // missing parent directories itself, and silently swallows the resulting
  // ENOENT (OCR still works, it just never caches, re-downloading the
  // trained-data file every single call - caught this for real).
  await mkdir(OCR_CACHE_PATH, { recursive: true });
  const worker = await createWorker("eng", undefined, { cachePath: OCR_CACHE_PATH });
  try {
    const { data } = await worker.recognize(filePath);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Gets real, usable text out of any document Khameleon might be asked to
 * read locally: a real PDF's own text layer when it has one (fast, exact),
 * falling back to real on-device OCR (Tesseract) for scanned/photographed
 * PDFs and for direct photo files (JPEG/PNG/HEIC) - a phone photo of a
 * receipt, for instance. Everything here runs on-device; nothing is
 * uploaded anywhere.
 */
export async function extractDocumentText(filePath: string): Promise<ExtractedDocumentText> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const buffer = await readFile(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      // A real text layer with only a handful of characters (or none) is a
      // strong signal this is a scanned PDF with no embedded text - fall
      // back to rendering its pages as images and running OCR on those.
      if (result.text.trim().length > 20) {
        return { text: result.text, source: "pdf-text-layer" };
      }

      const screenshots = await parser.getScreenshot({ scale: 2, imageBuffer: true });
      const texts: string[] = [];
      for (const page of screenshots.pages) {
        if (!page.data) continue;
        const tempDir = await mkdtemp(path.join(tmpdir(), "khameleon-pdf-ocr-"));
        const pagePath = path.join(tempDir, `page-${page.pageNumber}.png`);
        await writeFile(pagePath, page.data);
        texts.push(await ocrImage(pagePath));
      }
      return { text: texts.join("\n\n"), source: "ocr" };
    } finally {
      await parser.destroy();
    }
  }

  if (HEIC_EXTENSIONS.has(ext)) {
    const jpegPath = await convertHeicToJpeg(filePath);
    return { text: await ocrImage(jpegPath), source: "ocr" };
  }

  if (IMAGE_EXTENSIONS.has(ext)) {
    return { text: await ocrImage(filePath), source: "ocr" };
  }

  throw new Error(`Unsupported file type "${ext}" - expected a PDF, or a JPEG/PNG/HEIC photo.`);
}
