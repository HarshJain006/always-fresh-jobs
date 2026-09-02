/**
 * Queue credential-failure emails from the Pi worker (no Resend dependency).
 * Netlify drains the queue via /api/cron/mail-queue.
 */

import { findUserById } from "@/database/users";
import { isCredentialFailureMessage } from "@/queue/jobErrors";
import { getSupabaseServer, isSupabaseServerConfigured } from "@/lib/supabase";
import { invokeCronEndpoint } from "@/lib/cronTrigger";

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
    const { error } = await getSupabaseServer().from("email_reminder_events").insert({
      user_id: userId,
      reminder_type: CREDENTIAL_FAILURE_REMINDER_TYPE,
      sequence_no: 1,
      context_key: logId,
      status,
    });
    if (error) {
      throw new Error(`ensureCredentialFailureRow insert failed: ${error.message}`);
    }
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
  if (!isCredentialFailureMessage(rawMessage)) return false;
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

/** Ask Netlify to drain queued transactional emails. Returns true when HTTP 2xx and delivery succeeded. */
export async function requestMailQueueFlush(): Promise<boolean> {
  const result = await invokeCronEndpoint("/api/cron/mail-queue");
  if (!result.ok) {
    const warning =
      typeof result.payload?.warning === "string" ? result.payload.warning : undefined;
    const pending = typeof result.payload?.pending === "number" ? result.payload.pending : 0;
    const sent = typeof result.payload?.sent === "number" ? result.payload.sent : 0;
    if (warning) {
      console.warn(`[mail] queue flush warning: ${warning} pending=${pending}`);
    } else if (result.status === 0) {
      console.warn(`[mail] queue flush failed: ${result.body}`);
    } else {
      console.warn(
        `[mail] queue flush returned ${result.status}: ${result.body.slice(0, 200)}`,
      );
    }
    return sent > 0;
  }

  const sent = typeof result.payload?.sent === "number" ? result.payload.sent : 0;
  const pending = typeof result.payload?.pending === "number" ? result.payload.pending : 0;
  console.info(`[mail] queue flush ok sent=${sent} pending=${pending}`);
  return true;
}
