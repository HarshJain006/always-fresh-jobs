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
  console.log(`[scheduled-reminders] ${res.status} ${body.slice(0, 400)}`);
  if (!res.ok) {
    throw new Error(`reminders returned ${res.status}: ${body.slice(0, 200)}`);
  }
}

/** Trial/subscription reminder sweep — 10:00 AM IST (04:30 UTC). */
export default async () => {
  await invokeCron("/api/cron/reminders");
};

export const config: Config = {
  schedule: "30 4 * * *",
};
