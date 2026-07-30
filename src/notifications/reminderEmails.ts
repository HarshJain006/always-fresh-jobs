import { getSupabaseServer, isSupabaseServerConfigured } from "@/lib/supabase";
import { getPaidDaysRemaining } from "@/payments/subscriptionStatus";
import type { User } from "@/database/schemas";
import { isSmtpConfigured, sendSmtpMail } from "./smtpMailer";

type ReminderType =
  | "trial_expired_repurchase"
  | "subscription_expired_repurchase"
  | "subscription_purchased"
  | "subscription_ending";

type ReminderRow = {
  id: string;
  user_id: string;
  reminder_type: ReminderType;
  sequence_no: number;
  context_key: string;
  status: "processing" | "sent" | "failed";
};

const REPEAT_INTERVAL_DAYS = 3;
const REPEAT_MAX_SENDS = 5;

function appBaseUrl(): string {
  return (process.env.VITE_APP_URL || process.env.URL || "https://dailyresume.in").replace(/\/$/, "");
}

function buildSubject(kind: ReminderType): string {
  switch (kind) {
    case "subscription_purchased":
      return "Your DailyResume subscription is active";
    case "subscription_ending":
      return "Your DailyResume plan is ending soon";
    case "trial_expired_repurchase":
    case "subscription_expired_repurchase":
      return "Resume refresh paused — renew your DailyResume plan";
    default:
      return "DailyResume update";
  }
}

function buildBody(user: User, kind: ReminderType, sequenceNo: number): { text: string; html: string } {
  const name = user.name?.trim() || "there";
  const pricingUrl = `${appBaseUrl()}/pricing`;
  const dashboardUrl = `${appBaseUrl()}/dashboard`;

  if (kind === "subscription_purchased") {
    const plan = user.subscription_plan === "premium_1m" ? "1 Month" : user.subscription_plan === "premium_3m" ? "3 Months" : "6 Months";
    const expireAt = user.subscription_expire_at
      ? new Date(user.subscription_expire_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })
      : "your renewal date";
    const text = `Hi ${name},\n\nYour ${plan} DailyResume subscription is active.\nValid until: ${expireAt}\n\nOpen dashboard: ${dashboardUrl}\n`;
    const html = `<p>Hi ${name},</p><p>Your <strong>${plan}</strong> DailyResume subscription is active.</p><p>Valid until: <strong>${expireAt}</strong></p><p><a href="${dashboardUrl}">Open dashboard</a></p>`;
    return { text, html };
  }

  if (kind === "subscription_ending") {
    const daysLeft = getPaidDaysRemaining(user);
    const text = `Hi ${name},\n\nYour DailyResume plan is ending in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.\nRenew now to avoid automation pause: ${pricingUrl}\n`;
    const html = `<p>Hi ${name},</p><p>Your DailyResume plan is ending in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>.</p><p><a href="${pricingUrl}">Renew now</a> to avoid automation pause.</p>`;
    return { text, html };
  }

  const attempt = `Reminder ${sequenceNo}/${REPEAT_MAX_SENDS}`;
  const text = `Hi ${name},\n\nYour DailyResume access has ended and resume refresh is paused.\n${attempt} — renew here: ${pricingUrl}\n`;
  const html = `<p>Hi ${name},</p><p>Your DailyResume access has ended and resume refresh is paused.</p><p>${attempt} — <a href="${pricingUrl}">Renew your plan</a>.</p>`;
  return { text, html };
}

