import type { Config } from "@netlify/functions";

async function invokeCron(path: string): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  const base = (process.env.URL || process.env.VITE_APP_URL || "https://dailyresume.in").replace(
    /\/$/,
    "",
  );
  if (!secret) {
    throw new Error("CRON_SECRET is not set on Netlify");
  }

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
    signal: AbortSignal.timeout(25_000),
  });
  const body = await res.text();
  console.log(`[scheduled-mail-queue] ${res.status} ${body.slice(0, 400)}`);
  if (!res.ok) {
    throw new Error(`mail-queue returned ${res.status}: ${body.slice(0, 200)}`);
  }
}

/** Drain queued emails every 10 minutes (wrong-password, cap overflow). */
export default async () => {
  await invokeCron("/api/cron/mail-queue");
};

export const config: Config = {
  schedule: "*/10 * * * *",
};
