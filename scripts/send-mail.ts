/**
 * Manually send branded DailyResume emails via Resend (local or Netlify env).
 *
 * Usage:
 *   npm run mail:send -- list
 *   npm run mail:send -- test you@example.com
 *   npm run mail:send -- welcome you@example.com
 *   npm run mail:send -- welcome you@example.com "Harsh"
 *   npm run mail:send -- welcome-all --dry-run
 *   npm run mail:send -- welcome-all --confirm
 */
import "./load-env";
import {
  credentialFailureEmail,
  subscriptionPurchasedEmail,
  trialEndingEmail,
  welcomeThankYouEmail,
} from "../src/notifications/emailTemplates";
import { isResendConfigured, sendResendMail } from "../src/notifications/resendMailer";
import { sendWelcomeThankYouToAllUsers } from "../src/notifications/welcomeBulkEmail";

type MailKind = "test" | "welcome" | "credentials" | "purchased" | "trial-ending";

const KINDS: Record<
  MailKind,
  { label: string; usage: string; minArgs: number }
> = {
  test: {
    label: "Plain connectivity test",
    usage: "npm run mail:send -- test you@example.com",
    minArgs: 1,
  },
  welcome: {
    label: "Thank-you / welcome to one address",
    usage: 'npm run mail:send -- welcome you@example.com ["Name"]',
    minArgs: 1,
  },
  credentials: {
    label: "Wrong Naukri password alert (preview)",
    usage: 'npm run mail:send -- credentials you@example.com ["Name"]',
    minArgs: 1,
  },
  purchased: {
    label: "Subscription purchase confirmation (preview)",
    usage:
      'npm run mail:send -- purchased you@example.com "Name" "1 Month" "15 Mar 2026"',
    minArgs: 4,
  },
  "trial-ending": {
    label: "Trial ending reminder (preview, 1 day left)",
    usage: 'npm run mail:send -- trial-ending you@example.com ["Name"]',
    minArgs: 1,
  },
};

function printHelp(): void {
  console.log(`
DailyResume manual email sender (Resend)

Requires RESEND_API_KEY, RESEND_FROM_EMAIL, and SUPABASE_SERVICE_ROLE_KEY in .env

Single-recipient commands:
`);
  for (const [kind, info] of Object.entries(KINDS)) {
    console.log(`  ${kind.padEnd(14)} ${info.label}`);
    console.log(`  ${"".padEnd(14)} ${info.usage}`);
    console.log("");
  }
  console.log(`Bulk commands (fetch users from Supabase):
  welcome-all    Thank-you to all active users (once per user, idempotent)
                 npm run mail:send -- welcome-all --dry-run
                 npm run mail:send -- welcome-all --confirm

  list           Show this help`);
}

function buildMessage(
  kind: MailKind,
  args: string[],
): { subject: string; html: string; text: string } {
  const email = args[0];
  const name = args[1]?.trim() || email.split("@")[0] || "there";

  switch (kind) {
    case "test":
      return {
        subject: "DailyResume email test",
        text: "If you received this, DailyResume email (Resend) is working correctly.",
        html: `<p>If you received this, <strong>DailyResume email (Resend)</strong> is working correctly.</p>`,
      };
    case "welcome":
      return welcomeThankYouEmail(name);
    case "credentials":
      return credentialFailureEmail(name);
    case "purchased": {
      const plan = args[2]?.trim() || "1 Month";
      const expireAt = args[3]?.trim() || "your renewal date";
      return subscriptionPurchasedEmail(name, plan, expireAt);
    }
    case "trial-ending":
      return trialEndingEmail(name, 1, 3, 3);
    default:
      throw new Error(`Unknown kind: ${kind}`);
  }
}

async function runWelcomeAll(args: string[]): Promise<void> {
  const dryRun = args.includes("--dry-run");
  const confirm = args.includes("--confirm");

  if (!dryRun && !confirm) {
    console.error(
      "Bulk welcome email requires --dry-run (preview) or --confirm (send).\n\n" +
        "  npm run mail:send -- welcome-all --dry-run\n" +
        "  npm run mail:send -- welcome-all --confirm",
    );
    process.exit(1);
  }

  console.log("Mode:", dryRun ? "dry-run (no emails sent)" : "send");
  console.log("Resend configured:", isResendConfigured());
  console.log("From:", process.env.RESEND_FROM_EMAIL || "(missing)");

  const result = await sendWelcomeThankYouToAllUsers({ dryRun });

  console.log("\nResults:");
  console.log(`  Active users in Supabase: ${result.total}`);
  if (dryRun) {
    console.log(`  Would send now:         ${result.sent}`);
    console.log(`  Already sent / queued:  ${result.skipped}`);
    console.log("\nRun with --confirm to send for real.");
  } else {
    console.log(`  Sent:                   ${result.sent}`);
    console.log(`  Queued (daily cap):     ${result.queued}`);
    console.log(`  Skipped (already done): ${result.skipped}`);
    console.log(`  Failed:                 ${result.failed}`);
    if (result.queued > 0) {
      console.log(
        "\nSome emails were queued due to the 95/day cap. Re-run tomorrow or trigger /api/cron/reminders.",
      );
    }
  }
}

async function main(): Promise<void> {
  const kind = (process.argv[2] || "").trim().toLowerCase();
  const rest = process.argv.slice(3);

  if (!kind || kind === "list" || kind === "help" || kind === "-h" || kind === "--help") {
    printHelp();
    process.exit(kind ? 0 : 1);
  }

  if (kind === "welcome-all") {
    await runWelcomeAll(rest);
    return;
  }

  if (!(kind in KINDS)) {
    console.error(`Unknown email kind: ${kind}\n`);
    printHelp();
    process.exit(1);
  }

  const info = KINDS[kind as MailKind];
  const to = (rest[0] || "").trim();

  if (!to || !to.includes("@")) {
    console.error(`Invalid or missing email address.\n\nUsage: ${info.usage}`);
    process.exit(1);
  }

  if (rest.length < info.minArgs) {
    console.error(`Not enough arguments.\n\nUsage: ${info.usage}`);
    process.exit(1);
  }

  console.log("Resend configured:", isResendConfigured());
  console.log("From:", process.env.RESEND_FROM_EMAIL || "(missing)");
  console.log("Kind:", kind);
  console.log("To:", to);

  if (!isResendConfigured()) {
    console.error(
      "\nMissing Resend env — set RESEND_API_KEY and RESEND_FROM_EMAIL in .env",
    );
    process.exit(1);
  }

  const { subject, html, text } = buildMessage(kind as MailKind, rest);
  console.log("Subject:", subject);

  const ok = await sendResendMail({ to, subject, html, text });
  if (!ok) {
    console.error("Send returned false.");
    process.exit(1);
  }

  console.log("\nOK — email sent. Check inbox (and spam folder).");
}

main().catch((err) => {
  console.error("Send failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
