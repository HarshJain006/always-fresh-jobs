import { getSupabaseServer, isSupabaseServerConfigured } from "@/lib/supabase";
import { getPaidDaysRemaining } from "@/payments/subscriptionStatus";
import type { User } from "@/database/schemas";
import { isSmtpConfigured, sendSmtpMail } from "./smtpMailer";
import {
  nextRepurchaseSequence,
  nextSubscriptionEndingSequence,
  nextTrialEndingSequence,
  REPEAT_MAX_SENDS,
  TRIAL_ENDING_MAX_SENDS,
} from "./reminderSchedule";
import { checkTrialStatus } from "@/database/users";

type ReminderType =
  | "trial_expired_repurchase"
  | "trial_ending"
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
  sent_at: string | null;
  updated_at: string;
};

const STALE_PROCESSING_MS = 15 * 60 * 1000;

function appBaseUrl(): string {
  return (process.env.VITE_APP_URL || process.env.URL || "https://dailyresume.in").replace(
    /\/$/,
    "",
  );
}

function buildSubject(kind: ReminderType): string {
  switch (kind) {
    case "subscription_purchased":
      return "Your DailyResume subscription is active";
    case "subscription_ending":
      return "Your DailyResume plan is ending soon";
    case "trial_ending":
      return "Your DailyResume free trial is ending soon";
    case "trial_expired_repurchase":
      return "Your free trial ended — renew DailyResume";
    case "subscription_expired_repurchase":
      return "Your DailyResume plan ended — renew to resume refreshes";
    default:
      return "DailyResume update";
  }
}

function buildBody(user: User, kind: ReminderType, sequenceNo: number): { text: string; html: string } {
  const name = user.name?.trim() || "there";
  const pricingUrl = `${appBaseUrl()}/pricing`;
  const dashboardUrl = `${appBaseUrl()}/dashboard`;

  if (kind === "subscription_purchased") {
    const plan =
      user.subscription_plan === "premium_1m"
        ? "1 Month"
        : user.subscription_plan === "premium_3m"
          ? "3 Months"
          : "6 Months";
    const expireAt = user.subscription_expire_at
      ? new Date(user.subscription_expire_at).toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
        })
      : "your renewal date";
    const text = `Hi ${name},\n\nYour ${plan} DailyResume subscription is active.\nValid until: ${expireAt}\n\nOpen dashboard: ${dashboardUrl}\n`;
    const html = `<p>Hi ${name},</p><p>Your <strong>${plan}</strong> DailyResume subscription is active.</p><p>Valid until: <strong>${expireAt}</strong></p><p><a href="${dashboardUrl}">Open dashboard</a></p>`;
    return { text, html };
  }

  if (kind === "subscription_ending") {
    const daysLeft = getPaidDaysRemaining(user);
    const attempt = `Reminder ${sequenceNo}/${REPEAT_MAX_SENDS}`;
    const text = `Hi ${name},\n\nYour DailyResume plan ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.\n${attempt} — renew now to keep daily resume refreshes: ${pricingUrl}\n`;
    const html = `<p>Hi ${name},</p><p>Your DailyResume plan ends in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>.</p><p>${attempt} — <a href="${pricingUrl}">Renew now</a> to keep daily resume refreshes.</p>`;
    return { text, html };
  }

  if (kind === "trial_ending") {
    const daysLeft = checkTrialStatus(user).daysRemaining;
    const attempt = `Reminder ${sequenceNo}/${TRIAL_ENDING_MAX_SENDS}`;
    const dayPhrase =
      daysLeft === 1 ? "today is the last day of your free trial" : "your free trial ends in 2 days";
    const text = `Hi ${name},\n\n${dayPhrase.charAt(0).toUpperCase()}${dayPhrase.slice(1)}.\n${attempt} — upgrade now so daily resume refreshes don’t stop: ${pricingUrl}\n`;
    const html = `<p>Hi ${name},</p><p><strong>${dayPhrase.charAt(0).toUpperCase()}${dayPhrase.slice(1)}</strong>.</p><p>${attempt} — <a href="${pricingUrl}">Upgrade now</a> so daily resume refreshes don’t stop.</p>`;
    return { text, html };
  }

  const attempt = `Reminder ${sequenceNo}/${REPEAT_MAX_SENDS}`;
  const endedLabel =
    kind === "trial_expired_repurchase" ? "free trial has ended" : "subscription has ended";
  const text = `Hi ${name},\n\nYour DailyResume ${endedLabel} and resume refresh is paused.\n${attempt} — renew here: ${pricingUrl}\n`;
  const html = `<p>Hi ${name},</p><p>Your DailyResume ${endedLabel} and resume refresh is paused.</p><p>${attempt} — <a href="${pricingUrl}">Renew your plan</a>.</p>`;
  return { text, html };
}

