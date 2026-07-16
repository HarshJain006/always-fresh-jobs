/**
 * Enqueue daily refresh jobs for all eligible users (does NOT run Selenium).
 * Safe to call from Netlify cron OR Raspberry Pi at 8:00 AM IST / catch-up.
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
    if (!u.credentials || !u.resume) {
      result.skipped++;
      continue;
    }
    const naukri = u.platforms.find((p) => p.id === "naukri");
    if (!naukri?.connected) {
      result.skipped++;
      continue;
    }

    try {
      const access = await getAuthoritativeAccess(u.userId);
      if (!access.allowed) {
        result.skipped++;
        continue;
      }

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

/** True when current time in IST is within the 8:00–8:04 window. */
export function isEightAmIstWindow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? -1);
  return hour === 8 && minute < 5;
}

/** True if IST time is at/after 8:00 today (for catch-up after Pi was offline). */
export function isAfterEightAmIst(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? -1);
  return hour > 8 || (hour === 8 && minute >= 0);
}
