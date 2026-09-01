/**
 * Manually drain queued transactional emails (wrong-password, cap overflow, bulk campaigns).
 *
 * Usage:
 *   npm run mail:flush-queue
 */
import "./load-env";
import { isResendConfigured } from "../src/notifications/resendMailer";
import { isSupabaseServerConfigured } from "../src/lib/supabase";
import { runMailQueueFlush } from "../src/notifications/reminderEmails";

async function main(): Promise<void> {
  console.log("Supabase configured:", isSupabaseServerConfigured());
  console.log("Resend configured:", isResendConfigured());

  if (!isSupabaseServerConfigured()) {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }
  if (!isResendConfigured()) {
    console.error("Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env");
    process.exit(1);
  }

  const result = await runMailQueueFlush();
  console.log("\nQueue flush result:");
  console.log(`  Sent:       ${result.sent}`);
  console.log(`  Sent today: ${result.sentToday} / ${result.cap}`);
}

main().catch((err) => {
  console.error("Flush failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
