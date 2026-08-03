/**
 * Classify automation failures — only wrong Naukri credentials are permanent.
 * Everything else must keep retrying until the resume uploads.
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

/** True when the user must fix Naukri login details before we try again. */
export function isPermanentSetupError(message: string): boolean {
  const lower = (message || "").toLowerCase();
  if (isFatalCredentialError(message)) return true;
  return (
    lower.includes("no naukri credentials saved") ||
    lower.includes("no resume uploaded") ||
    lower.includes("stored password is not encrypted") ||
    lower.includes("could not decrypt naukri password") ||
    lower.includes("automation is not active")
  );
}
