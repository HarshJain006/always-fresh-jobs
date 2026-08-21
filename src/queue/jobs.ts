/**
 * Queue operations against Supabase. Safe to call from Netlify (enqueue)
 * or from the Raspberry Pi worker (claim / complete).
 *
 * All RPCs use retry for transient `fetch failed` / network blips.
 */

import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { isTransientFetchError, withRetry } from "@/lib/retry";
import { isFatalCredentialError, isPermanentSetupError, isRetryableUploadError } from "@/queue/jobErrors";
import { getUserAutomation, saveUserAutomation } from "@/database/userAutomation";
import {
  type AutomationJob,
  type JobType,
  JOB_PRIORITY,
  istDateString,
} from "./types";

function rowToJob(row: Record<string, unknown>): AutomationJob {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    platform: row.platform as AutomationJob["platform"],
    job_type: row.job_type as JobType,
    status: row.status as AutomationJob["status"],
    priority: Number(row.priority),
    attempts: Number(row.attempts),
    max_attempts: Number(row.max_attempts),
    worker_id: row.worker_id ? String(row.worker_id) : null,
    locked_at: row.locked_at ? String(row.locked_at) : null,
    lock_expires_at: row.lock_expires_at ? String(row.lock_expires_at) : null,
    available_at: String(row.available_at),
    scheduled_for: row.scheduled_for ? String(row.scheduled_for) : null,
    error: row.error ? String(row.error) : null,
    result_message: row.result_message ? String(row.result_message) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    completed_at: row.completed_at ? String(row.completed_at) : null,
  };
}

export interface EnqueueInput {
  userId: string;
  platform?: AutomationJob["platform"];
  jobType: JobType;
  /** For daily_refresh — defaults to today's IST date */
  scheduledFor?: string;
  availableAt?: Date;
}

export async function enqueueJob(input: EnqueueInput): Promise<{
  ok: boolean;
  job: AutomationJob | null;
  alreadyQueued?: boolean;
  /** True when today's daily refresh already completed successfully. */
  alreadyDone?: boolean;
  message: string;
}> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is required for the job queue.");
  }

  const platform = input.platform ?? "naukri";
  const scheduledFor =
    input.jobType === "daily_refresh" ? input.scheduledFor ?? istDateString() : null;

  // Daily refresh: never create a second job for the same IST day if one already
  // succeeded or is still in-flight (prevents Pi restart re-uploads).
  if (input.jobType === "daily_refresh" && scheduledFor) {
    const existing = await findDailyJobForDay(input.userId, platform, scheduledFor);
    if (existing) {
      if (existing.status === "completed") {
        return {
          ok: true,
          job: existing,
          alreadyQueued: true,
          alreadyDone: true,
          message: "Today's resume refresh already completed.",
        };
      }
      if (
        existing.status === "pending" ||
        existing.status === "claimed" ||
        existing.status === "running"
      ) {
        return {
          ok: true,
          job: existing,
          alreadyQueued: true,
          message: "Your daily refresh is already scheduled for today.",
        };
      }
      // failed / dead — only skip if it was a real attempt; cancelled jobs may re-queue
      const cancelled =
        (existing.error || existing.result_message || "")
          .toLowerCase()
          .includes("cancelled");
      if (!cancelled) {
        return {
          ok: true,
          job: existing,
          alreadyQueued: true,
          message: "Today's refresh already ran (previous attempt did not succeed).",
        };
      }
      // Cancelled earlier today → fall through and insert a fresh pending job
    }
  }

  const payload = {
    user_id: input.userId,
    platform,
    job_type: input.jobType,
    status: "pending",
    priority: JOB_PRIORITY[input.jobType],
    // Enough tries for flaky Naukri login, bounded so Pi does not spin all day
    max_attempts: input.jobType === "daily_refresh" ? 8 : 5,
    available_at: (input.availableAt ?? new Date()).toISOString(),
    scheduled_for: scheduledFor,
  };

  const { data, error } = await withRetry("enqueueJob", async () => {
    const res = await getSupabaseServer()
      .from("automation_jobs")
      .insert(payload)
      .select("*")
      .maybeSingle();
    if (res.error && res.error.code !== "23505") {
      // Retry transient transport errors wrapped as PostgrestError messages
      if (isTransientFetchError(res.error)) throw new Error(res.error.message);
    }
    return res;
  });

  if (error) {
    if (error.code === "23505" && input.jobType === "daily_refresh" && scheduledFor) {
      const existing = await findDailyJobForDay(input.userId, platform, scheduledFor);
      return {
        ok: true,
        job: existing,
        alreadyQueued: true,
        alreadyDone: existing?.status === "completed",
        message:
          existing?.status === "completed"
            ? "Today's resume refresh already completed."
            : "Your daily refresh is already scheduled for today.",
      };
    }
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }

  const job = data ? rowToJob(data) : null;
  return {
    ok: true,
    job,
    message:
      input.jobType === "run_now"
        ? "Your resume refresh has started."
        : "Your daily refresh is scheduled.",
  };
}

