/**
 * Branded HTML + plain-text email templates for DailyResume.
 * All links point at dailyresume.in (dashboard / pricing).
 */

const BRAND = {
  name: "DailyResume",
  /** Matches site --gradient-primary (oklch 265 → 220) */
  primary: "#4F46E5",
  primaryDark: "#3730A3",
  accent: "#3B82F6",
  bg: "#F4F6FB",
  card: "#ffffff",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  warning: "#B45309",
  warningBg: "#FFFBEB",
} as const;

export function appBaseUrl(): string {
  return (process.env.VITE_APP_URL || process.env.URL || "https://dailyresume.in").replace(
    /\/$/,
    "",
  );
}

export function dashboardUrl(): string {
  return `${appBaseUrl()}/dashboard`;
}

export function pricingUrl(): string {
  return `${appBaseUrl()}/pricing`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type LayoutInput = {
  preview: string;
  headline: string;
  greeting: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
  secondaryLabel?: string;
  secondaryUrl?: string;
  badge?: string;
  badgeTone?: "default" | "warning" | "success";
  footerNote?: string;
};

function badgeColor(tone: LayoutInput["badgeTone"]): { bg: string; fg: string } {
  if (tone === "warning") return { bg: BRAND.warningBg, fg: BRAND.warning };
  if (tone === "success") return { bg: "#EEF2FF", fg: BRAND.primary };
  return { bg: "#EEF2FF", fg: BRAND.primary };
}

export function renderBrandedEmail(input: LayoutInput): { html: string; text: string } {
  const badge = input.badge
    ? (() => {
        const c = badgeColor(input.badgeTone);
        return `<tr><td style="padding:0 32px 16px;"><span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${c.bg};color:${c.fg};font-size:12px;font-weight:600;letter-spacing:0.02em;">${escapeHtml(input.badge)}</span></td></tr>`;
      })()
    : "";

  const paragraphsHtml = input.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BRAND.text};">${escapeHtml(p)}</p>`,
    )
    .join("");

  const secondaryCta = input.secondaryLabel && input.secondaryUrl
    ? `<a href="${escapeHtml(input.secondaryUrl)}" style="display:inline-block;margin-top:12px;font-size:14px;color:${BRAND.primary};text-decoration:underline;">${escapeHtml(input.secondaryLabel)}</a>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(input.headline)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preview)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${BRAND.card};border-radius:16px;border:1px solid ${BRAND.border};overflow:hidden;box-shadow:0 4px 24px rgba(79,70,229,0.10);">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.accent} 100%);padding:28px 32px;">
              <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">⚡ DailyResume</div>
              <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.85);">Keep your Naukri resume fresh — automatically</div>
            </td>
          </tr>
          ${badge}
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:${BRAND.text};letter-spacing:-0.02em;">${escapeHtml(input.headline)}</h1>
              <p style="margin:0 0 20px;font-size:16px;color:${BRAND.muted};">Hi ${escapeHtml(input.greeting)},</p>
              ${paragraphsHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;">
              <a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:10px;box-shadow:0 4px 14px rgba(79,70,229,0.35);">${escapeHtml(input.ctaLabel)}</a>
              ${secondaryCta}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${BRAND.border};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.muted};">
                ${escapeHtml(input.footerNote || "You're receiving this because you use DailyResume at dailyresume.in.")}
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:${BRAND.muted};">
                <a href="${escapeHtml(appBaseUrl())}" style="color:${BRAND.primary};text-decoration:none;">dailyresume.in</a>
                · <a href="${escapeHtml(dashboardUrl())}" style="color:${BRAND.primary};text-decoration:none;">Dashboard</a>
                · <a href="${escapeHtml(pricingUrl())}" style="color:${BRAND.primary};text-decoration:none;">Pricing</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    input.headline,
    "",
    `Hi ${input.greeting},`,
    "",
    ...input.paragraphs,
    "",
    `${input.ctaLabel}: ${input.ctaUrl}`,
    input.secondaryLabel && input.secondaryUrl ? `${input.secondaryLabel}: ${input.secondaryUrl}` : "",
    "",
    input.footerNote || "DailyResume — dailyresume.in",
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

export function trialEndingEmail(
  name: string,
  daysLeft: number,
  sequenceNo: number,
  maxSends: number,
): { subject: string; html: string; text: string } {
  const dash = dashboardUrl();
  const price = pricingUrl();

  let headline: string;
  let badge: string;
  let paragraphs: string[];

  if (daysLeft === 1) {
    headline = "Last day of your free trial";
    badge = "⏰ Trial ends today";
    paragraphs = [
      "Today is the last day of your 5-day free trial. After midnight, daily Naukri resume refreshes will stop unless you upgrade.",
      "Recruiters notice recently updated profiles first — don't lose your momentum.",
    ];
  } else if (daysLeft === 2) {
    headline = "2 days left on your free trial";
    badge = "Trial ending soon";
    paragraphs = [
      "Your free trial ends in 2 days. Upgrade now to keep your resume refreshing on Naukri every morning before 8 AM IST.",
      "Most users who upgrade stay visible to recruiters throughout their job search.",
    ];
  } else {
    headline = "3 days left on your free trial";
    badge = `Reminder ${sequenceNo}/${maxSends}`;
    paragraphs = [
      "You're halfway through your 5-day free trial. DailyResume has been keeping your Naukri profile active — upgrade to continue after the trial ends.",
      "Plans start affordably and you can cancel anytime from your dashboard.",
    ];
  }

  const { html, text } = renderBrandedEmail({
    preview: headline,
    headline,
    greeting: name,
    badge,
    badgeTone: daysLeft === 1 ? "warning" : "default",
    paragraphs,
    ctaLabel: "Upgrade & keep refreshing",
    ctaUrl: price,
    secondaryLabel: "Open dashboard",
    secondaryUrl: dash,
  });

  return {
    subject:
      daysLeft === 1
        ? "⏰ Last day — your DailyResume trial ends today"
        : `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    html,
    text,
  };
}

