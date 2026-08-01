/** Shared schedule rules for expiry / repurchase reminder emails. */

import { calendarDaysRemainingIst } from "@/lib/istCalendar";

export const REPEAT_INTERVAL_DAYS = 3;
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
 * - Then one more every 3 days, up to 5 total
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

/** Days before subscription expiry when each ending-soon email is due (5 sends). */
export const SUBSCRIPTION_ENDING_MILESTONE_DAYS = [12, 9, 6, 3, 0] as const;

/**
 * Before subscription expires (active paid plan):
 * - 5 reminders at ~12, 9, 6, 3, and 0 days remaining
 * - At least 3 days between sends (whichever is later: milestone or interval)
 */
export function nextSubscriptionEndingSequence(
  expireMs: number,
  nowMs: number,
  lastSent: LastSentReminder | null,
): number | null {
  if (!Number.isFinite(expireMs) || nowMs >= expireMs) return null;

  const daysLeft = (expireMs - nowMs) / DAY_MS;

  for (let i = 0; i < SUBSCRIPTION_ENDING_MILESTONE_DAYS.length; i++) {
    const seq = i + 1;
    const milestone = SUBSCRIPTION_ENDING_MILESTONE_DAYS[i];
    if (daysLeft > milestone) continue;

    if (!lastSent) return seq;
    if (lastSent.sequenceNo >= REPEAT_MAX_SENDS) return null;
    if (seq <= lastSent.sequenceNo) continue;
    if (nowMs < lastSent.sentAtMs + REPEAT_INTERVAL_MS) return null;

    return seq;
  }

  return null;
}

/** Free trial: email on second-last day (2 days left) and last day (1 day left). */
export const TRIAL_ENDING_MAX_SENDS = 2;

/**
 * Before free trial expires — exactly 2 emails:
 * - sequence 1 when IST calendar days remaining === 2 (second-last day)
 * - sequence 2 when IST calendar days remaining === 1 (last day)
 */
export function nextTrialEndingSequence(
  trialExpireIso: string,
  nowMs: number,
  lastSent: LastSentReminder | null,
): number | null {
  const expireMs = new Date(trialExpireIso).getTime();
  if (!Number.isFinite(expireMs) || nowMs >= expireMs) return null;

  const daysLeft = calendarDaysRemainingIst(trialExpireIso, new Date(nowMs));
  if (daysLeft !== 2 && daysLeft !== 1) return null;

  const sequenceNo = daysLeft === 2 ? 1 : 2;

  if (!lastSent) return sequenceNo;
  if (lastSent.sequenceNo >= TRIAL_ENDING_MAX_SENDS) return null;
  if (sequenceNo <= lastSent.sequenceNo) return null;

  return sequenceNo;
}
