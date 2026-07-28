/**
 * Raspberry Pi queue worker.
 *
 * - Polls Supabase for pending jobs (survives reboots via lease reclaim)
 * - Runs QUEUE_CONCURRENCY parallel claim loops (default 4 resumes at once)
 * - Start time is DYNAMIC from eligible user count:
 *     minutesNeeded = ceil(users / concurrency) * minutesPerUser + buffer
 *     start = 8:00 AM IST − minutesNeeded
 *   Example: ~27 users @ 4×3 min → starts ~7:40 AM, finishes before 8:00 AM
 * - Recomputes every minute; grows automatically as users increase
 *
 * Usage:
 *   npm run worker              — poll forever + dynamic daily enqueue
 *   npm run worker:once         — process one claimed job (or exit if empty)
 *   npm run worker:enqueue-daily — only enqueue today's daily jobs then exit
 */

import cron from "node-cron";
import * as os from "node:os";
import { claimNextJob, completeJob, heartbeatJob, reclaimStaleJobs } from "../src/queue/jobs";
import {
  enqueueDailyJobsForEligibleUsers,
  getQueueConcurrency,
  isAfterDynamicStart,
  planTodaysEnqueue,
  type DailySchedulePlan,
} from "../src/queue/enqueueDaily";
import { runPlatformForUser } from "../src/automation/worker";
import { istDateString } from "../src/queue/types";

const once = process.argv.includes("--once");
const enqueueOnly = process.argv.includes("--enqueue-daily");
const POLL_MS = Number(process.env.QUEUE_POLL_MS || 5000);
const LEASE_SECONDS = Number(process.env.QUEUE_LEASE_SECONDS || 900);
const CONCURRENCY = getQueueConcurrency();
const BASE_WORKER_ID =
  process.env.WORKER_ID || `rpi-${os.hostname()}-${process.pid}`;

/** Avoid double-enqueue for the same IST calendar day. */
let lastEnqueuedForDate: string | null = null;
let lastLoggedPlanKey: string | null = null;

async function enqueueDaily(reason: string) {
  const day = istDateString();
  if (lastEnqueuedForDate === day) {
    console.log(`[worker] Already enqueued for ${day} — skip (${reason})`);
    return null;
  }

  console.log(`[worker] Enqueueing daily jobs for ${day} (${reason})…`);
  const result = await enqueueDailyJobsForEligibleUsers(day);
  lastEnqueuedForDate = day;
  console.log("[worker] Enqueue result:", result);
  return result;
}

async function maybeEnqueueBySchedule(reason: string): Promise<DailySchedulePlan | null> {
  const plan = await planTodaysEnqueue();
  const planKey = `${istDateString()}:${plan.eligibleUsers}:${plan.startLabel}`;
  if (planKey !== lastLoggedPlanKey) {
    console.log(
      `[worker] Schedule plan: ${plan.eligibleUsers} users → ${plan.batches} batch(es) × ${plan.minutesPerUser} min (+${plan.bufferMinutes} buffer) = ${plan.minutesNeeded} min → start ${plan.startLabel} IST (finish by ${plan.finishLabel})`,
    );
    lastLoggedPlanKey = planKey;
  }

  if (lastEnqueuedForDate === istDateString()) return plan;

  // Once past today's computed start (e.g. 7:40), enqueue once for the day.
  // Late boot after 8 AM still catch-up-enqueues so no one is skipped.
  if (isAfterDynamicStart(plan)) {
    await enqueueDaily(reason);
  }

  return plan;
}

async function processOneJob(workerId: string): Promise<boolean> {
  const reclaimed = await reclaimStaleJobs();
  if (reclaimed > 0) {
    console.log(`[worker] Reclaimed ${reclaimed} stale job(s) from crashed workers`);
  }

  const job = await claimNextJob(workerId, LEASE_SECONDS);
  if (!job) return false;

  console.log(
    `[worker] Claimed ${job.id} user=${job.user_id} type=${job.job_type} attempt=${job.attempts} slot=${workerId}`,
  );

  const heartbeat = setInterval(() => {
    void heartbeatJob(job.id, workerId, LEASE_SECONDS);
  }, Math.max(30_000, Math.floor(LEASE_SECONDS * 1000 * 0.4)));

  try {
    await heartbeatJob(job.id, workerId, LEASE_SECONDS);
    const result = await runPlatformForUser(job.user_id, job.platform, {
      headless: true,
      updatePdf: true,
    });
    await completeJob(job.id, workerId, result.ok, result.message);
    console.log(`[worker] Done ${job.id}: ${result.ok ? "ok" : "fail"} — ${result.message}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] Job ${job.id} error:`, message);
    await completeJob(job.id, workerId, false, message);
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

async function pollLoop() {
  console.log(
    `[worker] Queue worker started base=${BASE_WORKER_ID} concurrency=${CONCURRENCY} poll=${POLL_MS}ms lease=${LEASE_SECONDS}s (dynamic morning start)`,
  );

  // Catch-up on boot if we're already past today's computed start
  try {
    await maybeEnqueueBySchedule("startup-catchup");
  } catch (err) {
    console.error("[worker] Startup schedule check failed:", err);
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => slotLoop(i + 1)));
}

async function main() {
  if (enqueueOnly) {
    await enqueueDaily("manual");
    process.exit(0);
  }

  if (once) {
    const worked = await processOneJob(`${BASE_WORKER_ID}-once`);
    process.exit(worked ? 0 : 0);
  }

  // Every minute: recompute start from live user count and enqueue when due
  cron.schedule(
    "* * * * *",
    () => {
      void maybeEnqueueBySchedule("cron-minute").catch((err) =>
        console.error("[worker] Dynamic enqueue check failed:", err),
      );
    },
    { timezone: "Asia/Kolkata" },
  );
  console.log(
    "[worker] Dynamic enqueue enabled — start time = 8:00 AM IST − (ceil(users/concurrency) × 3 min + buffer)",
  );

  await pollLoop();
}

main().catch((err) => {
  console.error("[worker] Fatal:", err);
  process.exit(1);
});
