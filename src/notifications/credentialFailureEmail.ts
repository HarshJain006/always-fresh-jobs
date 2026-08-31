/**
 * Send an email immediately when Naukri login fails due to wrong credentials.
 * One email per automation_logs row — never sent on successful uploads.
 * Respects daily cap (95/day IST); overflow is queued for next day (priority 1).
 */

import { findUserById } from "@/database/users";
import { isFatalCredentialError } from "@/queue/jobErrors";
import { getSupabaseServer, isSupabaseServerConfigured } from "@/lib/supabase";
import { credentialFailureEmail } from "./emailTemplates";
import {
  releaseReservedEmailSlot,
  reserveEmailSlot,
} from "./emailDailyCap";
import { isResendConfigured, sendResendMail } from "./resendMailer";

const STALE_PROCESSING_MS = 15 * 60 * 1000;
const REMINDER_TYPE = "naukri_credentials_failed" as const;

async function setRowStatus(
  userId: string,
  logId: string,
  status: "processing" | "sent" | "failed" | "queued",
  error?: string,
) {
  await getSupabaseServer()
    .from("email_reminder_events")
    .update({
      status,
      error: error ?? null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("reminder_type", REMINDER_TYPE)
    .eq("context_key", logId);
}

async function ensureRow(
  userId: string,
  logId: string,
  status: "processing" | "queued",
): Promise<void> {
  const existing = await getSupabaseServer()
    .from("email_reminder_events")
    .select("id, status")
    .eq("user_id", userId)
    .eq("reminder_type", REMINDER_TYPE)
    .eq("context_key", logId)
    .maybeSingle();

  if (existing.data?.status === "sent") return;

  if (!existing.data) {
    await getSupabaseServer().from("email_reminder_events").insert({
      user_id: userId,
      reminder_type: REMINDER_TYPE,
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
 * Call after writing an automation_logs row for a credential failure.
 * Idempotent per logId — safe to retry if worker crashes after log write.
 */
export async function sendCredentialFailureEmail(
  userId: string,
  logId: string,
  rawMessage: string,
): Promise<void> {
  if (!isFatalCredentialError(rawMessage)) return;
  if (!isResendConfigured() || !isSupabaseServerConfigured()) return;

  const user = await findUserById(userId);
  if (!user?.email?.trim()) return;

  const existing = await getSupabaseServer()
    .from("email_reminder_events")
    .select("id, status, updated_at")
    .eq("user_id", userId)
    .eq("reminder_type", REMINDER_TYPE)
    .eq("context_key", logId)
    .maybeSingle();

  if (existing.data?.status === "sent") return;
  if (existing.data?.status === "queued") return;

  if (existing.data?.status === "processing") {
    const updatedAt = new Date(String(existing.data.updated_at)).getTime();
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt < STALE_PROCESSING_MS) return;
  }

  if (!(await reserveEmailSlot())) {
    await ensureRow(userId, logId, "queued");
    console.info(`[mail] credential email queued (daily cap) user=${userId} log=${logId}`);
    return;
  }

  await ensureRow(userId, logId, "processing");

  const name = user.name?.trim() || "there";
  const { subject, html, text } = credentialFailureEmail(name);

  try {
    const ok = await sendResendMail({ to: user.email, subject, html, text });
    if (!ok) {
      releaseReservedEmailSlot();
      await setRowStatus(userId, logId, "failed", "Resend not configured");
      return;
    }
    await setRowStatus(userId, logId, "sent");
    console.info(`[mail] credential failure email sent user=${userId} log=${logId}`);
  } catch (err) {
    releaseReservedEmailSlot();
    const msg = err instanceof Error ? err.message : String(err);
    await setRowStatus(userId, logId, "failed", msg);
    console.error(`[mail] credential failure email failed user=${userId}:`, msg);
  }
}

/** Deliver a previously queued credential-failure email (caller must reserve a daily slot). */
export async function deliverQueuedCredentialEmail(
  userId: string,
  logId: string,
): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user?.email?.trim()) return false;

  const name = user.name?.trim() || "there";
  const { subject, html, text } = credentialFailureEmail(name);

  try {
    const ok = await sendResendMail({ to: user.email, subject, html, text });
    if (!ok) return false;
    await setRowStatus(userId, logId, "sent");
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setRowStatus(userId, logId, "failed", msg);
    console.error(`[mail] queued credential email failed user=${userId}:`, msg);
    return false;
  }
}
