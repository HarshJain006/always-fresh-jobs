/**
 * Send a test email via Resend.
 *
 * Usage:
 *   npm run mail:test -- you@example.com
 */
import "./load-env";
import { isResendConfigured, sendResendMail } from "../src/notifications/resendMailer";

async function main() {
  const to = (process.argv[2] || "").trim();
  if (!to || !to.includes("@")) {
    console.error("Usage: npm run mail:test -- you@example.com");
    process.exit(1);
  }

  console.log("Resend configured:", isResendConfigured());
  console.log("From:", process.env.RESEND_FROM_EMAIL || "(missing)");
  console.log("To:", to);

  if (!isResendConfigured()) {
    console.error(
      "Missing Resend env — set RESEND_API_KEY and RESEND_FROM_EMAIL in .env / Netlify.",
    );
    process.exit(1);
  }

  const ok = await sendResendMail({
    to,
    subject: "DailyResume email test",
    text: "If you received this, DailyResume email (Resend) is working.",
    html: "<p>If you received this, <strong>DailyResume email (Resend)</strong> is working.</p>",
  });

  if (!ok) {
    console.error("Send returned false.");
    process.exit(1);
  }

  console.log("OK — test email sent. Check inbox (and spam).");
}

main().catch((err) => {
  console.error("Send failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
