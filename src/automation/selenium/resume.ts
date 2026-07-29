import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { PDFDocument, rgb } from "pdf-lib";
import { logMsg, logError } from "./logger";

export interface PdfFileDetails {
  path: string;
  bytes: number;
  sha256: string;
  pages: number;
  mtime: string;
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 1–5 random uppercase/digit characters (mirrors naukri-ts). */
function randomText(): string {
  const len = randomInt(1, 5);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CHARS[randomInt(0, CHARS.length - 1)];
  }
  return out;
}

export async function getPdfFileDetails(filePath: string): Promise<PdfFileDetails> {
  const resolvedPath = path.resolve(filePath);
  const bytes = fs.readFileSync(resolvedPath);
  const stats = fs.statSync(resolvedPath);
  const pdfDoc = await PDFDocument.load(bytes);
  return {
    path: resolvedPath,
    bytes: stats.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    pages: pdfDoc.getPageCount(),
    mtime: stats.mtime.toISOString(),
  };
}

export async function logPdfFileDetails(label: string, filePath: string): Promise<void> {
  try {
    const details = await getPdfFileDetails(filePath);
    logMsg(
      `${label}: path=${details.path}, bytes=${details.bytes}, sha256=${details.sha256}, pages=${details.pages}, mtime=${details.mtime}`,
    );
  } catch (e) {
    logError(e, `logPdfFileDetails(${label})`);
  }
}

/**
 * Stamp an invisible off-page marker so Naukri treats the PDF as a new file.
 * Without this, re-uploading identical bytes often leaves "Uploaded on" unchanged.
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
    const xloc = randomInt(700, 1000); // beyond visible page area
    const fsize = randomInt(1, 10);

    lastPage.drawText(txt, {
      x: xloc,
      y: 100,
      size: fsize,
      color: rgb(1, 1, 1),
    });

    let outputPath = modifiedResumePath;
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
      outputPath = path.join(outputPath, "Naukri_Resume_Updated.pdf");
    }
    if (path.extname(outputPath).toLowerCase() !== ".pdf") {
      outputPath += ".pdf";
    }

    const outDir = path.dirname(outputPath);
    if (outDir && outDir !== ".") {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    logMsg(`Saved modified PDF: ${path.resolve(outputPath)}`);
    await logPdfFileDetails("Generated upload PDF", outputPath);
    return path.resolve(outputPath);
  } catch (e) {
    logError(e, "updateResume");
    return path.resolve(originalResumePath);
  }
}