export function subscriptionEndingEmail(
  name: string,
  daysLeft: number,
  sequenceNo: number,
  maxSends: number,
): { subject: string; html: string; text: string } {
  const price = pricingUrl();
  const urgent = daysLeft <= 1;

  const { html, text } = renderBrandedEmail({
    preview: `Your plan ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    headline: urgent ? "Your plan expires today" : `Your plan ends in ${daysLeft} days`,
    greeting: name,
    badge: urgent ? "⚠️ Expires today" : `Renewal reminder ${sequenceNo}/${maxSends}`,
    badgeTone: urgent ? "warning" : "default",
    paragraphs: [
      urgent
        ? "Your DailyResume subscription expires today. Renew now so tomorrow morning's Naukri refresh isn't interrupted."
        : `Your DailyResume subscription ends in ${daysLeft} days. Renew to keep daily resume refreshes running automatically.`,
      "Stay at the top of recruiter searches with a profile that's updated every day.",
    ],
    ctaLabel: "Renew subscription",
    ctaUrl: price,
    secondaryLabel: "View dashboard",
    secondaryUrl: dashboardUrl(),
  });

  return {
    subject: urgent
      ? "⚠️ Your DailyResume plan expires today — renew now"
      : `Your DailyResume plan ends in ${daysLeft} days`,
    html,
    text,
  };
}

export function repurchaseEmail(
  name: string,
  kind: "trial" | "subscription",
  sequenceNo: number,
  maxSends: number,
): { subject: string; html: string; text: string } {
  const price = pricingUrl();
  const dash = dashboardUrl();
  const ended = kind === "trial" ? "free trial has ended" : "subscription has ended";

  const { html, text } = renderBrandedEmail({
    preview: "Resume refresh is paused — restart anytime",
    headline: "Your resume refresh is paused",
    greeting: name,
    badge: `Come back · ${sequenceNo}/${maxSends}`,
    badgeTone: "warning",
    paragraphs: [
      `Your DailyResume ${ended}. Without an active plan, your Naukri resume won't be refreshed each morning.`,
      "Restart in under a minute — your setup (resume & credentials) is still saved.",
    ],
    ctaLabel: kind === "trial" ? "Restart with a plan" : "Renew & resume refreshes",
    ctaUrl: price,
    secondaryLabel: "Open dashboard",
    secondaryUrl: dash,
  });

  return {
    subject:
      sequenceNo === 1
        ? "Your DailyResume access ended — restart daily refreshes"
        : `Reminder: restart DailyResume (${sequenceNo}/${maxSends})`,
    html,
    text,
  };
}

export function subscriptionPurchasedEmail(
  name: string,
  planLabel: string,
  expireAt: string,
): { subject: string; html: string; text: string } {
  const dash = dashboardUrl();

  const { html, text } = renderBrandedEmail({
    preview: "Your subscription is active",
    headline: "You're all set — subscription active",
    greeting: name,
    badge: "✓ Payment confirmed",
    badgeTone: "success",
    paragraphs: [
      `Your ${planLabel} DailyResume plan is now active. We'll refresh your Naukri resume every morning before 8 AM IST.`,
      `Valid until ${expireAt} (IST). You can manage everything from your dashboard.`,
    ],
    ctaLabel: "Go to dashboard",
    ctaUrl: dash,
    secondaryLabel: "View pricing",
    secondaryUrl: pricingUrl(),
  });

  return {
    subject: "✓ Your DailyResume subscription is active",
    html,
    text,
  };
}

