/**
 * Sanitize automation messages shown in dashboard Recent activity.
 * Keep infra / Selenium driver noise out of the user-facing log.
 */

export function toUserFacingActivityMessage(raw: string, ok: boolean): string {
  const text = (raw || "").trim();
  if (!text) return ok ? "Resume refresh completed." : "Resume refresh failed.";

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
    return "Resume refresh failed due to a temporary server issue. We'll retry on the next scheduled run.";
  }

  if (
    lower.includes("incorrect username or password") ||
    lower.includes("invalid username") ||
    lower.includes("invalid password") ||
    (lower.includes("login failed") && lower.includes("password"))
  ) {
    return "Naukri login failed — incorrect username or password. Update your Naukri credentials and try again.";
  }

  // Cap very long stack-like messages
  if (text.length > 220) return `${text.slice(0, 200).trim()}…`;
  return text;
}
