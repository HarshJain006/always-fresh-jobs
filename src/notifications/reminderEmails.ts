import { getSupabaseServer, isSupabaseServerConfigured } from "@/lib/supabase";
import { getPaidDaysRemaining } from "@/payments/subscriptionStatus";
import type { User } from "@/database/schemas";
import { isResendConfigured, sendResendMail } from "./resendMailer";
import {
  nextRepurchaseSequence,
  nextSubscriptionEndingSequence,
  nextTrialEndingSequence,
  REPEAT_MAX_SENDS,
  SUBSCRIPTION_ENDING_MAX_SENDS,
  TRIAL_ENDING_MILESTONE_DAYS,
  trialEndingDaysLeft,
} from "./reminderSchedule";
import { checkTrialStatus } from "@/database/users";
import {
  repurchaseEmail,
  subscriptionEndingEmail,
  subscriptionPurchasedEmail,
  trialEndingEmail,
} from "./emailTemplates";
import {
  compareEmailPriority,
  countEmailsSentTodayIst,
  DAILY_EMAIL_CAP,
  EMAIL_SEND_PRIORITY,
  type MailCategory,
  releaseReservedEmailSlot,
  resetEmailBatchCounter,
  reserveEmailSlot,
} from "./emailDailyCap";
import { deliverQueuedCredentialEmail } from "./credentialFailureEmail";
import { deliverQueuedWelcomeThankYou } from "./welcomeBulkEmail";
import { deliverQueuedExpiredReengage } from "./expiredReengageBulkEmail";

type ReminderType = MailCategory;

type ReminderRow = {
  id: string;
  user_id: string;
  reminder_type: ReminderType;
  sequence_no: number;
  context_key: string;
  status: "processing" | "sent" | "failed" | "queued";
  sent_at: string | null;
  updated_at: string;
  created_at: string;
};

type EmailCandidate = {
  priority: number;
  user: User;
  reminderType: ReminderType;
  sequenceNo: number;
  contextKey: string;
};

type SendResult = "sent" | "queued" | "skipped";

const STALE_PROCESSING_MS = 15 * 60 * 1000;

function buildSubject(kind: ReminderType, user: User, sequenceNo: number): string {
  switch (kind) {
    case "subscription_purchased": {
      const plan =
        user.subscription_plan === "premium_1m"
          ? "1 Month"
          : user.subscription_plan === "premium_3m"
            ? "3 Months"
            : "6 Months";
      return subscriptionPurchasedEmail(
        user.name?.trim() || "there",
        plan,
        user.subscription_expire_at
          ? new Date(user.subscription_expire_at).toLocaleDateString("en-IN", {
              timeZone: "Asia/Kolkata",
            })
          : "your renewal date",
      ).subject;
    }
    case "subscription_ending":
      return subscriptionEndingEmail(
        user.name?.trim() || "there",
        getPaidDaysRemaining(user),
        sequenceNo,
        SUBSCRIPTION_ENDING_MAX_SENDS,
      ).subject;
    case "trial_ending":
      return trialEndingEmail(
        user.name?.trim() || "there",
        trialEndingDaysLeft(user.trial_expire_at),
        sequenceNo,
        TRIAL_ENDING_MILESTONE_DAYS.length,
      ).subject;
    case "trial_expired_repurchase":
      return repurchaseEmail(user.name?.trim() || "there", "trial", sequenceNo, REPEAT_MAX_SENDS)
        .subject;
    case "subscription_expired_repurchase":
      return repurchaseEmail(
        user.name?.trim() || "there",
        "subscription",
        sequenceNo,
        REPEAT_MAX_SENDS,
      ).subject;
    default:
      return "DailyResume update";
  }
}