async function createAttempt(
  userId: string,
  reminderType: ReminderType,
  sequenceNo: number,
  contextKey: string,
): Promise<ReminderRow | null> {
  const existingRes = await getSupabaseServer()
    .from("email_reminder_events")
    .select("*")
    .eq("user_id", userId)
    .eq("reminder_type", reminderType)
    .eq("sequence_no", sequenceNo)
    .eq("context_key", contextKey)
    .maybeSingle();

  if (existingRes.error && existingRes.error.code !== "PGRST116") {
    throw new Error(`createAttempt pre-check failed: ${existingRes.error.message}`);
  }
  const existing = (existingRes.data as ReminderRow | null) ?? null;
  if (existing?.status === "sent" || existing?.status === "processing") return null;
  if (existing?.status === "failed") {
    const { data, error } = await getSupabaseServer()
      .from("email_reminder_events")
      .update({
        status: "processing",
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`createAttempt retry update failed: ${error.message}`);
    return (data as ReminderRow) ?? null;
  }

  const { data, error } = await getSupabaseServer()
    .from("email_reminder_events")
    .insert({
      user_id: userId,
      reminder_type: reminderType,
      sequence_no: sequenceNo,
      context_key: contextKey,
      status: "processing",
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return null;
    throw new Error(`createAttempt failed: ${error.message}`);
  }
  return (data as ReminderRow) ?? null;
}

async function markAttempt(
  id: string,
  status: "sent" | "failed",
  errorText?: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  if (status === "failed") patch.error = errorText || "unknown error";

  await getSupabaseServer().from("email_reminder_events").update(patch).eq("id", id);
}

async function sendReminderIfNew(
  user: User,
  reminderType: ReminderType,
  sequenceNo: number,
  contextKey: string,
): Promise<boolean> {
  if (!isSmtpConfigured()) return false;
  const attempt = await createAttempt(user.id, reminderType, sequenceNo, contextKey);
  if (!attempt) return false;

  try {
    const body = buildBody(user, reminderType, sequenceNo);
    const delivered = await sendSmtpMail({
      to: user.email,
      subject: buildSubject(reminderType),
      text: body.text,
      html: body.html,
    });
    if (!delivered) {
      await markAttempt(attempt.id, "failed", "SMTP not configured");
      return false;
    }
    await markAttempt(attempt.id, "sent");
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markAttempt(attempt.id, "failed", msg);
    return false;
  }
}

async function loadUsersForReminders(): Promise<User[]> {
  const { data, error } = await getSupabaseServer()
    .from("users")
    .select("*")
    .eq("account_status", "active")
    .limit(5000);
  if (error) throw new Error(`loadUsersForReminders failed: ${error.message}`);
  return (data ?? []) as User[];
}

function hasPaidAccess(user: User, nowMs: number): boolean {
  if (!user.subscription_expire_at) return false;
  return new Date(user.subscription_expire_at).getTime() > nowMs;
}

function trialExpiredWithoutPaid(user: User, nowMs: number): boolean {
  const trialExpired = new Date(user.trial_expire_at).getTime() <= nowMs;
  return trialExpired && !hasPaidAccess(user, nowMs);
}

async function sendRepurchaseCycle(
  user: User,
  kind: "trial_expired_repurchase" | "subscription_expired_repurchase",
  anchorIso: string,
  nowMs: number,
): Promise<boolean> {
  const anchorMs = new Date(anchorIso).getTime();
  if (!Number.isFinite(anchorMs) || nowMs < anchorMs) return false;
  const elapsedDays = Math.floor((nowMs - anchorMs) / (24 * 60 * 60 * 1000));
  const dueCount = Math.floor(elapsedDays / REPEAT_INTERVAL_DAYS) + 1;
  const sequenceNo = Math.min(REPEAT_MAX_SENDS, Math.max(1, dueCount));
  if (sequenceNo > REPEAT_MAX_SENDS) return false;
  const contextKey = anchorIso;
  return sendReminderIfNew(user, kind, sequenceNo, contextKey);
}

/**
 * Daily sweep:
 * - Trial expired users: repurchase reminder every 3 days, max 5
 * - Subscription expired users: repurchase reminder every 3 days, max 5
 * - Active subscribers ending soon (<=7 days): one reminder per subscription period
 */
export async function runReminderSweep(): Promise<{ sent: number; attempted: number }> {
  if (!isSupabaseServerConfigured() || !isSmtpConfigured()) return { sent: 0, attempted: 0 };

  const nowMs = Date.now();
  const users = await loadUsersForReminders();
  let sent = 0;
  let attempted = 0;

  for (const user of users) {
    // If paid is active, we only consider ending-soon reminders.
    if (hasPaidAccess(user, nowMs)) {
      const daysLeft = getPaidDaysRemaining(user);
      if (daysLeft > 0 && daysLeft <= 7 && user.subscription_expire_at) {
        attempted++;
        const ok = await sendReminderIfNew(
          user,
          "subscription_ending",
          1,
          user.subscription_expire_at,
        );
        if (ok) sent++;
      }
      continue;
    }

    // Paid expired reminder cycle
    if (user.subscription_expire_at) {
      const expMs = new Date(user.subscription_expire_at).getTime();
      if (Number.isFinite(expMs) && expMs <= nowMs) {
        attempted++;
        const ok = await sendRepurchaseCycle(
          user,
          "subscription_expired_repurchase",
          user.subscription_expire_at,
          nowMs,
        );
        if (ok) sent++;
        continue;
      }
    }

    // Trial expired reminder cycle (only if user has no active paid plan)
    if (trialExpiredWithoutPaid(user, nowMs)) {
      attempted++;
      const ok = await sendRepurchaseCycle(
        user,
        "trial_expired_repurchase",
        user.trial_expire_at,
        nowMs,
      );
      if (ok) sent++;
    }
  }

  return { sent, attempted };
}

/** Trigger immediately after successful payment activation. */
export async function sendSubscriptionPurchasedEmail(userId: string): Promise<void> {
  if (!isSupabaseServerConfigured() || !isSmtpConfigured()) return;
  const { data, error } = await getSupabaseServer().from("users").select("*").eq("id", userId).maybeSingle();
  if (error || !data) return;
  const user = data as User;
  const contextKey = user.subscription_expire_at || new Date().toISOString();
  await sendReminderIfNew(user, "subscription_purchased", 1, contextKey);
}