/** Any daily_refresh row for this user/platform/IST day (any status). */
export async function findDailyJobForDay(
  userId: string,
  platform: string,
  scheduledFor: string,
): Promise<AutomationJob | null> {
  const { data, error } = await getSupabaseServer()
    .from("automation_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("job_type", "daily_refresh")
    .eq("scheduled_for", scheduledFor)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("findDailyJobForDay:", error.message);
    return null;
  }
  return data ? rowToJob(data as Record<string, unknown>) : null;
}

/** Count today's daily_refresh jobs in Supabase (used on Pi startup). */
export async function summarizeDailyJobsForDate(scheduledFor: string): Promise<{
  total: number;
  completed: number;
  inFlight: number;
  failed: number;
}> {
  const { data, error } = await getSupabaseServer()
    .from("automation_jobs")
    .select("status")
    .eq("job_type", "daily_refresh")
    .eq("scheduled_for", scheduledFor);

  if (error) {
    console.error("summarizeDailyJobsForDate:", error.message);
    return { total: 0, completed: 0, inFlight: 0, failed: 0 };
  }

  let completed = 0;
  let inFlight = 0;
  let failed = 0;
  for (const row of data ?? []) {
    const status = String((row as { status: string }).status);
    if (status === "completed") completed++;
    else if (status === "pending" || status === "claimed" || status === "running") inFlight++;
    else if (status === "failed" || status === "dead") failed++;
  }
  return { total: data?.length ?? 0, completed, inFlight, failed };
}

export async function claimNextJob(
  workerId: string,
  leaseSeconds = 900,
): Promise<AutomationJob | null> {
  const { data, error } = await withRetry("claim_automation_job", async () => {
    const res = await getSupabaseServer().rpc("claim_automation_job", {
      p_worker_id: workerId,
      p_lease_seconds: leaseSeconds,
    });
    if (res.error && isTransientFetchError(res.error)) {
      throw new Error(res.error.message);
    }
    return res;
  });

  if (error) throw new Error(`claim_automation_job failed: ${error.message}`);
  const rows = (data ?? []) as Record<string, unknown>[];
  if (!rows.length) return null;
  return rowToJob(rows[0]);
}