function buildBody(
  user: User,
  kind: ReminderType,
  sequenceNo: number,
): { text: string; html: string } {
  const name = user.name?.trim() || "there";

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
    return subscriptionPurchasedEmail(name, plan, expireAt);
  }

  if (kind === "subscription_ending") {
    return subscriptionEndingEmail(
      name,
      getPaidDaysRemaining(user),
      sequenceNo,
      SUBSCRIPTION_ENDING_MAX_SENDS,
    );
  }

  if (kind === "trial_ending") {
    return trialEndingEmail(
      name,
      trialEndingDaysLeft(user.trial_expire_at),
      sequenceNo,
      TRIAL_ENDING_MILESTONE_DAYS.length,
    );
  }

  const repurchaseKind = kind === "trial_expired_repurchase" ? "trial" : "subscription";
  return repurchaseEmail(name, repurchaseKind, sequenceNo, REPEAT_MAX_SENDS);
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

async function getExistingAttempt(
  userId: string,
  reminderType: ReminderType,
  sequenceNo: number,
  contextKey: string,
): Promise<ReminderRow | null> {
  const { data, error } = await getSupabaseServer()
    .from("email_reminder_events")
    .select("*")
    .eq("user_id", userId)
    .eq("reminder_type", reminderType)
    .eq("sequence_no", sequenceNo)
    .eq("context_key", contextKey)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw new Error(`getExistingAttempt failed: ${error.message}`);
  }
  return (data as ReminderRow | null) ?? null;
}

