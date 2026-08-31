/** Shared schedule rules for expiry / repurchase reminder emails. */

import { calendarDaysRemainingIst } from "@/lib/istCalendar";

/** Days between repurchase / win-back emails after trial or plan expires. */
export const REPEAT_INTERVAL_DAYS = 2;
export const REPEAT_MAX_SENDS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
export const REPEAT_INTERVAL_MS = REPEAT_INTERVAL_DAYS * DAY_MS;

export type LastSentReminder = {
  sequenceNo: number;
  sentAtMs: number;
};

/**
 * After access ends (trial or paid plan expired):
 * - Send #1 on or after the anchor (expiry moment)
 * - Then one more every REPEAT_INTERVAL_DAYS, up to 5 total
 * - Never skip a sequence if cron missed a day (uses last sent + interval)
 */
export function nextRepurchaseSequence(
  anchorMs: number,
  nowMs: number,
  lastSent: LastSentReminder | null,
): number | null {
  if (!Number.isFinite(anchorMs) || nowMs < anchorMs) return null;

  if (!lastSent) return 1;
  if (lastSent.sequenceNo >= REPEAT_MAX_SENDS) return null;
  if (nowMs < lastSent.sentAtMs + REPEAT_INTERVAL_MS) return null;

  return lastSent.sequenceNo + 1;
}

/**
 * Before subscription expires (active paid plan):
 * 4 reminders at 7, 3, 1, and 0 days remaining (IST calendar days).
 * Focused on actionable windows — better for 1–3 month plans than 12/9/6/3/0.
 */
export const SUBSCRIPTION_ENDING_MILESTONE_DAYS = [7, 3, 1, 0] as const;
export const SUBSCRIPTION_ENDING_MAX_SENDS = SUBSCRIPTION_ENDING_MILESTONE_DAYS.length;

export function nextSubscriptionEndingSequence(
  expireMs: number,
  nowMs: number,
  lastSent: LastSentReminder | null,
): number | null {
  if (!Number.isFinite(expireMs) || nowMs >= expireMs) return null;

  const daysLeft = calendarDaysRemainingIst(new Date(expireMs).toISOString(), new Date(nowMs));

  for (let i = 0; i < SUBSCRIPTION_ENDING_MILESTONE_DAYS.length; i++) {
    const seq = i + 1;
    const milestone = SUBSCRIPTION_ENDING_MILESTONE_DAYS[i];
    if (daysLeft > milestone) continue;

    if (!lastSent) return seq;
    if (lastSent.sequenceNo >= SUBSCRIPTION_ENDING_MAX_SENDS) return null;
    if (seq <= lastSent.sequenceNo) continue;
    if (nowMs < lastSent.sentAtMs + REPEAT_INTERVAL_MS) return null;

    return seq;
  }

  return null;
}

/** Free trial (5 days): warn at 3, 2, and 1 calendar days remaining. */
export const TRIAL_ENDING_MILESTONE_DAYS = [3, 2, 1] as const;
export const TRIAL_ENDING_MAX_SENDS = TRIAL_ENDING_MILESTONE_DAYS.length;

/**
 * Before free trial expires — 3 emails at 3, 2, and 1 IST calendar days left.
 * Cron should run once daily (~9–10 AM IST) so each milestone is caught.
 */
export function nextTrialEndingSequence(
  trialExpireIso: string,
  nowMs: number,
  lastSent: LastSentReminder | null,
): number | null {
  const expireMs = new Date(trialExpireIso).getTime();
  if (!Number.isFinite(expireMs) || nowMs >= expireMs) return null;

  const daysLeft = calendarDaysRemainingIst(trialExpireIso, new Date(nowMs));
  const milestoneIndex = TRIAL_ENDING_MILESTONE_DAYS.indexOf(
    daysLeft as (typeof TRIAL_ENDING_MILESTONE_DAYS)[number],
  );
  if (milestoneIndex < 0) return null;

  const sequenceNo = milestoneIndex + 1;

  if (!lastSent) return sequenceNo;
  if (lastSent.sequenceNo >= TRIAL_ENDING_MAX_SENDS) return null;
  if (sequenceNo <= lastSent.sequenceNo) return null;

  return sequenceNo;
}

/** IST calendar days left for trial-ending copy (3, 2, or 1). */
export function trialEndingDaysLeft(trialExpireIso: string, nowMs = Date.now()): number {
  return calendarDaysRemainingIst(trialExpireIso, new Date(nowMs));
}