export async function heartbeatJob(
  jobId: string,
  workerId: string,
  leaseSeconds = 900,
): Promise<boolean> {
  try {
    const { data, error } = await withRetry(
      "heartbeat_automation_job",
      async () => {
        const res = await getSupabaseServer().rpc("heartbeat_automation_job", {
          p_job_id: jobId,
          p_worker_id: workerId,
          p_lease_seconds: leaseSeconds,
        });
        if (res.error && isTransientFetchError(res.error)) {
          throw new Error(res.error.message);
        }
        return res;
      },
      { attempts: 3 },
    );
    if (error) {
      console.error("heartbeat_automation_job:", error.message);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.error("heartbeat_automation_job:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function completeJob(
  jobId: string,
  workerId: string,
  ok: boolean,
  message: string,
): Promise<void> {
  const { error } = await withRetry("complete_automation_job", async () => {
    const res = await getSupabaseServer().rpc("complete_automation_job", {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_ok: ok,
      p_message: message,
    });
    if (res.error && isTransientFetchError(res.error)) {
      throw new Error(res.error.message);
    }
    return res;
  });
  if (error) throw new Error(`complete_automation_job failed: ${error.message}`);
}

/**
 * Soft reclaim — never throws to the poll loop. Transient fetch failures are logged and ignored.
 */
export async function reclaimStaleJobs(): Promise<number> {
  try {
    const { data, error } = await withRetry(
      "reclaim_stale_automation_jobs",
      async () => {
        const res = await getSupabaseServer().rpc("reclaim_stale_automation_jobs");
        if (res.error && isTransientFetchError(res.error)) {
          throw new Error(res.error.message);
        }
        return res;
      },
      { attempts: 3, baseDelayMs: 500 },
    );
    if (error) {
      if (isTransientFetchError(error)) {
        console.warn("reclaim_stale_automation_jobs: temporary network issue — will retry");
      } else {
        console.error("reclaim_stale_automation_jobs:", error.message);
      }
      return 0;
    }
    return Number(data ?? 0);
  } catch (err) {
    if (isTransientFetchError(err)) {
      console.warn("reclaim_stale_automation_jobs: temporary network issue — will retry");
    } else {
      console.error(
        "reclaim_stale_automation_jobs:",
        err instanceof Error ? err.message : err,
      );
    }
    return 0;
  }
}

/**
 * After a failed Selenium run:
 * - wrong password / missing setup → stop (dead) + pause automation (no more daily retries)
 * - login page / upload flake → smart retry with backoff (bounded attempts)
 * - anything else → dead
 */
export async function applyJobFailurePolicy(
  jobId: string,
  message: string,
  userId?: string,
): Promise<"dead" | "retry" | "exhausted"> {
  if (isPermanentSetupError(message) || isFatalCredentialError(message)) {
    await markJobDeadPermanent(jobId, message);
    const uid = userId ?? (await getJobUserId(jobId));
    if (uid) {
      await pauseAutomationAfterCredentialFailure(uid, message);
    }
    return "dead";
  }
  if (isRetryableUploadError(message)) {
    return await scheduleSmartRetry(jobId, message);
  }
  await markJobDeadPermanent(jobId, message);
  return "dead";
}

async function getJobUserId(jobId: string): Promise<string | null> {
  const { data, error } = await getSupabaseServer()
    .from("automation_jobs")
    .select("user_id")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !data) return null;
  return String((data as { user_id: string }).user_id);
}

/**
 * Wrong Naukri password must stop the daily loop immediately.
 * Otherwise the same failure re-enqueues every morning for the whole trial.
 */
export async function pauseAutomationAfterCredentialFailure(
  userId: string,
  message: string,
): Promise<void> {
  try {
    const record = await getUserAutomation(userId);
    if (record.automationState === "running") {
      await saveUserAutomation({
        ...record,
        userId,
        automationState: "paused",
      });
      console.warn(
        `[queue] Paused automation for user=${userId} after credential/setup failure: ${message.slice(0, 120)}`,
      );
    }
    await cancelPendingJobsForUser(userId);
  } catch (err) {
    console.error(
      `[queue] Failed to pause after credential failure user=${userId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * True when the latest finished Naukri job is a permanent credential/setup failure
 * and the user has not explicitly re-saved credentials / pressed Start since then.
 */
export async function hasUnresolvedCredentialFailure(userId: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer()
    .from("automation_jobs")
    .select("status, error, result_message, completed_at, updated_at")
    .eq("user_id", userId)
    .eq("platform", "naukri")
    .in("status", ["dead", "failed", "completed"])
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;

  const row = data as {
    status: string;
    error?: string | null;
    result_message?: string | null;
    completed_at?: string | null;
    updated_at?: string | null;
  };

  if (row.status === "completed") return false;

  const msg = `${row.error || ""} ${row.result_message || ""}`.trim();
  if (!isFatalCredentialError(msg) && !isPermanentSetupError(msg)) return false;

  const failedAt = new Date(row.completed_at || row.updated_at || 0).getTime();
  if (!Number.isFinite(failedAt) || failedAt <= 0) return true;

  try {
    const record = await getUserAutomation(userId);
    const naukri = record.platforms.find((p) => p.id === "naukri");
    const ack = naukri?.credentialRetryAt ? new Date(naukri.credentialRetryAt).getTime() : 0;
    if (ack > failedAt) return false;
  } catch {
    /* if we can't read automation, keep blocking */
  }

  return true;
}

/** Call when user saves Naukri password or presses Start/Resume after a credential stop. */
export async function acknowledgeCredentialRetry(userId: string): Promise<void> {
  const record = await getUserAutomation(userId);
  const now = new Date().toISOString();
  const platforms = record.platforms.map((p) =>
    p.id === "naukri" ? { ...p, credentialRetryAt: now } : p,
  );
  await saveUserAutomation({ ...record, userId, platforms });
}

export async function markJobDeadPermanent(jobId: string, message: string): Promise<void> {
  const { error } = await getSupabaseServer()
    .from("automation_jobs")
    .update({
      status: "dead",
      error: message,
      result_message: message,
      worker_id: null,
      locked_at: null,
      lock_expires_at: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      available_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`markJobDeadPermanent failed: ${error.message}`);
  }
}

/**
 * Bounded retry for Pi: keep attempt count, exponential backoff, stop after max_attempts.
 * Does NOT spin forever — next calendar day gets a fresh job via normal enqueue.
 */
export async function scheduleSmartRetry(
  jobId: string,
  message: string,
): Promise<"retry" | "exhausted"> {
  const { data: row, error: readErr } = await getSupabaseServer()
    .from("automation_jobs")
    .select("attempts, max_attempts, status")
    .eq("id", jobId)
    .maybeSingle();

  if (readErr) {
    throw new Error(`scheduleSmartRetry read failed: ${readErr.message}`);
  }

  const attempts = Number((row as { attempts?: number } | null)?.attempts ?? 0);
  const maxAttempts = Math.max(3, Number((row as { max_attempts?: number } | null)?.max_attempts ?? 8));

  if (attempts >= maxAttempts) {
    const { error } = await getSupabaseServer()
      .from("automation_jobs")
      .update({
        status: "failed",
        error: message,
        result_message: `Stopped after ${attempts} tries today — will try again tomorrow`,
        worker_id: null,
        locked_at: null,
        lock_expires_at: null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        available_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .neq("status", "completed");

    if (error) throw new Error(`scheduleSmartRetry exhaust failed: ${error.message}`);
    return "exhausted";
  }

  // Backoff: ~2, 4, 8, 12, 15 minutes (Pi-friendly, not tight polling)
  const minutes = Math.min(15, Math.max(2, 2 * Math.min(attempts, 6)));
  const backoffMs = minutes * 60_000 + Math.floor(Math.random() * 30_000);

  const { error } = await getSupabaseServer()
    .from("automation_jobs")
    .update({
      status: "pending",
      // keep attempts — do not reset (prevents infinite loop)
      max_attempts: maxAttempts,
      error: message,
      result_message: `Backend retry ${attempts}/${maxAttempts} in ~${minutes}m`,
      worker_id: null,
      locked_at: null,
      lock_expires_at: null,
      completed_at: null,
      available_at: new Date(Date.now() + backoffMs).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .neq("status", "completed");

  if (error) {
    throw new Error(`scheduleSmartRetry failed: ${error.message}`);
  }
  return "retry";
}

/**
 * Reset today's daily jobs back to pending.
 * - default: failed/dead only (skips wrong-password)
 * - includeCompleted: also completed
 * - forceAll: every status today including claimed/running + credential failures (backend test)
 */
export async function requeueDailyJobsForDate(options?: {
  scheduledFor?: string;
  includeCompleted?: boolean;
  /** Requeue everyone today for backend robustness testing (ignores credential skip). */
  forceAll?: boolean;
  maxAttempts?: number;
}): Promise<{
  scheduledFor: string;
  reset: number;
  skippedCredentialFailures: number;
  skipped: Array<{ userId: string; status: string; reason: string }>;
  jobs: Array<{ id: string; userId: string; previousStatus: string }>;
}> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is required for the job queue.");
  }

  const scheduledFor = options?.scheduledFor ?? istDateString();
  const forceAll = Boolean(options?.forceAll);
  const statuses = forceAll
    ? (["failed", "dead", "completed", "pending", "claimed", "running"] as const)
    : options?.includeCompleted
      ? (["failed", "dead", "completed"] as const)
      : (["failed", "dead"] as const);
  const maxAttempts = Math.max(1, Math.min(12, options?.maxAttempts ?? 8));

  const { data: existing, error: listErr } = await getSupabaseServer()
    .from("automation_jobs")
    .select("id, user_id, status, error, result_message")
    .eq("job_type", "daily_refresh")
    .eq("scheduled_for", scheduledFor)
    .in("status", [...statuses]);

  if (listErr) {
    throw new Error(`requeueDailyJobsForDate list failed: ${listErr.message}`);
  }

  const skipped: Array<{ userId: string; status: string; reason: string }> = [];
  const rows = (existing ?? []).filter((r) => {
    const status = String((r as { status: string }).status);
    const userId = String((r as { user_id: string }).user_id);
    const msg =
      `${(r as { error?: string }).error || ""} ${(r as { result_message?: string }).result_message || ""}`.trim();

    if (forceAll) return true;
    if (options?.includeCompleted && status === "completed") return true;

    if (isPermanentSetupError(msg)) {
      skipped.push({
        userId,
        status,
        reason: msg.slice(0, 120) || "wrong password / setup",
      });
      return false;
    }
    return true;
  });

  if (rows.length === 0) {
    return {
      scheduledFor,
      reset: 0,
      skippedCredentialFailures: skipped.length,
      skipped,
      jobs: [],
    };
  }

  const ids = rows.map((r) => String((r as { id: string }).id));
  const { error: updErr } = await getSupabaseServer()
    .from("automation_jobs")
    .update({
      status: "pending",
      attempts: 0,
      max_attempts: maxAttempts,
      available_at: new Date().toISOString(),
      error: null,
      result_message: forceAll
        ? "Backend test requeue — silent to users"
        : "Manually requeued for retry",
      worker_id: null,
      locked_at: null,
      lock_expires_at: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  if (updErr) {
    throw new Error(`requeueDailyJobsForDate update failed: ${updErr.message}`);
  }

  return {
    scheduledFor,
    reset: rows.length,
    skippedCredentialFailures: skipped.length,
    skipped,
    jobs: rows.map((r) => ({
      id: String((r as { id: string }).id),
      userId: String((r as { user_id: string }).user_id),
      previousStatus: String((r as { status: string }).status),
    })),
  };
}

/** Cancel pending/claimed jobs for a user (e.g. when they Stop/Pause). */
export async function cancelPendingJobsForUser(userId: string): Promise<number> {
  // Schema allows: pending | claimed | running | completed | failed | dead
  const { data, error } = await getSupabaseServer()
    .from("automation_jobs")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
      error: "Cancelled — automation paused or stopped by user.",
      result_message: "Cancelled — automation paused or stopped by user.",
      completed_at: new Date().toISOString(),
      worker_id: null,
      locked_at: null,
      lock_expires_at: null,
    })
    .eq("user_id", userId)
    .in("status", ["pending", "claimed"])
    .select("id");

  if (error) {
    console.error("cancelPendingJobsForUser:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export async function getRecentJobsForUser(
  userId: string,
  limit = 10,
): Promise<AutomationJob[]> {
  const { data, error } = await getSupabaseServer()
    .from("automation_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => rowToJob(r as Record<string, unknown>));
}
