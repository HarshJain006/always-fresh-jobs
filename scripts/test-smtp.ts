/**
 * TEMPORARY — delete after testing mail.
 *
 * Usage:
 *   npx tsx scripts/test-smtp.ts you@example.com
 */
import "./load-env";
import { isSmtpConfigured, sendSmtpMail } from "../src/notifications/smtpMailer";

async function main() {
  const to = (process.argv[2] || "").trim();
  if (!to || !to.includes("@")) {
    console.error("Usage: npx tsx scripts/test-smtp.ts you@example.com");
    process.exit(1);
  }

  console.log("SMTP configured:", isSmtpConfigured());
  console.log("Host:", process.env.SMTP_HOST || "(missing)");
  console.log("Port:", process.env.SMTP_PORT || "(missing)");
  console.log("From:", process.env.SMTP_FROM_EMAIL || "(missing)");
  console.log("To:", to);

  if (!isSmtpConfigured()) {
    console.error(
      "Missing SMTP_* in .env (need SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL).",
    );
    process.exit(1);
  }

  const ok = await sendSmtpMail({
    to,
    subject: "DailyResume SMTP test",
    text: "If you received this, DailyResume SMTP is working.",
    html: "<p>If you received this, <strong>DailyResume SMTP</strong> is working.</p>",
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
