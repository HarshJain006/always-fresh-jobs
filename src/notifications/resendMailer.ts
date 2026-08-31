/**
 * Transactional email via Resend (replaces Brevo SMTP / nodemailer).
 * Server-only — requires RESEND_API_KEY on Netlify.
 * Uses dynamic import so Pi workers without the `resend` package do not crash at startup.
 */

import { getEnv } from "@/lib/env";

export type MailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function apiKey(): string {
  return getEnv("RESEND_API_KEY");
}

function fromAddress(): string {
  const email = getEnv("RESEND_FROM_EMAIL");
  const name = getEnv("RESEND_FROM_NAME") || "DailyResume";
  if (!email) return "";
  return `${name} <${email}>`;
}

export function isResendConfigured(): boolean {
  return Boolean(apiKey() && fromAddress());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;

async function getClient() {
  const key = apiKey();
  if (!key) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY on the server.");
  }
  if (!client) {
    const { Resend } = await import("resend");
    client = new Resend(key);
  }
  return client;
}

export async function sendResendMail(input: MailInput): Promise<boolean> {
  if (!isResendConfigured()) {
    console.warn("[mail] Resend not configured; skipping email send.");
    return false;
  }
  const to = input.to?.trim();
  if (!to) return false;

  try {
    const { data, error } = await (await getClient()).emails.send({
      from: fromAddress(),
      to: [to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (error) {
      throw new Error(error.message || JSON.stringify(error));
    }

    if (!data?.id) {
      throw new Error("Resend returned no message id");
    }

    console.info(`[mail] sent id=${data.id} to=${to}`);
    return true;
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("Cannot find package 'resend'") ||
        err.message.includes("ERR_MODULE_NOT_FOUND"))
    ) {
      console.warn("[mail] resend package not installed; skipping email send.");
      return false;
    }
    throw err;
  }
}
