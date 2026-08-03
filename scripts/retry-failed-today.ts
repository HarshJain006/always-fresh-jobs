/**
 * Manually requeue today's failed/dead daily resume jobs (and optionally run them).
 * Keeps retrying until each resume uploads — stops only for wrong username/password.
 *
 * Usage on the Pi:
 *   npm run worker:retry-failed
 *   npm run worker:retry-failed -- --run
 *   npm run worker:retry-failed -- --all --run
 *
 * Flags:
 *   --run              After requeue, claim+upload until all uploads succeed
 *   --all              Also requeue completed jobs (force re-upload everyone today)
 *   --concurrency=N    Parallel Chrome slots when using --run (default 2)
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
import { getSupabaseServer } from "../src/lib/supabase";
import { isPermanentSetupError } from "../src/queue/jobErrors";

const args = process.argv.slice(2);
const runNow = args.includes("--run");
const includeCompleted = args.includes("--all");
const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
const CONCURRENCY = Math.max(
  1,
  Math.min(4, Number(concurrencyArg?.split("=")[1] || process.env.RETRY_CONCURRENCY || 2)),
);
const LEASE_SECONDS = Number(process.env.QUEUE_LEASE_SECONDS || 900);
const POLL_MS = 4000;
const BASE_WORKER_ID = `retry-${os.hostname()}-${process.pid}`;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function countOpenToday(): Promise<{ pending: number; inFlight: number; failedRetryable: number }> {
  const day = istDateString();
  const { data, error } = await getSupabaseServer()
    .from("automation_jobs")
    .select("status, error, result_message")
    .eq("job_type", "daily_refresh")
    .eq("scheduled_for", day);

  if (error) throw new Error(error.message);

  let pending = 0;
  let inFlight = 0;
  let failedRetryable = 0;
  for (const row of data ?? []) {
    const status = String((row as { status: string }).status);
    if (status === "pending") pending++;
    else if (status === "claimed" || status === "running") inFlight++;
    else if (status === "failed" || status === "dead") {
      const msg = `${(row as { error?: string }).error || ""} ${(row as { result_message?: string }).result_message || ""}`;
      if (!isPermanentSetupError(msg)) failedRetryable++;
    }
  }
  return { pending, inFlight, failedRetryable };
}

async function processOneJob(workerId: string): Promise<boolean> {
  const job = await claimNextJob(workerId, LEASE_SECONDS);
  if (!job) return false;

  console.log(
    `[retry] Claimed ${job.id} user=${job.user_id} type=${job.job_type} attempt=${job.attempts} slot=${workerId}`,
  );

  const heartbeat = setInterval(() => {
    void heartbeatJob(job.id, workerId, LEASE_SECONDS);
  }, Math.max(30_000, Math.floor(LEASE_SECONDS * 1000 * 0.4)));

  try {
    await heartbeatJob(job.id, workerId, LEASE_SECONDS);
    const result = await runPlatformForUser(job.user_id, job.platform, { headless: true });
    if (result.ok) {
      await completeJob(job.id, workerId, true, result.message);
      console.log(`[retry] Done ${job.id}: ok — ${result.message}`);
    } else {
      await completeJob(job.id, workerId, false, result.message);
      const policy = await applyJobFailurePolicy(job.id, result.message);
      console.log(
        `[retry] Done ${job.id}: fail — ${result.message} → ${
          policy === "dead" ? "STOP (wrong password / setup)" : "will keep retrying"
        }`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[retry] Job ${job.id} error:`, message);
    try {
      await completeJob(job.id, workerId, false, message);
      const policy = await applyJobFailurePolicy(job.id, message);
      console.log(
        `[retry] ${job.id} after error → ${
          policy === "dead" ? "STOP (wrong password / setup)" : "will keep retrying"
        }`,
      );
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

async function runUntilAllUploaded() {
  console.log(
    `[retry] Processing with concurrency=${CONCURRENCY} — will NOT stop until uploads succeed ` +
      `(except wrong username/password).`,
  );

  let emptyPolls = 0;
  const stopAfterEmpty = 8;

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

          // Periodically pull any failed/dead non-credential jobs back into pending
          emptyPolls++;
          if (emptyPolls % CONCURRENCY === 0) {
            const swept = await requeueDailyJobsForDate({
              scheduledFor: istDateString(),
              includeCompleted: false,
              maxAttempts: 50,
            });
            if (swept.reset > 0) {
              console.log(`[retry] Re-queued ${swept.reset} failed job(s) for another try`);
              emptyPolls = 0;
            }
          }

          const open = await countOpenToday();
          if (open.pending === 0 && open.inFlight === 0) {
            // Nothing left to do (completed + permanent dead only)
            if (emptyPolls >= stopAfterEmpty * CONCURRENCY) return;
          }
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
    `[retry] Requeueing ${includeCompleted ? "failed+dead+completed" : "failed+dead"} daily jobs for ${day}…`,
  );

  const before = await summarizeDailyJobsForDate(day);
  console.log(`[retry] Before:`, before);

  const result = await requeueDailyJobsForDate({
    scheduledFor: day,
    includeCompleted,
    maxAttempts: 50,
  });

  console.log(`[retry] Reset ${result.reset} job(s) to pending (max_attempts=50)`);
  if (result.skippedCredentialFailures > 0) {
    console.log(
      `[retry] Skipped ${result.skippedCredentialFailures} job(s) with wrong password / missing setup — fix credentials in dashboard`,
    );
  }
  for (const j of result.jobs) {
    console.log(`  - ${j.userId} was ${j.previousStatus}`);
  }

  const after = await summarizeDailyJobsForDate(day);
  console.log(`[retry] After requeue:`, after);

  if (!runNow) {
    console.log(
      `\n[retry] Done. systemd worker will keep retrying until upload succeeds\n` +
        `(stops only for wrong username/password).\n` +
        `Or run uploads in this terminal:\n` +
        `  npm run worker:retry-failed -- --run\n`,
    );
    return;
  }

  if (result.reset === 0 && after.inFlight === 0 && after.failed === 0) {
    console.log(`[retry] Nothing to run.`);
    return;
  }

  await runUntilAllUploaded();

  const final = await summarizeDailyJobsForDate(day);
  console.log(`[retry] Finished. Today's summary:`, final);
}

main().catch((err) => {
  console.error("[retry] Fatal:", err);
  process.exit(1);
});
