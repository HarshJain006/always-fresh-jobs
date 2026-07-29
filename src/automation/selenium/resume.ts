import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { logMsg, logError } from "./logger";

export interface PdfFileDetails {
  path: string;
  bytes: number;
  sha256: string;
  pages: number;
  mtime: string;
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
