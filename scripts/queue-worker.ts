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

import cron from "node-cron";
import * as os from "node:os";
import { claimNextJob, completeJob, heartbeatJob, reclaimStaleJobs } from "../src/queue/jobs";
import { isTransientFetchError } from "../src/lib/retry";
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
const RECLAIM_MS = Number(process.env.QUEUE_RECLAIM_MS || 60_000);
const CONCURRENCY = getQueueConcurrency();
const BASE_WORKER_ID = process.env.WORKER_ID || `rpi-${os.hostname()}-${process.pid}`;

/** Avoid double-enqueue for the same IST calendar day. */
let lastEnqueuedForDate: string | null = null;
let lastLoggedPlanKey: string | null = null;
let reclaimInFlight = false;

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

  if (isAfterDynamicStart(plan)) {
    await enqueueDaily(reason);
  }

  return plan;
}

async function safeReclaim(): Promise<void> {
  if (reclaimInFlight) return;
  reclaimInFlight = true;
  try {
    const reclaimed = await reclaimStaleJobs();
    if (reclaimed > 0) {
      console.log(`[worker] Reclaimed ${reclaimed} stale job(s) from crashed workers`);
    }
  } catch (err) {
    console.error("[worker] reclaim error:", err instanceof Error ? err.message : err);
  } finally {
    reclaimInFlight = false;
  }
}

async function processOneJob(workerId: string): Promise<boolean> {
  let job;
  try {
    job = await claimNextJob(workerId, LEASE_SECONDS);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[worker] claim failed (${workerId}):`, msg);
    // Back off harder on transient network issues so we don't stampede
    const delay = isTransientFetchError(err) ? Math.max(POLL_MS, 8_000) : POLL_MS;
    await new Promise((r) => setTimeout(r, delay));
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
    await completeJob(job.id, workerId, result.ok, result.message);
    console.log(`[worker] Done ${job.id}: ${result.ok ? "ok" : "fail"} — ${result.message}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] Job ${job.id} error:`, message);
    try {
      await completeJob(job.id, workerId, false, message);
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

async function pollLoop() {
  console.log(
    `[worker] Queue worker started base=${BASE_WORKER_ID} concurrency=${CONCURRENCY} poll=${POLL_MS}ms lease=${LEASE_SECONDS}s reclaimEvery=${RECLAIM_MS}ms`,
  );

  try {
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
      void maybeEnqueueBySchedule("cron-minute").catch((err) =>
        console.error("[worker] Dynamic enqueue check failed:", err),
      );
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
