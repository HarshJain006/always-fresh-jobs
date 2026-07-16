/**
 * Durable automation job queue — backed by Supabase Postgres (free).
 * Netlify enqueues; Raspberry Pi claims and runs Selenium.
 */

export type JobType = "daily_refresh" | "run_now" | "test";
export type JobStatus =
  | "pending"
  | "claimed"
  | "running"
  | "completed"
  | "failed"
  | "dead";

export interface AutomationJob {
  id: string;
  user_id: string;
  platform: "naukri" | "indeed" | "linkedin";
  job_type: JobType;
  status: JobStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  worker_id: string | null;
  locked_at: string | null;
  lock_expires_at: string | null;
  available_at: string;
  scheduled_for: string | null;
  error: string | null;
  result_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export const JOB_PRIORITY: Record<JobType, number> = {
  test: 5,
  run_now: 10,
  daily_refresh: 100,
};

/** Today's date in Asia/Kolkata as YYYY-MM-DD (for daily job uniqueness). */
export function istDateString(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
