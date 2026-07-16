import * as fs from "node:fs";
import * as path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import { logMsg, logError } from "./logger";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomText(): string {
  const len = randomInt(1, 5);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CHARS[randomInt(0, CHARS.length - 1)];
  }
  return out;
}

function resolveOutputPath(modifiedResumePath: string): string {
  let outPath = modifiedResumePath;
  try {
    if (fs.existsSync(outPath) && fs.statSync(outPath).isDirectory()) {
      outPath = path.join(outPath, "Naukri_Resume_Updated.pdf");
    }
  } catch {
    // treat as a plain file path
  }
  if (path.extname(outPath).toLowerCase() !== ".pdf") {
    outPath += ".pdf";
  }
  return outPath;
}

/**
 * Stamps a tiny off-page marker so Naukri treats the file as changed.
 * Falls back to the original path on failure.
 */
export async function updateResume(
  originalResumePath: string,
  modifiedResumePath: string,
): Promise<string> {
  try {
    const existingPdfBytes = fs.readFileSync(originalResumePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const pageCount = pages.length;
    logMsg(`Found ${pageCount} pages in PDF`);

    const lastPage = pages[pageCount - 1];
    const txt = randomText();
    const xloc = randomInt(700, 1000);
    const fsize = randomInt(1, 10);

    lastPage.drawText(txt, {
      x: xloc,
      y: 100,
      size: fsize,
      color: rgb(1, 1, 1),
    });

    const outputPath = resolveOutputPath(modifiedResumePath);
    const outDir = path.dirname(outputPath);
    if (outDir && outDir !== ".") {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    logMsg(`Saved modified PDF: ${outputPath}`);
    return path.resolve(outputPath);
  } catch (e) {
    logError(e, "updateResume");
    return path.resolve(originalResumePath);
  }
}