async function getLastSentReminder(
  userId: string,
  reminderType: ReminderType,
  contextKey: string,
): Promise<{ sequenceNo: number; sentAtMs: number } | null> {
  const { data, error } = await getSupabaseServer()
    .from("email_reminder_events")
    .select("sequence_no, sent_at")
    .eq("user_id", userId)
    .eq("reminder_type", reminderType)
    .eq("context_key", contextKey)
    .eq("status", "sent")
    .order("sequence_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.sent_at) return null;
  const sentAtMs = new Date(String(data.sent_at)).getTime();
  if (!Number.isFinite(sentAtMs)) return null;
  return { sequenceNo: Number(data.sequence_no), sentAtMs };
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
  if (existing?.status === "sent") return null;

  if (existing?.status === "processing") {
    const updatedAt = new Date(existing.updated_at).getTime();
    const stale = Number.isFinite(updatedAt) && Date.now() - updatedAt > STALE_PROCESSING_MS;
    if (!stale) return null;
  }

  if (existing) {
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
  if (!user.email?.trim()) return false;

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
  if (!user.trial_used) return false;
  const trialExpired = new Date(user.trial_expire_at).getTime() <= nowMs;
  return trialExpired && !hasPaidAccess(user, nowMs);
}

function hadPaidSubscription(user: User): boolean {
  return Boolean(user.subscription_expire_at);
}

async function sendRepurchaseCycle(
  user: User,
  kind: "trial_expired_repurchase" | "subscription_expired_repurchase",
  anchorIso: string,
  nowMs: number,
): Promise<boolean> {
  const anchorMs = new Date(anchorIso).getTime();
  const contextKey = anchorIso;
  const lastSent = await getLastSentReminder(user.id, kind, contextKey);
  const sequenceNo = nextRepurchaseSequence(anchorMs, nowMs, lastSent);
  if (!sequenceNo) return false;

  return sendReminderIfNew(user, kind, sequenceNo, contextKey);
}

async function sendSubscriptionEndingCycle(user: User, nowMs: number): Promise<boolean> {
  if (!user.subscription_expire_at) return false;
  const expireMs = new Date(user.subscription_expire_at).getTime();
  const contextKey = user.subscription_expire_at;
  const lastSent = await getLastSentReminder(user.id, "subscription_ending", contextKey);
  const sequenceNo = nextSubscriptionEndingSequence(expireMs, nowMs, lastSent);
  if (!sequenceNo) return false;

  return sendReminderIfNew(user, "subscription_ending", sequenceNo, contextKey);
}

async function sendTrialEndingCycle(user: User, nowMs: number): Promise<boolean> {
  if (hasPaidAccess(user, nowMs)) return false;
  if (!user.trial_used) return false;
  const trial = checkTrialStatus(user);
  if (!trial.active || trial.pending || (trial.daysRemaining !== 2 && trial.daysRemaining !== 1)) {
    return false;
  }

  const contextKey = user.trial_expire_at;
  const lastSent = await getLastSentReminder(user.id, "trial_ending", contextKey);
  const sequenceNo = nextTrialEndingSequence(user.trial_expire_at, nowMs, lastSent);
  if (!sequenceNo) return false;

  return sendReminderIfNew(user, "trial_ending", sequenceNo, contextKey);
}

/**
 * Daily sweep (run from /api/cron/reminders once per day):
 * - Active trial ending: emails on second-last day and last day (max 2)
 * - Trial ended: repurchase email every 3 days, max 5
 * - Subscription ended: repurchase email every 3 days, max 5
 * - Active subscription ending soon: warning every 3 days, max 5 (12/9/6/3/0 days left)
 */
export async function runReminderSweep(): Promise<{
  sent: number;
  attempted: number;
  skipped: number;
}> {
  if (!isSupabaseServerConfigured() || !isSmtpConfigured()) {
    return { sent: 0, attempted: 0, skipped: 0 };
  }

  const nowMs = Date.now();
  const users = await loadUsersForReminders();
  let sent = 0;
  let attempted = 0;
  let skipped = 0;

  for (const user of users) {
    if (hasPaidAccess(user, nowMs)) {
      const daysLeft = getPaidDaysRemaining(user);
      if (daysLeft > 0 && daysLeft <= 12) {
        attempted++;
        const ok = await sendSubscriptionEndingCycle(user, nowMs);
        if (ok) sent++;
        else skipped++;
      }
      continue;
    }

    // Active free trial (clock started) — warn on second-last and last day
    const trial = checkTrialStatus(user);
    if (trial.active && !trial.pending && (trial.daysRemaining === 2 || trial.daysRemaining === 1)) {
      attempted++;
      const ok = await sendTrialEndingCycle(user, nowMs);
      if (ok) sent++;
      else skipped++;
      continue;
    }

    if (hadPaidSubscription(user)) {
      const expMs = new Date(user.subscription_expire_at!).getTime();
      if (Number.isFinite(expMs) && expMs <= nowMs) {
        attempted++;
        const ok = await sendRepurchaseCycle(
          user,
          "subscription_expired_repurchase",
          user.subscription_expire_at!,
          nowMs,
        );
        if (ok) sent++;
        else skipped++;
        continue;
      }
    }

    if (trialExpiredWithoutPaid(user, nowMs)) {
      attempted++;
      const ok = await sendRepurchaseCycle(
        user,
        "trial_expired_repurchase",
        user.trial_expire_at,
        nowMs,
      );
      if (ok) sent++;
      else skipped++;
    }
  }

  return { sent, attempted, skipped };
}

/** Trigger immediately after successful payment activation. */
export async function sendSubscriptionPurchasedEmail(userId: string): Promise<void> {
  if (!isSupabaseServerConfigured() || !isSmtpConfigured()) return;
  const { data, error } = await getSupabaseServer()
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return;
  const user = data as User;
  const contextKey = user.subscription_expire_at || new Date().toISOString();
  await sendReminderIfNew(user, "subscription_purchased", 1, contextKey);
}
