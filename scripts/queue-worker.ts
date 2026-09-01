/**
 * Raspberry Pi queue worker.
 *
 * - Polls Supabase for pending jobs (survives reboots via lease reclaim)
 * - Runs QUEUE_CONCURRENCY parallel claim loops (default 4 resumes at once)
 * - Reclaim runs on a single timer (not per-slot) to avoid stampeding Supabase
 * - Claim/reclaim use retries for transient `fetch failed` errors
 * - Start time is DYNAMIC from eligible user count
 *
 * Usage:
 *   npm run worker
 *   npm run worker:once
 *   npm run worker:enqueue-daily
 */

import "./load-env";
import cron from "node-cron";
import * as os from "node:os";
import { claimNextJob, completeJob, heartbeatJob, reclaimStaleJobs, summarizeDailyJobsForDate, applyJobFailurePolicy } from "../src/queue/jobs";
import { requestMailQueueFlush } from "../src/notifications/credentialFailureQueue";
import { isTransientFetchError, withRetry } from "../src/lib/retry";
import {
  enqueueDailyJobsForEligibleUsers,
  getDailyEnqueueStatus,
  getQueueConcurrency,
  isAfterDynamicStart,
  isWithinDynamicEnqueueWindow,
  istMinutesFromMidnight,
  planTodaysEnqueue,
  type DailySchedulePlan,
} from "../src/queue/enqueueDaily";
import { runPlatformForUser } from "../src/automation/worker";
import { flushPendingActivityLogs } from "../src/automation/logs";
import { istDateString } from "../src/queue/types";

const once = process.argv.includes("--once");
const enqueueOnly = process.argv.includes("--enqueue-daily");
const POLL_MS = Number(process.env.QUEUE_POLL_MS || 5000);
const LEASE_SECONDS = Number(process.env.QUEUE_LEASE_SECONDS || 900);
const RECLAIM_MS = Number(process.env.QUEUE_RECLAIM_MS || 60_000);
const MAIL_FLUSH_MS = Math.max(60_000, Number(process.env.QUEUE_MAIL_FLUSH_MS || 180_000));
const CONCURRENCY = getQueueConcurrency();
const BASE_WORKER_ID = process.env.WORKER_ID || `rpi-${os.hostname()}-${process.pid}`;

/** Avoid double-enqueue for the same IST calendar day — only after Supabase confirms. */
let lastEnqueuedForDate: string | null = null;
let lastLoggedPlanKey: string | null = null;
let reclaimInFlight = false;
let lastEnqueueFailLogAt = 0;
let enqueueInFlight = false;

/**
 * Shared cooldown when Supabase is briefly unreachable (common on Pi Wi‑Fi).
 * All 4 slots honor this so we don't stampede a flaky link with parallel claims.
 */
let networkCooldownUntil = 0;
let consecutiveTransientClaims = 0;
let lastTransientClaimLogAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitOutNetworkCooldown(): Promise<void> {
  const wait = networkCooldownUntil - Date.now();
  if (wait > 0) await sleep(wait);
}

function noteTransientNetworkFailure(context: string): number {
  consecutiveTransientClaims += 1;
  const backoffMs = Math.min(
    120_000,
    8_000 * 2 ** Math.min(consecutiveTransientClaims - 1, 4),
  );
  networkCooldownUntil = Date.now() + backoffMs;

  const now = Date.now();
  // At most one warn every 60s — idle evening polls should not fill the journal
  if (now - lastTransientClaimLogAt >= 60_000) {
    console.warn(
      `[worker] Supabase briefly unreachable (${context}) — backing off ${Math.round(backoffMs / 1000)}s. ` +
        `Already-finished jobs are fine; polling will resume automatically.`,
    );
    lastTransientClaimLogAt = now;
  }
  return backoffMs;
}

function clearTransientNetworkFailure(): void {
  consecutiveTransientClaims = 0;
  networkCooldownUntil = 0;
}

