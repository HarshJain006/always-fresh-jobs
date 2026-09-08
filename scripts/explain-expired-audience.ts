/**
 * Summarize resume uploaders vs expired-all eligibility.
 */
import "./load-env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const now = Date.now();

  const { data: users, error: uErr } = await sb
    .from("users")
    .select(
      "id, email, account_status, trial_used, trial_expire_at, subscription_expire_at",
    )
    .eq("account_status", "active")
    .limit(10_000);
  if (uErr) throw uErr;

  const { data: autos, error: aErr } = await sb
    .from("user_automation")
    .select("user_id, resume")
    .limit(10_000);
  if (aErr) throw aErr;

  const { data: events, error: eErr } = await sb
    .from("email_reminder_events")
    .select("user_id, status")
    .eq("reminder_type", "expired_access_reengage")
    .eq("context_key", "manual_v1")
    .limit(10_000);
  if (eErr) throw eErr;

  const resumeByUser = new Map((autos ?? []).map((r) => [r.user_id as string, r.resume]));
  const campaignByUser = new Map(
    (events ?? []).map((r) => [r.user_id as string, r.status as string]),
  );

  const withResume: Array<{ email: string; kind: string; campaign: string }> = [];
  let expired = 0;
  let expiredSent = 0;
  let resumeNotExpired = 0;

  for (const u of users ?? []) {
    const resume = resumeByUser.get(u.id);
    const hasResume = Boolean(
      resume && typeof resume === "object" && (resume as { path?: string }).path,
    );
    if (!hasResume) continue;

    const subMs = u.subscription_expire_at
      ? new Date(u.subscription_expire_at).getTime()
      : NaN;
    const trialMs = u.trial_expire_at ? new Date(u.trial_expire_at).getTime() : NaN;
    const hasPaid = Number.isFinite(subMs) && subMs > now;

    let kind = "other";
    if (hasPaid) kind = "paid_active";
    else if (Number.isFinite(subMs) && subMs <= now) kind = "subscription_ended";
    else if (u.trial_used && Number.isFinite(trialMs) && trialMs <= now) kind = "trial_ended";
    else if (u.trial_used && Number.isFinite(trialMs) && trialMs > now) kind = "trial_active";
    else if (!u.trial_used) kind = "trial_pending";

    const campaign = campaignByUser.get(u.id) ?? "(none)";
    withResume.push({ email: u.email, kind, campaign });

    const isExpired = kind === "trial_ended" || kind === "subscription_ended";
    if (isExpired) {
      expired++;
      if (campaign === "sent" || campaign === "queued") expiredSent++;
    } else {
      resumeNotExpired++;
    }
  }

  console.log("Active users:", users?.length ?? 0);
  console.log("With resume:", withResume.length);
  console.log("Resume + expired (eligible for expired-all):", expired);
  console.log("  of those already emailed:", expiredSent);
  console.log("Resume but NOT expired (skipped by design):", resumeNotExpired);

  const byKind: Record<string, number> = {};
  for (const r of withResume) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
  console.log("\nResume uploaders by state:");
  for (const [k, n] of Object.entries(byKind).sort()) console.log(`  ${k}: ${n}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
