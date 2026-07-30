/**
 * Queue operations against Supabase. Safe to call from Netlify (enqueue)
 * or from the Raspberry Pi worker (claim / complete).
 *
 * All RPCs use retry for transient `fetch failed` / network blips.
 */

import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";
import { isTransientFetchError, withRetry } from "@/lib/retry";
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
