/**
 * IST calendar-day helpers — countdown drops by 1 at midnight Asia/Kolkata.
 */

/** YYYY-MM-DD parts in Asia/Kolkata */
export function istYmd(date: Date): { y: number; m: number; d: number; key: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  return { y, m, d, key: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

/**
 * Whole calendar days from today (IST) until the expire calendar day (IST).
 * Returns 0 if already expired (by exact timestamp).
 * Decrements by 1 every day at 12:00 AM IST.
 */
export function calendarDaysRemainingIst(expireIso: string, now = new Date()): number {
  const expMs = new Date(expireIso).getTime();
  if (!Number.isFinite(expMs) || expMs <= now.getTime()) return 0;

  const today = istYmd(now);
  const expire = istYmd(new Date(expireIso));

  // IST is UTC+5:30 — use noon IST ≈ 06:30 UTC as a stable day anchor
  const todayUtc = Date.UTC(today.y, today.m - 1, today.d, 6, 30, 0);
  const expireUtc = Date.UTC(expire.y, expire.m - 1, expire.d, 6, 30, 0);
  const diffDays = Math.round((expireUtc - todayUtc) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}
