/**
 * Classify automation failures.
 * Retry only flaky Naukri login-page / upload failures.
 * Wrong password (and missing setup) stop permanently.
 */

function normalizeMessage(message: string): string {
  return (message || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Naukri wrong-credentials / login-failure phrases (incl. UI banner variants). */
const CREDENTIAL_FAILURE_PHRASES = [
  "incorrect username or password",
  "invalid username or password",
  "invalid username",
  "invalid password",
  "invalid id password",
  "invalid email id password",
  "invalid email id",
  "email id password",
  "email id - password",
  "email id – password",
  "invalid details",
  "wrong password",
  "wrong username",
  "naukri login failed",
] as const;

export function isFatalCredentialError(message: string): boolean {
  const lower = normalizeMessage(message);
  if (!lower) return false;

  if (CREDENTIAL_FAILURE_PHRASES.some((p) => lower.includes(p))) return true;

  if (
    lower.includes("login failed") &&
    (lower.includes("password") ||
      lower.includes("username") ||
      lower.includes("credential") ||
      lower.includes("email id"))
  ) {
    return true;
  }

  // Naukri banners like "Invalid Email ID / Password" → "invalid id password"
  if (
    lower.includes("invalid") &&
    lower.includes("password") &&
    (lower.includes("id") || lower.includes("email") || lower.includes("username"))
  ) {
    return true;
  }

  return false;
}

/** True if any provided message indicates wrong Naukri credentials. */
export function isCredentialFailureMessage(...messages: (string | undefined)[]): boolean {
  return messages.some((m) => m && isFatalCredentialError(m));
}

/** True when the user must fix Naukri login details / setup before we try again. */
export function isPermanentSetupError(message: string): boolean {
  const lower = normalizeMessage(message);
  if (isFatalCredentialError(message)) return true;
  return (
    lower.includes("no naukri credentials saved") ||
    lower.includes("no resume uploaded") ||
    lower.includes("stored password is not encrypted") ||
    lower.includes("could not decrypt naukri password") ||
    lower.includes("automation is not active") ||
    lower.includes("plan has ended") ||
    lower.includes("account suspended")
  );
}

/**
 * Only these transient failures should auto-retry.
 * Matches: login page did not load / failed to upload.
 */
export function isRetryableUploadError(message: string): boolean {
  const lower = normalizeMessage(message);
  if (isFatalCredentialError(message) || isPermanentSetupError(message)) return false;

  return (
    lower.includes("login page did not load") ||
    lower.includes("could not be confirmed") ||
    lower.includes("login error — will retry") ||
    lower.includes("failed to upload") ||
    lower.includes("could not be verified") ||
    lower.includes("upload could not be verified") ||
    lower.includes("could not find any usable") ||
    lower.includes("temporary server issue")
  );
}

/** Frontend Recent activity: only success or wrong-password — never retry noise. */
export function shouldWriteUserActivityLog(ok: boolean, message: string): boolean {
  if (ok) return true;
  return isFatalCredentialError(message);
}
