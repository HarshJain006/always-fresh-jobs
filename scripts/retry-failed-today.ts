/**
 * Manually requeue today's failed/dead daily resume jobs (and optionally run them).
 *
 * Smart Pi behaviour:
 * - Wrong password → skip (user must fix in dashboard)
 * - Login-page / upload flake → bounded retries with backoff (not an infinite loop)
 * - Frontend activity only shows success or wrong password
 *
 * Usage:
 *   npm run worker:retry-failed
 *   npm run worker:retry-failed -- --run
 *   npm run worker:retry-failed -- --all --run
 */

import "./load-env";
import * as os from "node:os";
import {
  applyJobFailurePolicy,
  claimNextJob,
  completeJob,
  heartbeatJob,
  requeueDailyJobsForDate,
  summarizeDailyJobsForDate,
} from "../src/queue/jobs";
import { istDateString } from "../src/queue/types";
import { runPlatformForUser } from "../src/automation/worker";

const args = process.argv.slice(2);
const runNow = args.includes("--run");
const includeCompleted = args.includes("--all");
const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
const CONCURRENCY = Math.max(
  1,
  Math.min(4, Number(concurrencyArg?.split("=")[1] || process.env.RETRY_CONCURRENCY || 2)),
);
const LEASE_SECONDS = Number(process.env.QUEUE_LEASE_SECONDS || 900);
const POLL_MS = 5000;
/** Stop --run after this many empty polls (jobs waiting on backoff will be left for systemd worker). */
const IDLE_STOPS = 6;
const BASE_WORKER_ID = `retry-${os.hostname()}-${process.pid}`;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function processOneJob(workerId: string): Promise<boolean> {
  const job = await claimNextJob(workerId, LEASE_SECONDS);
  if (!job) return false;

  console.log(`[retry] Claimed ${job.id} user=${job.user_id} attempt=${job.attempts}/${job.max_attempts}`);

  const heartbeat = setInterval(() => {
    void heartbeatJob(job.id, workerId, LEASE_SECONDS);
  }, Math.max(30_000, Math.floor(LEASE_SECONDS * 1000 * 0.4)));

  try {
    await heartbeatJob(job.id, workerId, LEASE_SECONDS);
    const result = await runPlatformForUser(job.user_id, job.platform, { headless: true });
    if (result.ok) {
      await completeJob(job.id, workerId, true, result.message);
      console.log(`[retry] ${job.id} uploaded OK`);
    } else {
      await completeJob(job.id, workerId, false, result.message);
      const policy = await applyJobFailurePolicy(job.id, result.message);
      if (policy === "dead") {
        console.log(`[retry] ${job.id} stopped — wrong password / setup`);
      } else if (policy === "exhausted") {
        console.log(`[retry] ${job.id} gave up for today — will try tomorrow`);
      } else {
        console.log(`[retry] ${job.id} backend retry scheduled (backoff)`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[retry] Job ${job.id} error:`, message);
    try {
      await completeJob(job.id, workerId, false, message);
      await applyJobFailurePolicy(job.id, message);
    } catch (completeErr) {
      console.error(
        `[retry] complete failed for ${job.id}:`,
        completeErr instanceof Error ? completeErr.message : completeErr,
      );
    }
  } finally {
    clearInterval(heartbeat);
  }

  return true;
}

/**
 * Drain currently available jobs, then exit.
 * Jobs scheduled with future available_at are left for the systemd worker (smart, not busy-loop).
 */
async function runAvailableJobsThenExit() {
  console.log(
    `[retry] Running available jobs (concurrency=${CONCURRENCY}). ` +
      `Backoff waits are handled by systemd worker — this command will not spin forever.`,
  );

  let emptyPolls = 0;

  const slots = Array.from({ length: CONCURRENCY }, (_, i) => {
    const workerId = `${BASE_WORKER_ID}-s${i + 1}`;
    return (async () => {
      for (;;) {
        try {
          const worked = await processOneJob(workerId);
          if (worked) {
            emptyPolls = 0;
            continue;
          }
          emptyPolls++;
          if (emptyPolls >= IDLE_STOPS * CONCURRENCY) return;
          await sleep(POLL_MS);
        } catch (err) {
          console.error(`[retry] Slot error:`, err);
          await sleep(POLL_MS);
        }
      }
    })();
  });

  await Promise.all(slots);
}

async function main() {
  const day = istDateString();
  console.log(
    `[retry] Requeueing ${includeCompleted ? "failed+dead+completed" : "failed+dead"} for ${day}…`,
  );

  const before = await summarizeDailyJobsForDate(day);
  console.log(`[retry] Before:`, before);

  const result = await requeueDailyJobsForDate({
    scheduledFor: day,
    includeCompleted,
    maxAttempts: 8,
  });

  console.log(`[retry] Reset ${result.reset} job(s) to pending (max 8 tries each)`);
  if (result.skippedCredentialFailures > 0) {
    console.log(
      `[retry] Skipped ${result.skippedCredentialFailures} wrong-password / setup failure(s)`,
    );
  }
  for (const j of result.jobs) {
    console.log(`  - ${j.userId} was ${j.previousStatus}`);
  }

  const after = await summarizeDailyJobsForDate(day);
  console.log(`[retry] After requeue:`, after);

  if (!runNow) {
    console.log(
      `\n[retry] Queued. Leave systemd worker running — it retries with backoff (max 8/day).\n` +
        `Wrong password accounts are skipped. Or drain available jobs now:\n` +
        `  npm run worker:retry-failed -- --run\n`,
    );
    return;
  }

  if (result.reset === 0 && after.inFlight === 0) {
    console.log(`[retry] Nothing to run.`);
    return;
  }

  await runAvailableJobsThenExit();

  const final = await summarizeDailyJobsForDate(day);
  console.log(`[retry] Finished this pass. Today's summary:`, final);
  console.log(
    `[retry] Any remaining backoff retries will be picked up by: sudo systemctl status dailyresume-worker`,
  );
}

main().catch((err) => {
  console.error("[retry] Fatal:", err);
  process.exit(1);
});
