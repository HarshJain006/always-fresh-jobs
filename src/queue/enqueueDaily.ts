/**
 * Enqueue daily refresh jobs for all eligible users (does NOT run Selenium).
 *
 * Start time is dynamic:
 *   batches = ceil(eligibleUsers / concurrency)
 *   minutesNeeded = batches * minutesPerUser + buffer
 *   start = finishBy (8:00 AM IST) − minutesNeeded
 *
 * Example: 27 users, 4 workers, 3 min/user → ceil(27/4)=7 batches → 21 min + buffer
 * → starts ~7:34–7:40 AM so work finishes before 8:00 AM.
 */

import { listActiveAutomationUsers } from "@/database/userAutomation";
import { getAuthoritativeAccess } from "@/security/accessControl";
import { enqueueJob } from "@/queue/jobs";
import { istDateString } from "@/queue/types";

export interface EnqueueDailyResult {
  scheduledFor: string;
  enqueued: number;
  skipped: number;
  alreadyQueued: number;
  errors: string[];
}

export interface DailySchedulePlan {
  eligibleUsers: number;
  concurrency: number;
  minutesPerUser: number;
  bufferMinutes: number;
  batches: number;
  minutesNeeded: number;
  /** Minutes from midnight IST when enqueue should begin */
  startMinutesFromMidnight: number;
  /** Minutes from midnight IST when work should be done */
  finishMinutesFromMidnight: number;
  startLabel: string;
  finishLabel: string;
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function getQueueConcurrency(): number {
  return clampInt(Number(process.env.QUEUE_CONCURRENCY ?? 4), 1, 8, 4);
}

export function getMinutesPerUser(): number {
  return clampInt(Number(process.env.QUEUE_MINUTES_PER_USER ?? 3), 1, 30, 3);
}

export function getBufferMinutes(): number {
  return clampInt(Number(process.env.QUEUE_BUFFER_MINUTES ?? 5), 0, 60, 5);
}

/** Target finish time — default 8:00 AM IST */
export function getFinishMinutesFromMidnight(): number {
  const hour = clampInt(Number(process.env.QUEUE_FINISH_HOUR_IST ?? 8), 1, 12, 8);
  const minute = clampInt(Number(process.env.QUEUE_FINISH_MINUTE_IST ?? 0), 0, 59, 0);
  return hour * 60 + minute;
}

/** Earliest allowed start (default 2:00 AM IST) so a huge queue can't start at midnight chaos */
export function getEarliestStartMinutesFromMidnight(): number {
  const hour = clampInt(Number(process.env.QUEUE_EARLIEST_HOUR_IST ?? 2), 0, 7, 2);
  return hour * 60;
}

export function formatIstHm(minutesFromMidnight: number): string {
  const m = ((minutesFromMidnight % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function istHourMinute(now = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  return {
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? -1),
    minute: Number(parts.find((p) => p.type === "minute")?.value ?? -1),
  };
}

export function istMinutesFromMidnight(now = new Date()): number {
  const { hour, minute } = istHourMinute(now);
  return hour * 60 + minute;
}

/**
 * Compute when today's batch should start so it finishes by 8:00 AM IST.
 */
export function computeDailySchedule(
  eligibleUsers: number,
  options?: {
    concurrency?: number;
    minutesPerUser?: number;
    bufferMinutes?: number;
    finishMinutesFromMidnight?: number;
    earliestStartMinutesFromMidnight?: number;
  },
): DailySchedulePlan {
  const concurrency = options?.concurrency ?? getQueueConcurrency();
  const minutesPerUser = options?.minutesPerUser ?? getMinutesPerUser();
  const bufferMinutes = options?.bufferMinutes ?? getBufferMinutes();
  const finishMinutesFromMidnight =
    options?.finishMinutesFromMidnight ?? getFinishMinutesFromMidnight();
  const earliestStartMinutesFromMidnight =
    options?.earliestStartMinutesFromMidnight ?? getEarliestStartMinutesFromMidnight();

  const users = Math.max(0, Math.floor(eligibleUsers));
  const batches = users === 0 ? 0 : Math.ceil(users / concurrency);
  const minutesNeeded = batches === 0 ? 0 : batches * minutesPerUser + bufferMinutes;

  let startMinutesFromMidnight = finishMinutesFromMidnight - minutesNeeded;
  if (startMinutesFromMidnight < earliestStartMinutesFromMidnight) {
    startMinutesFromMidnight = earliestStartMinutesFromMidnight;
  }
  // Never start at/after finish time
  if (startMinutesFromMidnight >= finishMinutesFromMidnight) {
    startMinutesFromMidnight = Math.max(
      earliestStartMinutesFromMidnight,
      finishMinutesFromMidnight - Math.max(minutesPerUser, 1),
    );
  }

  return {
    eligibleUsers: users,
    concurrency,
    minutesPerUser,
    bufferMinutes,
    batches,
    minutesNeeded,
    startMinutesFromMidnight,
    finishMinutesFromMidnight,
    startLabel: formatIstHm(startMinutesFromMidnight),
    finishLabel: formatIstHm(finishMinutesFromMidnight),
  };
}

async function isUserEligibleForDaily(u: {
  userId: string;
  credentials: unknown;
  resume: unknown;
  platforms: { id: string; connected: boolean }[];
}): Promise<boolean> {
  if (!u.credentials || !u.resume) return false;
  const naukri = u.platforms.find((p) => p.id === "naukri");
  if (!naukri?.connected) return false;
  try {
    const access = await getAuthoritativeAccess(u.userId);
    return access.allowed;
  } catch {
    return false;
  }
}

/** Count users who would get a daily_refresh job today. */
export async function countEligibleDailyUsers(): Promise<number> {
  const active = await listActiveAutomationUsers();
  let count = 0;
  for (const u of active) {
    if (await isUserEligibleForDaily(u)) count++;
  }
  return count;
}

export async function planTodaysEnqueue(): Promise<DailySchedulePlan> {
  const eligibleUsers = await countEligibleDailyUsers();
  return computeDailySchedule(eligibleUsers);
}

/**
 * True when IST time is at/after today's dynamic start and before finish (+ small grace).
 * Used by Pi worker and optional Netlify cron GET.
 */
export function isWithinDynamicEnqueueWindow(
  plan: DailySchedulePlan,
  now = new Date(),
): boolean {
  const nowM = istMinutesFromMidnight(now);
  // Allow enqueue from start until finish + 30 min grace (catch late boots)
  const endGrace = plan.finishMinutesFromMidnight + 30;
  return nowM >= plan.startMinutesFromMidnight && nowM <= endGrace;
}

/** True if IST is at/after today's computed start (catch-up). */
export function isAfterDynamicStart(plan: DailySchedulePlan, now = new Date()): boolean {
  return istMinutesFromMidnight(now) >= plan.startMinutesFromMidnight;
}

export async function enqueueDailyJobsForEligibleUsers(
  scheduledFor = istDateString(),
): Promise<EnqueueDailyResult> {
  const active = await listActiveAutomationUsers();
  const result: EnqueueDailyResult = {
    scheduledFor,
    enqueued: 0,
    skipped: 0,
    alreadyQueued: 0,
    errors: [],
  };

  for (const u of active) {
    if (!(await isUserEligibleForDaily(u))) {
      result.skipped++;
      continue;
    }

    try {
      const q = await enqueueJob({
        userId: u.userId,
        platform: "naukri",
        jobType: "daily_refresh",
        scheduledFor,
      });

      if (q.alreadyQueued) result.alreadyQueued++;
      else result.enqueued++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${u.userId}: ${msg}`);
    }
  }

  return result;
}

/** @deprecated fixed-hour helpers — kept for older imports */
export function getEnqueueHourIst(): number {
  return clampInt(Number(process.env.QUEUE_ENQUEUE_HOUR_IST ?? 5), 0, 7, 5);
}

export function isEnqueueWindowIst(now = new Date()): boolean {
  const { hour, minute } = istHourMinute(now);
  return hour === getEnqueueHourIst() && minute < 5;
}

export function isEightAmIstWindow(now = new Date()): boolean {
  return isEnqueueWindowIst(now);
}

export function isAfterEnqueueHourIst(now = new Date()): boolean {
  const { hour, minute } = istHourMinute(now);
  const enqueueHour = getEnqueueHourIst();
  return hour > enqueueHour || (hour === enqueueHour && minute >= 0);
}

export function isAfterEightAmIst(now = new Date()): boolean {
  return isAfterEnqueueHourIst(now);
}
