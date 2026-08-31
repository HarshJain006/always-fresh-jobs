/**
 * One-time welcome / thank-you email to all active users (manual bulk send).
 * Fetches name + email from Supabase; idempotent via email_reminder_events.
 */

import type { User } from "@/database/schemas";
import { getSupabaseServer, isSupabaseServerConfigured } from "@/lib/supabase";
import {
  DAILY_EMAIL_CAP,
  releaseReservedEmailSlot,
  resetEmailBatchCounter,
  reserveEmailSlot,
} from "./emailDailyCap";
import { welcomeThankYouEmail } from "./emailTemplates";
import { isResendConfigured, sendResendMail } from "./resendMailer";

export const WELCOME_REMINDER_TYPE = "welcome_thank_you" as const;
export const WELCOME_CONTEXT_KEY = "v1";
const SEQUENCE_NO = 1;

export type WelcomeBulkResult = {
  total: number;
  sent: number;
  queued: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
};

async function loadActiveUsersWithEmail(): Promise<User[]> {
  const { data, error } = await getSupabaseServer()
    .from("users")
    .select("*")
    .eq("account_status", "active")
    .not("email", "is", null)
    .limit(10_000);

  if (error) throw new Error(`loadActiveUsersWithEmail failed: ${error.message}`);

  return ((data ?? []) as User[]).filter((u) => u.email?.trim().includes("@"));
}

async function getWelcomeRow(userId: string) {
  const { data, error } = await getSupabaseServer()
    .from("email_reminder_events")
    .select("id, status")
    .eq("user_id", userId)
    .eq("reminder_type", WELCOME_REMINDER_TYPE)
    .eq("sequence_no", SEQUENCE_NO)
    .eq("context_key", WELCOME_CONTEXT_KEY)
    .maybeSingle();

  if (error) throw new Error(`getWelcomeRow failed: ${error.message}`);
  return data as { id: string; status: string } | null;
}

async function upsertWelcomeRow(
  userId: string,
  status: "processing" | "sent" | "failed" | "queued",
  error?: string,
): Promise<void> {
  const existing = await getWelcomeRow(userId);
  const patch = {
    status,
    error: error ?? null,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await getSupabaseServer()
      .from("email_reminder_events")
      .update(patch)
      .eq("id", existing.id);
    return;
  }

  await getSupabaseServer().from("email_reminder_events").insert({
    user_id: userId,
    reminder_type: WELCOME_REMINDER_TYPE,
    sequence_no: SEQUENCE_NO,
    context_key: WELCOME_CONTEXT_KEY,
    ...patch,
  });
}

/** Deliver a previously queued welcome email (caller must reserve a daily slot). */
export async function deliverQueuedWelcomeThankYou(userId: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer()
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.email?.trim()) return false;

  const user = data as User;
  const name = user.name?.trim() || "there";
  const { subject, html, text } = welcomeThankYouEmail(name);

  try {
    const ok = await sendResendMail({ to: user.email, subject, html, text });
    if (!ok) return false;
    await upsertWelcomeRow(userId, "sent");
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await upsertWelcomeRow(userId, "failed", msg);
    console.error(`[mail] queued welcome email failed user=${userId}:`, msg);
    return false;
  }
}

/**
 * Send thank-you email to every active user who has not received it yet.
 * Respects the daily email cap; overflow is queued for the next cron/run.
 */
export async function sendWelcomeThankYouToAllUsers(options: {
  dryRun?: boolean;
} = {}): Promise<WelcomeBulkResult> {
  const dryRun = options.dryRun === true;
  const result: WelcomeBulkResult = {
    total: 0,
    sent: 0,
    queued: 0,
    skipped: 0,
    failed: 0,
    dryRun,
  };

  if (!isSupabaseServerConfigured()) {
    throw new Error("Supabase is not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env");
  }
  if (!dryRun && !isResendConfigured()) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env");
  }

  const users = await loadActiveUsersWithEmail();
  result.total = users.length;

  if (dryRun) {
    for (const user of users) {
      const row = await getWelcomeRow(user.id);
      if (row?.status === "sent" || row?.status === "queued") result.skipped++;
      else result.sent++;
    }
    return result;
  }

  resetEmailBatchCounter();

  for (const user of users) {
    const row = await getWelcomeRow(user.id);
    if (row?.status === "sent") {
      result.skipped++;
      continue;
    }
    if (row?.status === "queued") {
      result.skipped++;
      continue;
    }

    if (!(await reserveEmailSlot())) {
      await upsertWelcomeRow(user.id, "queued");
      result.queued++;
      console.info(`[mail] welcome queued (daily cap ${DAILY_EMAIL_CAP}) user=${user.id}`);
      continue;
    }

    const name = user.name?.trim() || "there";
    const { subject, html, text } = welcomeThankYouEmail(name);

    await upsertWelcomeRow(user.id, "processing");

    try {
      const ok = await sendResendMail({ to: user.email, subject, html, text });
      if (!ok) {
        releaseReservedEmailSlot();
        await upsertWelcomeRow(user.id, "failed", "Resend not configured");
        result.failed++;
        continue;
      }
      await upsertWelcomeRow(user.id, "sent");
      result.sent++;
      console.info(`[mail] welcome sent user=${user.id} to=${user.email}`);
    } catch (err) {
      releaseReservedEmailSlot();
      const msg = err instanceof Error ? err.message : String(err);
      await upsertWelcomeRow(user.id, "failed", msg);
      result.failed++;
      console.error(`[mail] welcome failed user=${user.id}:`, msg);
    }
  }

  return result;
}
