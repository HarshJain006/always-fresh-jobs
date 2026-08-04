import { isFatalCredentialError } from "@/queue/jobErrors";

/**
 * Messages shown in dashboard Recent activity.
 * Only two outcomes are user-visible: success, or wrong username/password.
 */

export function toUserFacingActivityMessage(raw: string, ok: boolean): string {
  if (ok) {
    // Keep Naukri "Uploaded on …" date when present — still a clear success line
    const uploaded = (raw || "").match(/Uploaded on\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}/i);
    if (uploaded) {
      return `Resume uploaded successfully (${uploaded[0]}).`;
    }
    return "Resume uploaded successfully.";
  }

  if (isFatalCredentialError(raw)) {
    return "Naukri login failed — incorrect username or password. Update your Naukri credentials and try again.";
  }

  // Retry / infra noise must never appear in the UI
  return "";
}
