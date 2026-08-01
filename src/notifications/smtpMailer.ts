import nodemailer, { type Transporter } from "nodemailer";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function smtpEnabled(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM_EMAIL,
  );
}
export const isSmtpConfigured = smtpEnabled;

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error("SMTP is not configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.");
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return cachedTransporter;
}

function fromHeader(): string {
  const email = process.env.SMTP_FROM_EMAIL || "";
  const name = process.env.SMTP_FROM_NAME || "DailyResume";
  return `${name} <${email}>`;
}

export async function sendSmtpMail(input: MailInput): Promise<boolean> {
  if (!smtpEnabled()) {
    console.warn("[mail] SMTP not configured; skipping email send.");
    return false;
  }
  if (!input.to) return false;

  const transporter = getTransporter();
  await transporter.sendMail({
    from: fromHeader(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  return true;
}

