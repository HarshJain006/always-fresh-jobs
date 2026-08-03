import { isFatalCredentialError } from "@/queue/jobErrors";

/**
 * Messages shown in dashboard Recent activity.
 * Only two outcomes are user-visible: success, or wrong username/password.
 */

export function toUserFacingActivityMessage(raw: string, ok: boolean): string {
  if (ok) {
    return "Resume uploaded successfully.";
  }

  if (isFatalCredentialError(raw)) {
    return "Naukri login failed — incorrect username or password. Update your Naukri credentials and try again.";
  }

  // Retry / infra noise must never appear in the UI
  return "";
}