/** On Pi boot: read Supabase so we don't enqueue / re-upload after today's run. */
async function bootstrapEnqueueStateFromSupabase(): Promise<void> {
  const day = istDateString();
  try {
    const status = await getDailyEnqueueStatus(day);
    const summary = await summarizeDailyJobsForDate(day);

    if (status.allAccountedFor) {
      lastEnqueuedForDate = day;
      console.log(
        `[worker] ${day}: all ${status.eligible} eligible user(s) already have today's job in Supabase ` +
          `(${status.completed} completed, ${status.inFlight} in-flight) — restart will not re-upload.`,
      );
      return;
    }

    if (summary.completed > 0) {
      console.log(
        `[worker] ${day}: ${summary.completed} resume(s) already uploaded today in Supabase ` +
          `(${summary.inFlight} still in queue). Only missing users will be enqueued.`,
      );
    }
  } catch (err) {
    console.error(
      "[worker] Could not read today's job status from Supabase:",
      err instanceof Error ? err.message : err,
    );
  }
}

async function enqueueDaily(reason: string) {
  const day = istDateString();

  console.log(`[worker] Checking Supabase & enqueueing daily jobs for ${day} (${reason})…`);

  // Retry through Pi DNS blips (EAI_AGAIN) — do NOT mark the day done on failure
  const result = await withRetry(
    `enqueueDaily(${reason})`,
    () => enqueueDailyJobsForEligibleUsers(day),
    { attempts: 5, baseDelayMs: 2000 },
  );

  const hasErrors = result.errors.length > 0;
  if (hasErrors) {
    console.warn(
      `[worker] Enqueue partial for ${day}: ${result.errors.length} error(s). Will retry missing users.`,
      result.errors.slice(0, 5),
    );
    // Do not set lastEnqueuedForDate — cron will catch remaining users
    return result;
  }

  // Confirm against Supabase so a flaky mid-run can't leave users missing
  try {
    const status = await withRetry(
      "getDailyEnqueueStatus",
      () => getDailyEnqueueStatus(day),
      { attempts: 3, baseDelayMs: 1000 },
    );
    if (status.allAccountedFor) {
      lastEnqueuedForDate = day;
      console.log(
        `[worker] Enqueue complete for ${day}: all ${status.eligible} eligible user(s) have a job ` +
          `(+${result.enqueued} new, ${result.alreadyDone} done, ${result.alreadyQueued} queued).`,
      );
    } else {
      console.warn(
        `[worker] Enqueue incomplete for ${day}: ${status.withJob}/${status.eligible} have jobs — will catch up.`,
      );
      // Keep trying next minute
    }
  } catch (err) {
    console.warn(
      `[worker] Could not verify enqueue status after run:`,
      err instanceof Error ? err.message : err,
    );
    // Do NOT mark the day done — catch-up must retry when Supabase is reachable again
  }

  if (result.enqueued === 0 && (result.alreadyDone > 0 || result.alreadyQueued > 0)) {
    console.log(
      `[worker] No new uploads needed for ${day}: ` +
        `${result.alreadyDone} already completed today, ` +
        `${result.alreadyQueued} already queued/attempted, ` +
        `${result.skipped} skipped.`,
    );
  } else {
    console.log("[worker] Enqueue result:", result);
  }
  return result;
}

