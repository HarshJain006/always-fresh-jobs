/**
 * Raspberry Pi queue worker.
 *
 * - Polls Supabase for pending jobs (survives reboots via lease reclaim)
 * - At 8:00 AM IST enqueues today's daily_refresh jobs
 * - On startup after 8 AM IST: catch-up enqueue if Pi was offline at 8
 *
 * Usage:
 *   npm run worker              — poll forever + schedule daily enqueue
 *   npm run worker:once         — process one claimed job (or exit if empty)
 *   npm run worker:enqueue-daily — only enqueue today's daily jobs then exit
 */

import cron from "node-cron";
import * as os from "node:os";
import { claimNextJob, completeJob, heartbeatJob, reclaimStaleJobs } from "../src/queue/jobs";
import {
  enqueueDailyJobsForEligibleUsers,
  isAfterEightAmIst,
} from "../src/queue/enqueueDaily";
import { runPlatformForUser } from "../src/automation/worker";
import { istDateString } from "../src/queue/types";

const once = process.argv.includes("--once");
const enqueueOnly = process.argv.includes("--enqueue-daily");
const POLL_MS = Number(process.env.QUEUE_POLL_MS || 5000);
const LEASE_SECONDS = Number(process.env.QUEUE_LEASE_SECONDS || 900);
const WORKER_ID =
  process.env.WORKER_ID || `rpi-${os.hostname()}-${process.pid}`;

async function enqueueDaily() {
  console.log(`[worker] Enqueueing daily jobs for ${istDateString()}…`);
  const result = await enqueueDailyJobsForEligibleUsers();
  console.log("[worker] Enqueue result:", result);
  return result;
}

async function processOneJob(): Promise<boolean> {
  const reclaimed = await reclaimStaleJobs();
  if (reclaimed > 0) {
    console.log(`[worker] Reclaimed ${reclaimed} stale job(s) from crashed workers`);
  }

  const job = await claimNextJob(WORKER_ID, LEASE_SECONDS);
  if (!job) return false;

  console.log(
    `[worker] Claimed ${job.id} user=${job.user_id} type=${job.job_type} attempt=${job.attempts}`,
  );

  const heartbeat = setInterval(() => {
    void heartbeatJob(job.id, WORKER_ID, LEASE_SECONDS);
  }, Math.max(30_000, Math.floor(LEASE_SECONDS * 1000 * 0.4)));

  try {
    await heartbeatJob(job.id, WORKER_ID, LEASE_SECONDS);
    const result = await runPlatformForUser(job.user_id, job.platform, {
      headless: true,
      updatePdf: true,
    });
    await completeJob(job.id, WORKER_ID, result.ok, result.message);
    console.log(`[worker] Done ${job.id}: ${result.ok ? "ok" : "fail"} — ${result.message}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] Job ${job.id} error:`, message);
    await completeJob(job.id, WORKER_ID, false, message);
  } finally {
    clearInterval(heartbeat);
  }

  return true;
}

async function pollLoop() {
  console.log(`[worker] Queue worker started id=${WORKER_ID} poll=${POLL_MS}ms lease=${LEASE_SECONDS}s`);

  // Catch-up: if Pi boots after 8 AM IST, still enqueue today's jobs
  if (isAfterEightAmIst()) {
    try {
      await enqueueDaily();
    } catch (err) {
      console.error("[worker] Catch-up enqueue failed:", err);
    }
  }

  for (;;) {
    try {
      const worked = await processOneJob();
      if (!worked) {
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      // If we processed a job, immediately try to claim the next (drain queue)
    } catch (err) {
      console.error("[worker] Poll error:", err);
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
}

async function main() {
  if (enqueueOnly) {
    await enqueueDaily();
    process.exit(0);
  }

  if (once) {
    const worked = await processOneJob();
    process.exit(worked ? 0 : 0);
  }

  cron.schedule(
    "0 8 * * *",
    () => {
      void enqueueDaily().catch((err) => console.error("[worker] 8 AM enqueue failed:", err));
    },
    { timezone: "Asia/Kolkata" },
  );
  console.log("[worker] Daily enqueue scheduled for 8:00 AM IST");

  await pollLoop();
}

main().catch((err) => {
  console.error("[worker] Fatal:", err);
  process.exit(1);
});
