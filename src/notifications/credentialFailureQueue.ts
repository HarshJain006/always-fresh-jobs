/**
 * Queue credential-failure emails from the Pi worker (no Resend dependency).
 * Netlify drains the queue via /api/cron/mail-queue.
 */

import { findUserById } from "@/database/users";
import { isFatalCredentialError } from "@/queue/jobErrors";
import { getSupabaseServer, isSupabaseServerConfigured } from "@/lib/supabase";

export const CREDENTIAL_FAILURE_REMINDER_TYPE = "naukri_credentials_failed" as const;

const STALE_PROCESSING_MS = 15 * 60 * 1000;

export async function setCredentialFailureRowStatus(
  userId: string,
  logId: string,
  status: "processing" | "sent" | "failed" | "queued",
  error?: string,
): Promise<void> {
  await getSupabaseServer()
    .from("email_reminder_events")
    .update({
      status,
      error: error ?? null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("reminder_type", CREDENTIAL_FAILURE_REMINDER_TYPE)
    .eq("context_key", logId);
}

export async function ensureCredentialFailureRow(
  userId: string,
  logId: string,
  status: "processing" | "queued",
): Promise<void> {
  const existing = await getSupabaseServer()
    .from("email_reminder_events")
    .select("id, status")
    .eq("user_id", userId)
    .eq("reminder_type", CREDENTIAL_FAILURE_REMINDER_TYPE)
    .eq("context_key", logId)
    .maybeSingle();

  if (existing.data?.status === "sent") return;

  if (!existing.data) {
    await getSupabaseServer().from("email_reminder_events").insert({
      user_id: userId,
      reminder_type: CREDENTIAL_FAILURE_REMINDER_TYPE,
      sequence_no: 1,
      context_key: logId,
      status,
    });
    return;
  }

  if (existing.data.status === "sent") return;

  await getSupabaseServer()
    .from("email_reminder_events")
    .update({ status, error: null, updated_at: new Date().toISOString() })
    .eq("id", existing.data.id);
}

/**
 * Record a credential-failure email for Netlify to send. Idempotent per logId.
 * Returns true when a queue row exists and a flush should be requested.
 */
export async function queueCredentialFailureEmail(
  userId: string,
  logId: string,
  rawMessage: string,
): Promise<boolean> {
  if (!isFatalCredentialError(rawMessage)) return false;
  if (!isSupabaseServerConfigured()) return false;

  const user = await findUserById(userId);
  if (!user?.email?.trim()) return false;

  const existing = await getSupabaseServer()
    .from("email_reminder_events")
    .select("id, status, updated_at")
    .eq("user_id", userId)
    .eq("reminder_type", CREDENTIAL_FAILURE_REMINDER_TYPE)
    .eq("context_key", logId)
    .maybeSingle();

  if (existing.data?.status === "sent") return false;

  if (existing.data?.status === "processing") {
    const updatedAt = new Date(String(existing.data.updated_at)).getTime();
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt < STALE_PROCESSING_MS) {
      return false;
    }
  }

  if (existing.data?.status === "queued") return true;

  await ensureCredentialFailureRow(userId, logId, "queued");
  console.info(`[mail] credential email queued user=${userId} log=${logId}`);
  return true;
}

/** Ask Netlify to drain queued transactional emails (fire-and-forget). */
export async function requestMailQueueFlush(): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  const base = (process.env.VITE_APP_URL || "https://dailyresume.in").replace(/\/$/, "");
  if (!secret) {
    console.warn("[mail] CRON_SECRET unset; cannot flush mail queue from worker.");
    return;
  }

  try {
    const res = await fetch(`${base}/api/cron/mail-queue`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[mail] queue flush returned ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn(
      "[mail] queue flush webhook failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
