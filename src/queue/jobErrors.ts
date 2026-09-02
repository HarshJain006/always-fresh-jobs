/**
 * Classify automation failures.
 * Wrong password is only confirmed from Naukri's on-page error banner.
 * Jobs retry up to JOB_RUN_MAX_ATTEMPTS before pause + email.
 */

export const JOB_RUN_MAX_ATTEMPTS = 3;

function normalizeMessage(message: string): string {
  return (message || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Raw text from Naukri login error banner — must match before we call it wrong password. */
export function isNaukriCredentialBanner(text: string): boolean {
  const lower = normalizeMessage(text);
  if (!lower) return false;

  if (lower.includes("invalid details")) return true;
  if (lower.includes("incorrect username") || lower.includes("incorrect password")) return true;
  if (lower.includes("wrong username") || lower.includes("wrong password")) return true;
  if (lower.includes("invalid username") || lower.includes("invalid password")) return true;
  if (/email id\s*[-–]?\s*password/.test(lower)) return true;
  if (lower.includes("invalid") && lower.includes("password") && lower.includes("id")) return true;

  return false;
}

/** Canonical worker message after a confirmed Naukri credential banner. */
export const CONFIRMED_CREDENTIAL_FAILURE_MESSAGE =
  "Naukri login failed — incorrect username or password. Update your Naukri credentials and try again.";

export function isFatalCredentialError(message: string): boolean {
  const lower = normalizeMessage(message);
  if (!lower) return false;

  if (lower.includes("incorrect username or password") && lower.includes("naukri login failed")) {
    return true;
  }

  // Legacy rows / direct banner text in message field
  return isNaukriCredentialBanner(message);
}

/** True if any provided message indicates wrong Naukri credentials. */
export function isCredentialFailureMessage(...messages: (string | undefined)[]): boolean {
  return messages.some((m) => m && isFatalCredentialError(m));
}

/** True when the user must fix setup before we try again (not retryable). */
export function isPermanentSetupError(message: string): boolean {
  const lower = normalizeMessage(message);
  if (isFatalCredentialError(message)) return false;
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

/** Transient login/upload failures — retry up to JOB_RUN_MAX_ATTEMPTS. */
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
    lower.includes("temporary server issue") ||
    lower.includes("naukri job error")
  );
}

/** Frontend Recent activity: success always; wrong-password only after final failure (queue-worker). */
export function shouldWriteUserActivityLog(ok: boolean, _message: string): boolean {
  return ok;
}
