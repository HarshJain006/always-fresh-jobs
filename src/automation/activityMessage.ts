/**
 * Sanitize automation messages shown in dashboard Recent activity.
 * Keep only simple user-facing outcome messages.
 */

export function toUserFacingActivityMessage(raw: string, ok: boolean): string {
  return ok ? "Resume uploaded successfully." : "Failed to upload resume.";
}
