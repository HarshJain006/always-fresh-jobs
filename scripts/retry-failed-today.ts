/**
 * Manually requeue / run today's daily resume jobs.
 *
 * Usage on the Pi:
 *   npm run worker:retry-failed
 *   npm run worker:retry-failed -- --run
 *   npm run worker:retry-failed -- --all --run
 *
 * Backend robustness test (re-upload EVERYONE today, no user-facing activity logs):
 *   sudo systemctl stop dailyresume-worker
 *   npm run worker:retry-failed -- --test-backend --run
 *   sudo systemctl start dailyresume-worker
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
import { getQueueConcurrency } from "../src/queue/enqueueDaily";
import { istDateString } from "../src/queue/types";
import { runPlatformForUser } from "../src/automation/worker";

const args = process.argv.slice(2);
const runNow = args.includes("--run");
const includeCompleted = args.includes("--all");
const testBackend = args.includes("--test-backend");
const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
// Match production worker slots (QUEUE_CONCURRENCY, default 4) so --test-backend
// exercises the real parallel path (login gate + unique Chrome profiles).
const CONCURRENCY = Math.max(
  1,
  Math.min(
    8,
    Number(
      concurrencyArg?.split("=")[1] ||
        process.env.RETRY_CONCURRENCY ||
        getQueueConcurrency(),
    ),
  ),
);
const LEASE_SECONDS = Number(process.env.QUEUE_LEASE_SECONDS || 900);
const POLL_MS = 5000;
const IDLE_STOPS = testBackend ? 12 : 6;
const BASE_WORKER_ID = `retry-${os.hostname()}-${process.pid}`;
const silentUserLogs = testBackend;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function processOneJob(workerId: string): Promise<boolean> {
  const job = await claimNextJob(workerId, LEASE_SECONDS);
  if (!job) return false;

  console.log(
    `[retry] Claimed ${job.id} user=${job.user_id} attempt=${job.attempts}/${job.max_attempts}` +
      (silentUserLogs ? " (test-backend, no user logs)" : ""),
  );

  const heartbeat = setInterval(() => {
    void heartbeatJob(job.id, workerId, LEASE_SECONDS);
  }, Math.max(30_000, Math.floor(LEASE_SECONDS * 1000 * 0.4)));

  try {
    await heartbeatJob(job.id, workerId, LEASE_SECONDS);
    const result = await runPlatformForUser(job.user_id, job.platform, {
      headless: true,
      skipUserActivityLog: silentUserLogs,
    });
    if (result.ok) {
      await completeJob(job.id, workerId, true, result.message);
      console.log(`[retry] ${job.id} OK — ${result.message}`);
    } else {
      await completeJob(job.id, workerId, false, result.message);
      const policy = await applyJobFailurePolicy(job.id, result.message, job.user_id);
      console.log(
        `[retry] ${job.id} FAIL — ${result.message} → ${policy}` +
          (silentUserLogs ? " (not written to user activity)" : ""),
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[retry] Job ${job.id} error:`, message);
    try {
      await completeJob(job.id, workerId, false, message);
      await applyJobFailurePolicy(job.id, message, job.user_id);
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

async function runAvailableJobsThenExit() {
  console.log(
    `[retry] Running available jobs (concurrency=${CONCURRENCY})` +
      (silentUserLogs ? " [TEST-BACKEND: silent to users]" : ""),
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

  if (testBackend) {
    console.log(
      `[retry] TEST-BACKEND mode for ${day}: requeue ALL today's jobs, re-upload with ` +
        `${CONCURRENCY} parallel slots (same as production), NO dashboard Recent activity writes.`,
    );
  } else {
    console.log(
      `[retry] Requeueing ${includeCompleted ? "failed+dead+completed" : "failed+dead"} for ${day}…`,
    );
  }

  const before = await summarizeDailyJobsForDate(day);
  console.log(`[retry] Before:`, before);

  const result = await requeueDailyJobsForDate({
    scheduledFor: day,
    includeCompleted: includeCompleted || testBackend,
    forceAll: testBackend,
    maxAttempts: testBackend ? 8 : 8,
  });

  console.log(`[retry] Reset ${result.reset} job(s) to pending`);
  if (result.skipped.length > 0) {
    console.log(`[retry] Skipped ${result.skipped.length} job(s):`);
    for (const s of result.skipped) {
      console.log(`  - ${s.userId} [${s.status}] ${s.reason}`);
    }
  }
  for (const j of result.jobs) {
    console.log(`  + ${j.userId} was ${j.previousStatus}`);
  }

  const after = await summarizeDailyJobsForDate(day);
  console.log(`[retry] After requeue:`, after);

  if (!runNow) {
    console.log(
      `\n[retry] Queued only. To run now:\n` +
        `  npm run worker:retry-failed -- --run\n` +
        `Backend robustness test (all users, no user logs):\n` +
        `  sudo systemctl stop dailyresume-worker\n` +
        `  npm run worker:retry-failed -- --test-backend --run\n` +
        `  sudo systemctl start dailyresume-worker\n`,
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
}

main().catch((err) => {
  console.error("[retry] Fatal:", err);
  process.exit(1);
});
