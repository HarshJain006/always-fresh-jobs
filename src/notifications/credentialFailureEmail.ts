/**
 * Deliver credential-failure emails via Resend (Netlify / mail-queue cron only).
 * Pi workers queue rows via credentialFailureQueue.ts instead.
 */

import { findUserById } from "@/database/users";
import { isFatalCredentialError } from "@/queue/jobErrors";
import { getSupabaseServer, isSupabaseServerConfigured } from "@/lib/supabase";
import { credentialFailureEmail } from "./emailTemplates";
import {
  ensureCredentialFailureRow,
  setCredentialFailureRowStatus,
  CREDENTIAL_FAILURE_REMINDER_TYPE,
} from "./credentialFailureQueue";
import {
  releaseReservedEmailSlot,
  reserveEmailSlot,
} from "./emailDailyCap";
import { isResendConfigured, sendResendMail } from "./resendMailer";

const STALE_PROCESSING_MS = 15 * 60 * 1000;

/**
 * Send immediately when Resend is available (Netlify). Pi should use queueCredentialFailureEmail.
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
    .eq("reminder_type", CREDENTIAL_FAILURE_REMINDER_TYPE)
    .eq("context_key", logId)
    .maybeSingle();

  if (existing.data?.status === "sent") return;
  if (existing.data?.status === "queued") return;

  if (existing.data?.status === "processing") {
    const updatedAt = new Date(String(existing.data.updated_at)).getTime();
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt < STALE_PROCESSING_MS) return;
  }

  if (!(await reserveEmailSlot())) {
    await ensureCredentialFailureRow(userId, logId, "queued");
    console.info(`[mail] credential email queued (daily cap) user=${userId} log=${logId}`);
    return;
  }

  await ensureCredentialFailureRow(userId, logId, "processing");

  const name = user.name?.trim() || "there";
  const { subject, html, text } = credentialFailureEmail(name);

  try {
    const ok = await sendResendMail({ to: user.email, subject, html, text });
    if (!ok) {
      releaseReservedEmailSlot();
      await setCredentialFailureRowStatus(userId, logId, "failed", "Resend not configured");
      return;
    }
    await setCredentialFailureRowStatus(userId, logId, "sent");
    console.info(`[mail] credential failure email sent user=${userId} log=${logId}`);
  } catch (err) {
    releaseReservedEmailSlot();
    const msg = err instanceof Error ? err.message : String(err);
    await setCredentialFailureRowStatus(userId, logId, "failed", msg);
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
    await setCredentialFailureRowStatus(userId, logId, "sent");
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setCredentialFailureRowStatus(userId, logId, "failed", msg);
    console.error(`[mail] queued credential email failed user=${userId}:`, msg);
    return false;
  }
}