/** Positive re-engagement for users whose trial or subscription has ended (manual bulk campaign). */
export function expiredAccessReengageEmail(
  name: string,
  kind: "trial" | "subscription",
): { subject: string; html: string; text: string } {
  const price = pricingUrl();
  const dash = dashboardUrl();

  const headline =
    kind === "trial"
      ? "You already know how effortless this feels"
      : "Your profile deserves to stay in the spotlight";

  const paragraphs =
    kind === "trial"
      ? [
          "You tried DailyResume and experienced how easy it is to keep your Naukri resume fresh — without logging in every day. We'd love to help you continue that momentum.",
          "On Naukri, recruiters often notice profiles updated in the last few days first. A daily refresh before 8 AM IST keeps you in that active layer while you focus on applications and interviews.",
          "Your resume and Naukri setup are still saved. Choose a plan, tap Start, and you're back in under a minute — many job seekers see stronger profile visibility when they stay consistent.",
        ]
      : [
          "Your DailyResume subscription has ended, but the hardest part — setting everything up — is already done. Your resume and Naukri credentials are still saved and ready to go.",
          "Staying visible on Naukri is a daily game. Profiles refreshed every morning signal to recruiters that you're actively looking — and that can mean more views, more calls, and more opportunities.",
          "Renewing takes less than a minute. Pick a plan that fits your job search and let DailyResume handle the daily refresh again — so you never fall off recruiters' radar.",
        ];

  const { html, text } = renderBrandedEmail({
    preview: "Get back to daily Naukri resume refreshes — your setup is already saved",
    headline,
    greeting: name,
    badge: kind === "trial" ? "Continue your momentum" : "Welcome back",
    badgeTone: "success",
    paragraphs,
    ctaLabel: kind === "trial" ? "View plans & get started" : "Renew & stay visible",
    ctaUrl: price,
    secondaryLabel: "Open dashboard",
    secondaryUrl: dash,
    footerNote:
      "You're receiving this because your DailyResume trial or subscription has ended.",
  });

  return {
    subject:
      kind === "trial"
        ? "Keep your Naukri profile active — you're one step away"
        : "Ready to get back on top of recruiter searches?",
    html,
    text,
  };
}

/** Sent after signup — thanks the user and explains how to get started. */
export function welcomeThankYouEmail(name: string): { subject: string; html: string; text: string } {
  const dash = dashboardUrl();

  const { html, text } = renderBrandedEmail({
    preview: "Welcome to DailyResume — your Naukri profile stays fresh, automatically",
    headline: "Thank you for choosing DailyResume",
    greeting: name,
    badge: "Welcome aboard",
    badgeTone: "success",
    paragraphs: [
      "We're glad you're here. DailyResume keeps your Naukri resume updated every morning before 8 AM IST — so recruiters see an active, recently refreshed profile without you lifting a finger.",
      "Getting started takes just a few minutes: upload your resume, connect your Naukri credentials, and tap Start on your dashboard. Your 5-day free trial begins when automation runs for the first time.",
      "Visit your dashboard anytime to manage your setup and track daily refresh activity.",
    ],
    ctaLabel: "Set up my dashboard",
    ctaUrl: dash,
    secondaryLabel: "See how it works",
    secondaryUrl: pricingUrl(),
    footerNote:
      "You're receiving this because you created an account at dailyresume.in.",
  });

  return {
    subject: "Welcome to DailyResume — thank you for joining us",
    html,
    text,
  };
}

export function credentialFailureEmail(name: string): { subject: string; html: string; text: string } {
  const dash = dashboardUrl();

  const { html, text } = renderBrandedEmail({
    preview: "Action needed — Naukri login failed",
    headline: "Naukri login failed",
    greeting: name,
    badge: "⚠️ Action required",
    badgeTone: "warning",
    paragraphs: [
      "We couldn't log in to your Naukri account — the username or password saved in DailyResume appears incorrect.",
      "Daily refresh is paused until you update your credentials. Fix this now so recruiters keep seeing your profile as recently updated.",
    ],
    ctaLabel: "Update Naukri credentials",
    ctaUrl: dash,
    footerNote:
      "You receive this each time a login fails due to incorrect credentials. No email is sent when uploads succeed.",
  });

  return {
    subject: "⚠️ Action needed — update your Naukri password on DailyResume",
    html,
    text,
  };
}
