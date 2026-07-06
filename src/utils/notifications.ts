/**
 * Notification service placeholder.
 *
 * TODO: Wire to email (Resend, SES), push, or Telegram (see uploaded Telegram_notify.py).
 */

export type NotificationKind =
  | "resume_updated"
  | "update_failed"
  | "subscription_expiring"
  | "subscription_expired"
  | "trial_ending";

export interface NotificationInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
}

export async function notify(input: NotificationInput): Promise<void> {
  // TODO: dispatch via user's chosen channel(s).
  console.log(`[notify:${input.kind}] ${input.userId} — ${input.title}`);
}