async function maybeEnqueueBySchedule(reason: string): Promise<DailySchedulePlan | null> {
  if (enqueueInFlight) return null;
  if (Date.now() < networkCooldownUntil) return null;

  enqueueInFlight = true;
  try {
    const plan = await withRetry(
      `planTodaysEnqueue(${reason})`,
      () => planTodaysEnqueue(),
      { attempts: 3, baseDelayMs: 1500 },
    );
    clearTransientNetworkFailure();

    const planKey = `${istDateString()}:${plan.eligibleUsers}:${plan.startLabel}`;
    if (planKey !== lastLoggedPlanKey) {
      console.log(
        `[worker] Schedule plan: ${plan.eligibleUsers} users → ${plan.batches} batch(es) × ${plan.minutesPerUser} min (+${plan.bufferMinutes} buffer) = ${plan.minutesNeeded} min → start ${plan.startLabel} IST (finish by ${plan.finishLabel})`,
      );
      lastLoggedPlanKey = planKey;
    }

    if (!isAfterDynamicStart(plan)) return plan;

    // Even if we think we enqueued, re-check Supabase for missing users (DNS partial failures)
    const day = istDateString();
    if (lastEnqueuedForDate === day) {
      try {
        const status = await getDailyEnqueueStatus(day);
        if (status.allAccountedFor) return plan;
        console.warn(
          `[worker] Catch-up: ${status.withJob}/${status.eligible} jobs present — re-enqueueing missing users.`,
        );
        lastEnqueuedForDate = null;
      } catch (err) {
        if (isTransientFetchError(err)) {
          noteTransientNetworkFailure("enqueue-status");
          return plan;
        }
        throw err;
      }
    }

    // Prefer within morning window, but still catch up after finish+grace until noon IST
    // so overnight DNS outages don't skip the whole day.
    const nowM = istMinutesFromMidnight();
    const catchUpUntil = 12 * 60; // noon IST
    const inWindow = isWithinDynamicEnqueueWindow(plan);
    const lateCatchUp = nowM <= catchUpUntil;

    if (inWindow || lateCatchUp) {
      await enqueueDaily(reason);
    }

    return plan;
  } catch (err) {
    if (isTransientFetchError(err)) {
      noteTransientNetworkFailure(`enqueue(${reason})`);
      const now = Date.now();
      // Avoid flooding journal every minute during DNS outages
      if (now - lastEnqueueFailLogAt >= 60_000) {
        console.warn(
          `[worker] Dynamic enqueue deferred (Supabase/DNS unreachable) — will retry when network recovers.`,
        );
        lastEnqueueFailLogAt = now;
      }
      return null;
    }
    throw err;
  } finally {
    enqueueInFlight = false;
  }
}

async function safeReclaim(): Promise<void> {
  if (reclaimInFlight) return;
  if (Date.now() < networkCooldownUntil) return;
  reclaimInFlight = true;
  try {
    const reclaimed = await reclaimStaleJobs();
    if (reclaimed > 0) {
      console.log(`[worker] Reclaimed ${reclaimed} stale job(s) from crashed workers`);
    }
    // Push any activity logs that failed during a DNS blip
    await flushPendingActivityLogs().catch((err) => {
      if (!isTransientFetchError(err)) {
        console.warn(
          "[worker] pending activity log flush:",
          err instanceof Error ? err.message : err,
        );
      }
    });
    clearTransientNetworkFailure();
  } catch (err) {
    if (isTransientFetchError(err)) {
      noteTransientNetworkFailure("reclaim");
    } else {
      console.error("[worker] reclaim error:", err instanceof Error ? err.message : err);
    }
  } finally {
    reclaimInFlight = false;
  }
}

