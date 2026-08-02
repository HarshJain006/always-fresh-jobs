/**
 * Sanitize automation messages shown in dashboard Recent activity.
 * Keep infra / Selenium driver noise out; keep actionable user messages.
 */

export function toUserFacingActivityMessage(raw: string, ok: boolean): string {
  const text = (raw || "").trim();
  if (!text) return ok ? "Resume uploaded successfully." : "Failed to upload resume.";

  if (ok) {
    if (/resume updated|upload successful|uploaded on/i.test(text)) {
      return text.length > 180 ? `${text.slice(0, 160).trim()}…` : text;
    }
    return "Resume uploaded successfully.";
  }

  const lower = text.toLowerCase();

  if (
    lower.includes("selenium-manager") ||
    lower.includes("browser driver") ||
    lower.includes("chromedriver") ||
    lower.includes("unable to obtain browser") ||
    lower.includes("webdriver") ||
    lower.includes("syntax error") ||
    lower.includes("/var/task") ||
    lower.includes("enoent")
  ) {
    return "Resume refresh failed due to a temporary server issue — will retry.";
  }

  if (
    lower.includes("incorrect username or password") ||
    lower.includes("invalid username") ||
    lower.includes("invalid password") ||
    lower.includes("invalid details") ||
    (lower.includes("login failed") && lower.includes("password"))
  ) {
    return "Naukri login failed — incorrect username or password. Update your Naukri credentials and try again.";
  }

  if (
    lower.includes("login page did not load") ||
    lower.includes("could not be confirmed") ||
    lower.includes("will retry")
  ) {
    return "Naukri login page did not load correctly — will retry.";
  }

  if (lower.includes("could not be verified") || lower.includes("upload")) {
    return "Failed to upload resume — will retry.";
  }

  if (text.length > 220) return `${text.slice(0, 200).trim()}…`;
  return text;
}
