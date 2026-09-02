/**
 * Test automatic mail cron endpoints (same paths Pi + Netlify scheduled functions use).
 *
 *   npm run mail:check-cron
 */

import "./load-env";
import { invokeCronEndpoint } from "../src/lib/cronTrigger";
import { isResendConfigured } from "../src/notifications/resendMailer";
import { isSupabaseServerConfigured } from "../src/lib/supabase";

async function check(path: string) {
  console.log(`\n→ ${path}`);
  const result = await invokeCronEndpoint(path);
  console.log(`  HTTP ${result.status} ok=${result.ok}`);
  if (result.payload) {
    console.log("  ", JSON.stringify(result.payload, null, 2).split("\n").join("\n   "));
  } else if (result.body) {
    console.log(`   ${result.body.slice(0, 400)}`);
  }
}

async function main() {
  console.log("App URL:", process.env.VITE_APP_URL || process.env.URL || "(default dailyresume.in)");
  console.log("CRON_SECRET:", process.env.CRON_SECRET ? "set" : "MISSING");
  console.log("Supabase:", isSupabaseServerConfigured() ? "ok" : "MISSING");
  console.log("Resend (local):", isResendConfigured() ? "ok" : "MISSING — Netlify must have RESEND_* for automatic sends");

  await check("/api/cron/mail-queue");
  await check("/api/cron/reminders");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
