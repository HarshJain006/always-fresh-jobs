/**
 * Drain queued transactional emails locally or on Netlify (uses Resend from .env).
 *
 *   npm run mail:flush-queue
 */

import "./load-env";
import { runMailQueueFlush } from "../src/notifications/reminderEmails";
import { isResendConfigured } from "../src/notifications/resendMailer";
import { isSupabaseServerConfigured } from "../src/lib/supabase";

async function main() {
  console.log("Supabase:", isSupabaseServerConfigured() ? "ok" : "MISSING");
  console.log("Resend:", isResendConfigured() ? "ok" : "MISSING");
  console.log("From:", process.env.RESEND_FROM_EMAIL || "(missing)");

  const result = await runMailQueueFlush();
  console.log("Result:", result);

  if (result.warning) {
    console.error("\nWarning:", result.warning);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
