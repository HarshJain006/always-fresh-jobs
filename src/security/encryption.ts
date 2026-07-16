/**
 * Local AES-256-GCM encryption for portal credentials.
 * ENCRYPTION_KEY (32+ chars) is required — no default, never VITE_*.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || "";
  if (!raw || raw.length < 32) {
    throw new Error(
      "ENCRYPTION_KEY must be set to a secret of at least 32 characters (server-only).",
    );
  }
  if (raw.includes("dailyresume-dev-only") || raw === "changeme") {
    throw new Error("Refusing insecure ENCRYPTION_KEY value.");
  }
  return createHash("sha256").update(raw).digest();
}

/** Returns base64(iv):base64(tag):base64(ciphertext) */
export async function encryptData(plaintext: string): Promise<string> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export async function decryptData(ciphertext: string): Promise<string> {
  const [ivB64, tagB64, dataB64] = ciphertext.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("decryptData: invalid ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function isEncryptedSecret(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}
