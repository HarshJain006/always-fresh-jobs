/**
 * Look up a user and their activity logs + email events in Supabase.
 *
 * Usage:
 *   npm run logs:lookup -- user@example.com
 *   npm run logs:lookup -- <users-table-uuid>
 */
import "./load-env";
import { getSupabaseServer, isSupabaseServerConfigured } from "../src/lib/supabase";

async function findUser(query: string) {
  const q = query.trim();
  if (!q) return null;

  if (/^[0-9a-f-]{36}$/i.test(q)) {
    const { data, error } = await getSupabaseServer()
      .from("users")
      .select("id, email, name, google_user_id, created_at, account_status")
      .eq("id", q)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await getSupabaseServer()
    .from("users")
    .select("id, email, name, google_user_id, created_at, account_status")
    .ilike("email", q)
    .limit(5);
  if (error) throw new Error(error.message);
  if (!data?.length) return null;
  if (data.length > 1) {
    console.log("Multiple users match — pick the correct user_id:\n");
    for (const u of data) {
      console.log(`  ${u.id}  ${u.email}  ${u.name}`);
    }
    return null;
  }
  return data[0];
}

async function main(): Promise<void> {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error("Usage: npm run logs:lookup -- user@example.com");
    console.error("       npm run logs:lookup -- <users-table-uuid>");
    process.exit(1);
  }

  if (!isSupabaseServerConfigured()) {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const user = await findUser(query);
  if (!user) {
    console.error("User not found.");
    process.exit(1);
  }

  console.log("\n=== User (public.users) ===");
  console.log(`  id:              ${user.id}`);
  console.log(`  email:           ${user.email}`);
  console.log(`  name:            ${user.name}`);
  console.log(`  google_user_id:  ${user.google_user_id}`);
  console.log(`  account_status:  ${user.account_status}`);
  console.log(`  created_at:      ${user.created_at}`);

  const { data: logs, error: logsErr } = await getSupabaseServer()
    .from("automation_logs")
    .select("id, user_id, platform, ok, message, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (logsErr) throw new Error(logsErr.message);

  console.log(`\n=== Recent activity (automation_logs) — ${logs?.length ?? 0} rows ===`);
  console.log("  Note: log id ≠ user id. Join on user_id.\n");
  for (const row of logs ?? []) {
    console.log(
      `  log_id=${row.id}\n    user_id=${row.user_id}\n    ok=${row.ok}  ${row.created_at}\n    ${row.message}\n`,
    );
  }

  const { data: emails, error: emailErr } = await getSupabaseServer()
    .from("email_reminder_events")
    .select("id, reminder_type, context_key, status, sent_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (emailErr) throw new Error(emailErr.message);

  console.log(`=== Email events — ${emails?.length ?? 0} rows ===`);
  for (const row of emails ?? []) {
    const link =
      row.reminder_type === "naukri_credentials_failed"
        ? `  linked_log_id=${row.context_key}`
        : "";
    console.log(
      `  event_id=${row.id}  type=${row.reminder_type}  status=${row.status}${link}\n    sent_at=${row.sent_at ?? "(pending)"}  created=${row.created_at}\n`,
    );
  }

  console.log(
    "In Supabase SQL Editor, use views:\n" +
      "  select * from automation_logs_with_users where user_email ilike '%...%';\n" +
      "  select * from email_reminder_events_with_users where user_id = '<uuid>';",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
