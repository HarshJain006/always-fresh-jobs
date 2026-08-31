/**
 * Daily email send cap (Resend-safe at scale) + priority tiers.
 *
 * Max 95 emails per IST calendar day. Overflow is queued for the next day.
 * Priority (lowest number = sent first):
 *   1 — wrong Naukri username/password
 *   2 — free trial ended (win-back)
 *   3 — subscription ending soon (renew)
 *   4 — trial ending soon, subscription expired win-back
 *   5 — purchase confirmation
 */

import { istYmd } from "@/lib/istCalendar";
import { getSupabaseServer } from "@/lib/supabase";

export const DAILY_EMAIL_CAP = clampInt(Number(process.env.DAILY_EMAIL_CAP ?? 95), 1, 95, 95);

export type MailCategory =
  | "naukri_credentials_failed"
  | "trial_expired_repurchase"
  | "subscription_ending"
  | "trial_ending"
  | "subscription_expired_repurchase"
  | "subscription_purchased"
  | "welcome_thank_you"
  | "expired_access_reengage";

/** Lower number = higher priority. */
export const EMAIL_SEND_PRIORITY: Record<MailCategory, number> = {
  naukri_credentials_failed: 1,
  trial_expired_repurchase: 2,
  subscription_ending: 3,
  trial_ending: 4,
  subscription_expired_repurchase: 4,
  subscription_purchased: 5,
  welcome_thank_you: 6,
  expired_access_reengage: 6,
};

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/** Midnight IST for the given instant, as UTC ISO timestamp. */
export function istDayStartIso(now = new Date()): string {
  const { y, m, d } = istYmd(now);
  const utcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

export function istDayEndIso(now = new Date()): string {
  const startMs = new Date(istDayStartIso(now)).getTime();
  return new Date(startMs + 24 * 60 * 60 * 1000).toISOString();
}

/** Reserved slots during a single cron/worker batch (before DB rows show sent). */
let batchReserved = 0;

export function resetEmailBatchCounter(): void {
  batchReserved = 0;
}

export function releaseReservedEmailSlot(): void {
  if (batchReserved > 0) batchReserved--;
}

/** Count successful sends since midnight IST. */
export async function countEmailsSentTodayIst(): Promise<number> {
  const start = istDayStartIso();
  const end = istDayEndIso();
  const { count, error } = await getSupabaseServer()
    .from("email_reminder_events")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", start)
    .lt("sent_at", end);

  if (error) {
    console.error("[mail] count sent today failed:", error.message);
    return DAILY_EMAIL_CAP;
  }
  return count ?? 0;
}

export async function remainingSlotsToday(): Promise<number> {
  const sent = await countEmailsSentTodayIst();
  return Math.max(0, DAILY_EMAIL_CAP - sent - batchReserved);
}

/** Reserve one slot for today. Returns false when daily cap (95) is reached. */
export async function reserveEmailSlot(): Promise<boolean> {
  const remaining = await remainingSlotsToday();
  if (remaining <= 0) return false;
  batchReserved++;
  return true;
}

export function compareEmailPriority(a: MailCategory, b: MailCategory): number {
  return EMAIL_SEND_PRIORITY[a] - EMAIL_SEND_PRIORITY[b];
}