async function createAttempt(
  userId: string,
  reminderType: ReminderType,
  sequenceNo: number,
  contextKey: string,
  status: "processing" | "queued" = "processing",
): Promise<ReminderRow | null> {
  const existing = await getExistingAttempt(userId, reminderType, sequenceNo, contextKey);
  if (existing?.status === "sent") return null;
  if (existing?.status === "queued" && status === "queued") return existing;

  if (existing?.status === "processing") {
    const updatedAt = new Date(existing.updated_at).getTime();
    const stale = Number.isFinite(updatedAt) && Date.now() - updatedAt > STALE_PROCESSING_MS;
    if (!stale && status === "processing") return null;
  }

  if (existing) {
    const { data, error } = await getSupabaseServer()
      .from("email_reminder_events")
      .update({
        status,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`createAttempt update failed: ${error.message}`);
    return (data as ReminderRow) ?? null;
  }

  const { data, error } = await getSupabaseServer()
    .from("email_reminder_events")
    .insert({
      user_id: userId,
      reminder_type: reminderType,
      sequence_no: sequenceNo,
      context_key: contextKey,
      status,
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
  status: "sent" | "failed" | "queued",
  errorText?: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  if (status === "failed" || status === "queued") patch.error = errorText ?? null;

  await getSupabaseServer().from("email_reminder_events").update(patch).eq("id", id);
}

async function deliverAttempt(row: ReminderRow, user: User): Promise<boolean> {
  const body = buildBody(user, row.reminder_type, row.sequence_no);
  const delivered = await sendResendMail({
    to: user.email,
    subject: buildSubject(row.reminder_type, user, row.sequence_no),
    text: body.text,
    html: body.html,
  });
  if (!delivered) return false;
  await markAttempt(row.id, "sent");
  return true;
}

async function sendReminderIfNew(
  user: User,
  reminderType: ReminderType,
  sequenceNo: number,
  contextKey: string,
): Promise<SendResult> {
  if (!isResendConfigured()) return "skipped";
  if (!user.email?.trim()) return "skipped";

  const existing = await getExistingAttempt(user.id, reminderType, sequenceNo, contextKey);
  if (existing?.status === "sent") return "skipped";
  if (existing?.status === "queued") return "queued";

  if (!(await reserveEmailSlot())) {
    await createAttempt(user.id, reminderType, sequenceNo, contextKey, "queued");
    return "queued";
  }

  const attempt = await createAttempt(user.id, reminderType, sequenceNo, contextKey, "processing");
  if (!attempt) {
    releaseReservedEmailSlot();
    return "skipped";
  }

  try {
    const ok = await deliverAttempt(attempt, user);
    if (!ok) {
      releaseReservedEmailSlot();
      await markAttempt(attempt.id, "failed", "Resend not configured");
      return "skipped";
    }
    return "sent";
  } catch (err) {
    releaseReservedEmailSlot();
    const msg = err instanceof Error ? err.message : String(err);
    await markAttempt(attempt.id, "failed", msg);
    return "skipped";
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

async function loadUserById(userId: string): Promise<User | null> {
  const { data, error } = await getSupabaseServer()
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as User;
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

function isTrialEndingWindow(user: User, nowMs: number): boolean {
  if (!user.trial_used) return false;
  const daysLeft = trialEndingDaysLeft(user.trial_expire_at, nowMs);
  return (TRIAL_ENDING_MILESTONE_DAYS as readonly number[]).includes(daysLeft);
}

async function collectCandidatesForUser(user: User, nowMs: number): Promise<EmailCandidate[]> {
  const out: EmailCandidate[] = [];

  if (hasPaidAccess(user, nowMs)) {
    const daysLeft = getPaidDaysRemaining(user);
    if (daysLeft > 0 && daysLeft <= 7 && user.subscription_expire_at) {
      const expireMs = new Date(user.subscription_expire_at).getTime();
      const lastSent = await getLastSentReminder(
        user.id,
        "subscription_ending",
        user.subscription_expire_at,
      );
      const sequenceNo = nextSubscriptionEndingSequence(expireMs, nowMs, lastSent);
      if (sequenceNo) {
        const existing = await getExistingAttempt(
          user.id,
          "subscription_ending",
          sequenceNo,
          user.subscription_expire_at,
        );
        if (existing?.status !== "sent" && existing?.status !== "queued") {
          out.push({
            priority: EMAIL_SEND_PRIORITY.subscription_ending,
            user,
            reminderType: "subscription_ending",
            sequenceNo,
            contextKey: user.subscription_expire_at,
          });
        }
      }
    }
    return out;
  }

  const trial = checkTrialStatus(user);
  if (trial.active && !trial.pending && isTrialEndingWindow(user, nowMs)) {
    const lastSent = await getLastSentReminder(user.id, "trial_ending", user.trial_expire_at);
    const sequenceNo = nextTrialEndingSequence(user.trial_expire_at, nowMs, lastSent);
    if (sequenceNo) {
      const existing = await getExistingAttempt(
        user.id,
        "trial_ending",
        sequenceNo,
        user.trial_expire_at,
      );
      if (existing?.status !== "sent" && existing?.status !== "queued") {
        out.push({
          priority: EMAIL_SEND_PRIORITY.trial_ending,
          user,
          reminderType: "trial_ending",
          sequenceNo,
          contextKey: user.trial_expire_at,
        });
      }
    }
  }

  if (hadPaidSubscription(user) && user.subscription_expire_at) {
    const expMs = new Date(user.subscription_expire_at).getTime();
    if (Number.isFinite(expMs) && expMs <= nowMs) {
      const lastSent = await getLastSentReminder(
        user.id,
        "subscription_expired_repurchase",
        user.subscription_expire_at,
      );
      const sequenceNo = nextRepurchaseSequence(expMs, nowMs, lastSent);
      if (sequenceNo) {
        const existing = await getExistingAttempt(
          user.id,
          "subscription_expired_repurchase",
          sequenceNo,
          user.subscription_expire_at,
        );
        if (existing?.status !== "sent" && existing?.status !== "queued") {
          out.push({
            priority: EMAIL_SEND_PRIORITY.subscription_expired_repurchase,
            user,
            reminderType: "subscription_expired_repurchase",
            sequenceNo,
            contextKey: user.subscription_expire_at,
          });
        }
      }
    }
  }

  if (trialExpiredWithoutPaid(user, nowMs)) {
    const lastSent = await getLastSentReminder(
      user.id,
      "trial_expired_repurchase",
      user.trial_expire_at,
    );
    const anchorMs = new Date(user.trial_expire_at).getTime();
    const sequenceNo = nextRepurchaseSequence(anchorMs, nowMs, lastSent);
    if (sequenceNo) {
      const existing = await getExistingAttempt(
        user.id,
        "trial_expired_repurchase",
        sequenceNo,
        user.trial_expire_at,
      );
      if (existing?.status !== "sent" && existing?.status !== "queued") {
        out.push({
          priority: EMAIL_SEND_PRIORITY.trial_expired_repurchase,
          user,
          reminderType: "trial_expired_repurchase",
          sequenceNo,
          contextKey: user.trial_expire_at,
        });
      }
    }
  }

  return out;
}

/** Drain queued emails from prior days (or today's overflow), highest priority first. */
async function loadPendingMailQueueRows(): Promise<ReminderRow[]> {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();

  const [queuedRes, staleRes, failedCredRes] = await Promise.all([
    getSupabaseServer()
      .from("email_reminder_events")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1000),
    getSupabaseServer()
      .from("email_reminder_events")
      .select("*")
      .eq("status", "processing")
      .lt("updated_at", staleBefore)
      .order("created_at", { ascending: true })
      .limit(200),
    getSupabaseServer()
      .from("email_reminder_events")
      .select("*")
      .eq("status", "failed")
      .eq("reminder_type", "naukri_credentials_failed")
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  if (queuedRes.error) {
    console.error("[mail] load queued failed:", queuedRes.error.message);
  }
  if (staleRes.error) {
    console.error("[mail] load stale processing failed:", staleRes.error.message);
  }
  if (failedCredRes.error) {
    console.error("[mail] load failed credential rows failed:", failedCredRes.error.message);
  }

  const byId = new Map<string, ReminderRow>();
  for (const row of [
    ...((queuedRes.data ?? []) as ReminderRow[]),
    ...((staleRes.data ?? []) as ReminderRow[]),
    ...((failedCredRes.data ?? []) as ReminderRow[]),
  ]) {
    byId.set(row.id, row);
  }

  return [...byId.values()].sort((a, b) => {
    const p = compareEmailPriority(a.reminder_type, b.reminder_type);
    if (p !== 0) return p;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export async function processQueuedEmails(): Promise<number> {
  const rows = await loadPendingMailQueueRows();
  if (rows.length === 0) return 0;

  let sent = 0;
  for (const row of rows) {
    if (!(await reserveEmailSlot())) break;

    if (row.reminder_type === "naukri_credentials_failed") {
      const ok = await deliverQueuedCredentialEmail(row.user_id, row.context_key);
      if (ok) sent++;
      else releaseReservedEmailSlot();
      continue;
    }

    if (row.reminder_type === "welcome_thank_you") {
      const ok = await deliverQueuedWelcomeThankYou(row.user_id);
      if (ok) sent++;
      else releaseReservedEmailSlot();
      continue;
    }

    if (row.reminder_type === "expired_access_reengage") {
      const ok = await deliverQueuedExpiredReengage(row.user_id);
      if (ok) sent++;
      else releaseReservedEmailSlot();
      continue;
    }

    const user = await loadUserById(row.user_id);
    if (!user?.email?.trim()) {
      releaseReservedEmailSlot();
      await markAttempt(row.id, "failed", "user email missing");
      continue;
    }

    try {
      const processing = await createAttempt(
        row.user_id,
        row.reminder_type,
        row.sequence_no,
        row.context_key,
        "processing",
      );
      if (!processing) {
        releaseReservedEmailSlot();
        continue;
      }
      const ok = await deliverAttempt(processing, user);
      if (ok) sent++;
      else releaseReservedEmailSlot();
    } catch (err) {
      releaseReservedEmailSlot();
      const msg = err instanceof Error ? err.message : String(err);
      await markAttempt(row.id, "failed", msg);
    }
  }

  return sent;
}

export type MailQueueFlushResult = {
  ok: boolean;
  sent: number;
  pending: number;
  sentToday: number;
  cap: number;
  resendConfigured: boolean;
  supabaseConfigured: boolean;
  warning?: string;
};

/** Process only queued rows (credential failures, cap overflow). Used by /api/cron/mail-queue. */
export async function runMailQueueFlush(): Promise<MailQueueFlushResult> {
  const supabaseConfigured = isSupabaseServerConfigured();
  const resendConfigured = isResendConfigured();
  const pending = supabaseConfigured ? (await loadPendingMailQueueRows()).length : 0;

  if (!supabaseConfigured) {
    return {
      ok: false,
      sent: 0,
      pending: 0,
      sentToday: 0,
      cap: DAILY_EMAIL_CAP,
      resendConfigured,
      supabaseConfigured,
      warning: "Supabase is not configured on the server.",
    };
  }

  if (!resendConfigured) {
    return {
      ok: false,
      sent: 0,
      pending,
      sentToday: 0,
      cap: DAILY_EMAIL_CAP,
      resendConfigured,
      supabaseConfigured,
      warning:
        pending > 0
          ? "Resend is not configured on the server. Set RESEND_API_KEY and RESEND_FROM_EMAIL on Netlify."
          : undefined,
    };
  }

  resetEmailBatchCounter();
  const sent = await processQueuedEmails();
  const sentToday = await countEmailsSentTodayIst();
  const pendingAfter = (await loadPendingMailQueueRows()).length;
  return {
    ok: true,
    sent,
    pending: pendingAfter,
    sentToday,
    cap: DAILY_EMAIL_CAP,
    resendConfigured,
    supabaseConfigured,
  };
}

/**
 * Daily sweep (run from /api/cron/reminders once per day, ~9–10 AM IST):
 * - Max 95 emails per IST day; overflow queued for next day
 * - Priority: wrong password → trial ended → subscription ending → others
 */
export type ReminderSweepResult = {
  ok: boolean;
  sent: number;
  queued: number;
  attempted: number;
  skipped: number;
  sentToday: number;
  cap: number;
  resendConfigured: boolean;
  supabaseConfigured: boolean;
  warning?: string;
};

export async function runReminderSweep(): Promise<ReminderSweepResult> {
  const supabaseConfigured = isSupabaseServerConfigured();
  const resendConfigured = isResendConfigured();

  if (!supabaseConfigured || !resendConfigured) {
    return {
      ok: false,
      sent: 0,
      queued: 0,
      attempted: 0,
      skipped: 0,
      sentToday: 0,
      cap: DAILY_EMAIL_CAP,
      resendConfigured,
      supabaseConfigured,
      warning: !supabaseConfigured
        ? "Supabase is not configured on the server."
        : "Resend is not configured on the server. Set RESEND_API_KEY and RESEND_FROM_EMAIL on Netlify.",
    };
  }

  resetEmailBatchCounter();
  const nowMs = Date.now();
  let sent = 0;
  let queued = 0;
  let skipped = 0;

  sent += await processQueuedEmails();

  const users = await loadUsersForReminders();
  const candidates: EmailCandidate[] = [];
  for (const user of users) {
    const userCandidates = await collectCandidatesForUser(user, nowMs);
    candidates.push(...userCandidates);
  }

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.user.id.localeCompare(b.user.id);
  });

  for (const c of candidates) {
    const result = await sendReminderIfNew(c.user, c.reminderType, c.sequenceNo, c.contextKey);
    if (result === "sent") sent++;
    else if (result === "queued") queued++;
    else skipped++;
  }

  const sentToday = await countEmailsSentTodayIst();
  return {
    ok: true,
    sent,
    queued,
    attempted: candidates.length,
    skipped,
    sentToday,
    cap: DAILY_EMAIL_CAP,
    resendConfigured,
    supabaseConfigured,
  };
}

/** Trigger immediately after successful payment activation. */
export async function sendSubscriptionPurchasedEmail(userId: string): Promise<void> {
  if (!isSupabaseServerConfigured() || !isResendConfigured()) return;
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
