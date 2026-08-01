/**
 * ADDED (ATS Score feature) — minimal PDF text extractor.
 *
 * Pulls text out of FlateDecode / plain content streams without native deps,
 * so it works inside the edge runtime. Good enough for ATS keyword scoring.
 * If extraction yields nothing, the caller asks the user to paste text instead.
 */

import { inflateSync } from "node:zlib";

function decodeStreams(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const chunks: string[] = [];
  const re = /stream\r?\n?([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const body = Buffer.from(m[1], "latin1");
    try {
      chunks.push(inflateSync(body).toString("utf8"));
    } catch {
      chunks.push(body.toString("latin1"));
    }
  }
  return chunks.join("\n");
}

function unescapePdfString(s: string): string {
  return s
    .replace(/\\([nrtbf])/g, (_, c) =>
      ({ n: "\n", r: "\n", t: " ", b: "", f: "\n" })[c as string] ?? "",
    )
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
}

export function extractPdfText(data: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const content = decodeStreams(buf);
  const out: string[] = [];

  // TJ arrays: [(Hel) -20 (lo)] TJ
  const tjArray = /\[((?:[^\[\]\\]|\\.)*)\]\s*TJ/g;
  let m: RegExpExecArray | null;
  while ((m = tjArray.exec(content)) !== null) {
    const parts = m[1].match(/\((?:[^()\\]|\\.)*\)/g) ?? [];
    out.push(parts.map((p) => unescapePdfString(p.slice(1, -1))).join(""));
  }

  // Simple Tj strings: (Hello) Tj
  const tj = /\((?:[^()\\]|\\.)*\)\s*Tj/g;
  while ((m = tj.exec(content)) !== null) {
    const s = m[0].slice(0, m[0].lastIndexOf(")") + 1);
    out.push(unescapePdfString(s.slice(1, -1)));
  }

  // Line breaks between text-positioning operators
  return out
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
