/**
 * Shrink PDFs before upload using pdf-lib re-serialization.
 * Falls back to the original bytes if compression fails or grows the file.
 */

import { PDFDocument } from "pdf-lib";

export interface CompressResult {
  buffer: Buffer;
  originalBytes: number;
  storedBytes: number;
  compressed: boolean;
}

export async function compressPdfBuffer(input: Buffer): Promise<CompressResult> {
  const originalBytes = input.length;
  try {
    const doc = await PDFDocument.load(input, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    // Strip common metadata blobs (saves a few KB on some exports)
    try {
      doc.setTitle("");
      doc.setAuthor("");
      doc.setSubject("");
      doc.setKeywords([]);
      doc.setProducer("");
      doc.setCreator("");
    } catch {
      // non-fatal
    }

    const bytes = await doc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const out = Buffer.from(bytes);
    if (out.length < originalBytes) {
      return {
        buffer: out,
        originalBytes,
        storedBytes: out.length,
        compressed: true,
      };
    }
  } catch (err) {
    console.warn("compressPdfBuffer:", err);
  }

  return {
    buffer: input,
    originalBytes,
    storedBytes: originalBytes,
    compressed: false,
  };
}
