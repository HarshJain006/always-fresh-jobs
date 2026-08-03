/**
 * Classify automation failures.
 * Retry only flaky Naukri login-page / upload failures.
 * Wrong password (and missing setup) stop permanently.
 */

export function isFatalCredentialError(message: string): boolean {
  const lower = (message || "").toLowerCase();
  return (
    lower.includes("incorrect username or password") ||
    lower.includes("invalid username or password") ||
    lower.includes("invalid details") ||
    (lower.includes("login failed") &&
      (lower.includes("password") || lower.includes("username") || lower.includes("credential")))
  );
}

/** True when the user must fix Naukri login details / setup before we try again. */
export function isPermanentSetupError(message: string): boolean {
  const lower = (message || "").toLowerCase();
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
  const lower = (message || "").toLowerCase();
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
