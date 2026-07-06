/**
 * Symmetric encryption for sensitive user data (portal credentials, tokens).
 *
 * TODO: Replace with production-grade envelope encryption:
 *   - Master key from KMS / secrets manager
 *   - Per-user data key derived via HKDF
 *   - AES-256-GCM with random IV per record
 */

export async function encryptData(_plaintext: string): Promise<string> {
  // TODO: Real implementation. Do NOT ship this stub to production.
  throw new Error("encryptData: not implemented");
}

export async function decryptData(_ciphertext: string): Promise<string> {
  // TODO: Real implementation.
  throw new Error("decryptData: not implemented");
}
