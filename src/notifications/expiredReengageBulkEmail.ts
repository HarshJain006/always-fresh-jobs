/**
 * Manual bulk re-engagement for users whose trial or subscription has ended.
 * Fetches users from Supabase; positive upsell copy; idempotent per campaign.
 */

import type { User } from "@/database/schemas";
import { getSupabaseServer, isSupabaseServerConfigured } from "@/lib/supabase";
import {
  DAILY_EMAIL_CAP,
  releaseReservedEmailSlot,
  resetEmailBatchCounter,
  reserveEmailSlot,
} from "./emailDailyCap";
import { expiredAccessReengageEmail } from "./emailTemplates";
import { isResendConfigured, sendResendMail } from "./resendMailer";

export const EXPIRED_REENGAGE_REMINDER_TYPE = "expired_access_reengage" as const;
export const EXPIRED_REENGAGE_CONTEXT_KEY = "manual_v1";
const SEQUENCE_NO = 1;

export type ExpiredAccessKind = "trial" | "subscription";

export type ExpiredReengageBulkResult = {
  total: number;
  trial: number;
  subscription: number;
  sent: number;
  queued: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
};

function hasPaidAccess(user: User, nowMs: number): boolean {
  if (!user.subscription_expire_at) return false;
  return new Date(user.subscription_expire_at).getTime() > nowMs;
}

/** Trial ended or paid subscription ended — no current active access. */
export function getExpiredAccessKind(user: User, nowMs = Date.now()): ExpiredAccessKind | null {
  if (user.account_status !== "active") return null;
  if (!user.email?.trim().includes("@")) return null;
  if (hasPaidAccess(user, nowMs)) return null;

  const subExpireMs = user.subscription_expire_at
    ? new Date(user.subscription_expire_at).getTime()
    : NaN;
  const trialExpireMs = user.trial_expire_at
    ? new Date(user.trial_expire_at).getTime()
    : NaN;

  if (Number.isFinite(subExpireMs) && subExpireMs <= nowMs) {
    return "subscription";
  }

  if (user.trial_used && Number.isFinite(trialExpireMs) && trialExpireMs <= nowMs) {
    return "trial";
  }

  return null;
}

async function loadActiveUsers(): Promise<User[]> {
  const { data, error } = await getSupabaseServer()
    .from("users")
    .select("*")
    .eq("account_status", "active")
    .not("email", "is", null)
    .limit(10_000);

  if (error) throw new Error(`loadActiveUsers failed: ${error.message}`);
  return (data ?? []) as User[];
}

async function getCampaignRow(userId: string) {
  const { data, error } = await getSupabaseServer()
    .from("email_reminder_events")
    .select("id, status")
    .eq("user_id", userId)
    .eq("reminder_type", EXPIRED_REENGAGE_REMINDER_TYPE)
    .eq("sequence_no", SEQUENCE_NO)
    .eq("context_key", EXPIRED_REENGAGE_CONTEXT_KEY)
    .maybeSingle();

  if (error) throw new Error(`getCampaignRow failed: ${error.message}`);
  return data as { id: string; status: string } | null;
}

async function upsertCampaignRow(
  userId: string,
  status: "processing" | "sent" | "failed" | "queued",
  error?: string,
): Promise<void> {
  const existing = await getCampaignRow(userId);
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
    reminder_type: EXPIRED_REENGAGE_REMINDER_TYPE,
    sequence_no: SEQUENCE_NO,
    context_key: EXPIRED_REENGAGE_CONTEXT_KEY,
    ...patch,
  });
}

/** Deliver a previously queued re-engagement email (caller must reserve a daily slot). */
export async function deliverQueuedExpiredReengage(userId: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer()
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.email?.trim()) return false;

  const user = data as User;
  const kind = getExpiredAccessKind(user);
  if (!kind) return false;

  const name = user.name?.trim() || "there";
  const { subject, html, text } = expiredAccessReengageEmail(name, kind);

  try {
    const ok = await sendResendMail({ to: user.email, subject, html, text });
    if (!ok) return false;
    await upsertCampaignRow(userId, "sent");
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await upsertCampaignRow(userId, "failed", msg);
    console.error(`[mail] queued expired re-engage failed user=${userId}:`, msg);
    return false;
  }
}

/**
 * Send positive upsell email to every user whose trial or subscription has ended.
 * Respects daily cap; overflow queued for next run/cron.
 */
export async function sendExpiredReengageToAllUsers(options: {
  dryRun?: boolean;
} = {}): Promise<ExpiredReengageBulkResult> {
  const dryRun = options.dryRun === true;
  const nowMs = Date.now();
  const result: ExpiredReengageBulkResult = {
    total: 0,
    trial: 0,
    subscription: 0,
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

  const allUsers = await loadActiveUsers();
  const eligible = allUsers
    .map((user) => ({ user, kind: getExpiredAccessKind(user, nowMs) }))
    .filter((x): x is { user: User; kind: ExpiredAccessKind } => x.kind !== null);

  result.total = eligible.length;
  result.trial = eligible.filter((x) => x.kind === "trial").length;
  result.subscription = eligible.filter((x) => x.kind === "subscription").length;

  if (dryRun) {
    for (const { user } of eligible) {
      const row = await getCampaignRow(user.id);
      if (row?.status === "sent" || row?.status === "queued") result.skipped++;
      else result.sent++;
    }
    return result;
  }

  resetEmailBatchCounter();

  for (const { user, kind } of eligible) {
    const row = await getCampaignRow(user.id);
    if (row?.status === "sent" || row?.status === "queued") {
      result.skipped++;
      continue;
    }

    if (!(await reserveEmailSlot())) {
      await upsertCampaignRow(user.id, "queued");
      result.queued++;
      console.info(`[mail] expired re-engage queued (cap ${DAILY_EMAIL_CAP}) user=${user.id}`);
      continue;
    }

    const name = user.name?.trim() || "there";
    const { subject, html, text } = expiredAccessReengageEmail(name, kind);

    await upsertCampaignRow(user.id, "processing");

    try {
      const ok = await sendResendMail({ to: user.email, subject, html, text });
      if (!ok) {
        releaseReservedEmailSlot();
        await upsertCampaignRow(user.id, "failed", "Resend not configured");
        result.failed++;
        continue;
      }
      await upsertCampaignRow(user.id, "sent");
      result.sent++;
      console.info(`[mail] expired re-engage sent (${kind}) user=${user.id} to=${user.email}`);
    } catch (err) {
      releaseReservedEmailSlot();
      const msg = err instanceof Error ? err.message : String(err);
      await upsertCampaignRow(user.id, "failed", msg);
      result.failed++;
      console.error(`[mail] expired re-engage failed user=${user.id}:`, msg);
    }
  }

  return result;
}
