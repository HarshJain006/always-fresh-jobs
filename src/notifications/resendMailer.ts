/**
 * Transactional email via Resend (replaces Brevo SMTP / nodemailer).
 * Server-only — requires RESEND_API_KEY on Netlify.
 */

import { Resend } from "resend";
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

let client: Resend | null = null;

function getClient(): Resend {
  const key = apiKey();
  if (!key) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY on the server.");
  }
  if (!client) client = new Resend(key);
  return client;
}

export async function sendResendMail(input: MailInput): Promise<boolean> {
  if (!isResendConfigured()) {
    console.warn("[mail] Resend not configured; skipping email send.");
    return false;
  }
  const to = input.to?.trim();
  if (!to) return false;

  const { data, error } = await getClient().emails.send({
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
}