async function processOneJob(workerId: string): Promise<boolean> {
  await waitOutNetworkCooldown();

  let job;
  try {
    job = await claimNextJob(workerId, LEASE_SECONDS);
    clearTransientNetworkFailure();
  } catch (err) {
    if (isTransientFetchError(err)) {
      const backoffMs = noteTransientNetworkFailure(`claim ${workerId}`);
      await sleep(backoffMs);
      return false;
    }
    console.error(
      `[worker] claim failed (${workerId}):`,
      err instanceof Error ? err.message : String(err),
    );
    await sleep(POLL_MS);
    return false;
  }

  if (!job) return false;

  console.log(
    `[worker] Claimed ${job.id} user=${job.user_id} type=${job.job_type} attempt=${job.attempts} slot=${workerId}`,
  );

  const heartbeat = setInterval(
    () => {
      void heartbeatJob(job.id, workerId, LEASE_SECONDS);
    },
    Math.max(30_000, Math.floor(LEASE_SECONDS * 1000 * 0.4)),
  );

  try {
    await heartbeatJob(job.id, workerId, LEASE_SECONDS);
    const result = await runPlatformForUser(job.user_id, job.platform, {
      headless: true,
    });
    if (result.ok) {
      await completeJob(job.id, workerId, true, result.message);
      console.log(`[worker] ${job.id} uploaded OK`);
    } else {
      await completeJob(job.id, workerId, false, result.message);
      const policy = await applyJobFailurePolicy(job.id, result.message, job.user_id);
      if (policy === "dead") {
        console.log(`[worker] ${job.id} stopped — wrong password / setup (automation paused)`);
      } else if (policy === "exhausted") {
        console.log(`[worker] ${job.id} gave up for today — will try tomorrow`);
      } else {
        console.log(`[worker] ${job.id} backend retry scheduled`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] Job ${job.id} error:`, message);
    try {
      await completeJob(job.id, workerId, false, message);
      const policy = await applyJobFailurePolicy(job.id, message, job.user_id);
      if (policy === "dead") {
        console.log(`[worker] ${job.id} stopped — wrong password / setup (automation paused)`);
      } else if (policy === "exhausted") {
        console.log(`[worker] ${job.id} gave up for today — will try tomorrow`);
      } else {
        console.log(`[worker] ${job.id} backend retry scheduled`);
      }
    } catch (completeErr) {
      console.error(
        `[worker] complete failed for ${job.id}:`,
        completeErr instanceof Error ? completeErr.message : completeErr,
      );
    }
  } finally {
    clearInterval(heartbeat);
  }

  return true;
}

async function slotLoop(slot: number) {
  const workerId = `${BASE_WORKER_ID}-s${slot}`;
  console.log(`[worker] Slot ${slot} ready id=${workerId}`);

  for (;;) {
    try {
      const worked = await processOneJob(workerId);
      if (!worked) {
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    } catch (err) {
      console.error(`[worker] Slot ${slot} poll error:`, err);
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
}

async function safeMailQueueFlush(reason: string): Promise<void> {
  if (!process.env.CRON_SECRET?.trim()) return;
  try {
    const ok = await requestMailQueueFlush();
    if (ok) console.info(`[mail] queue flush ok (${reason})`);
  } catch (err) {
    console.warn(
      `[mail] queue flush failed (${reason}):`,
      err instanceof Error ? err.message : err,
    );
  }
}

async function pollLoop() {
  console.log(
    `[worker] Queue worker started base=${BASE_WORKER_ID} concurrency=${CONCURRENCY} poll=${POLL_MS}ms lease=${LEASE_SECONDS}s reclaimEvery=${RECLAIM_MS}ms`,
  );

  try {
    await bootstrapEnqueueStateFromSupabase();
    await flushPendingActivityLogs().catch(() => undefined);
    await safeMailQueueFlush("startup");
    await maybeEnqueueBySchedule("startup-catchup");
  } catch (err) {
    console.error("[worker] Startup schedule check failed:", err);
  }

  // Single reclaim loop for the whole process (not per slot)
  void (async () => {
    for (;;) {
      await safeReclaim();
      await new Promise((r) => setTimeout(r, RECLAIM_MS));
    }
  })();

  // Retry queued wrong-password emails if Netlify flush failed earlier
  void (async () => {
    for (;;) {
      await safeMailQueueFlush("periodic");
      await new Promise((r) => setTimeout(r, MAIL_FLUSH_MS));
    }
  })();

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => slotLoop(i + 1)));
}

async function main() {
  if (enqueueOnly) {
    await enqueueDaily("manual");
    process.exit(0);
  }

  if (once) {
    await safeReclaim();
    await processOneJob(`${BASE_WORKER_ID}-once`);
    process.exit(0);
  }

  cron.schedule(
    "* * * * *",
    () => {
      void maybeEnqueueBySchedule("cron-minute").catch((err) => {
        if (isTransientFetchError(err)) {
          noteTransientNetworkFailure("cron-enqueue");
          return;
        }
        console.error("[worker] Dynamic enqueue check failed:", err);
      });
    },
    { timezone: "Asia/Kolkata" },
  );
  console.log(
    "[worker] Dynamic enqueue enabled — start = 8:00 AM IST − (ceil(users/concurrency) × 3 min + buffer)",
  );

  await pollLoop();
}

main().catch((err) => {
  console.error("[worker] Fatal:", err);
  process.exit(1);
});
