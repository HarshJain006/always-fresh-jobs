/**
 * Subscription helpers — days remaining, renewal warnings.
 * Days remaining use IST calendar midnights so the countdown drops by 1 each day at 12:00 AM IST.
 */

import type { User } from "@/database/schemas";
import { checkSubscriptionStatus, checkTrialStatus } from "@/database/users";
import { calendarDaysRemainingIst } from "@/lib/istCalendar";
import { SUBSCRIPTION_WARNING_DAYS, planLabel } from "@/payments/plans";

export { calendarDaysRemainingIst } from "@/lib/istCalendar";

export function getPaidDaysRemaining(user: User, now = new Date()): number {
  if (!user.subscription_expire_at) return 0;
  if (new Date(user.subscription_expire_at).getTime() <= now.getTime()) return 0;

  const status = checkSubscriptionStatus(user);
  if (status !== "active" && status !== "cancelled") return 0;

  return calendarDaysRemainingIst(user.subscription_expire_at, now);
}

export function isSubscriptionEndingSoon(user: User): boolean {
  const days = getPaidDaysRemaining(user);
  return days > 0 && days <= SUBSCRIPTION_WARNING_DAYS;
}

export function formatExpireDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function subscriptionSummary(user: User): {
  kind: "premium" | "trial" | "expired";
  title: string;
  detail: string;
  daysRemaining: number;
  endingSoon: boolean;
  planName: string;
} {
  const status = checkSubscriptionStatus(user);
  if (status === "active") {
    const days = getPaidDaysRemaining(user);
    const planName = planLabel(user.subscription_plan);
    return {
      kind: "premium",
      title: `Premium · ${planName}`,
      detail: `Valid until ${formatExpireDate(user.subscription_expire_at)}`,
      daysRemaining: days,
      endingSoon: days > 0 && days <= SUBSCRIPTION_WARNING_DAYS,
      planName,
    };
  }
  const trial = checkTrialStatus(user);
  if (trial.active) {
    return {
      kind: "trial",
      title: trial.pending ? "Free trial ready" : "Free trial",
      detail: trial.pending
        ? `${trial.daysRemaining} days — starts when you begin daily refresh`
        : `${trial.daysRemaining} day${trial.daysRemaining === 1 ? "" : "s"} remaining`,
      daysRemaining: trial.daysRemaining,
      endingSoon: false,
      planName: "Free trial",
    };
  }
  return {
    kind: "expired",
    title: "Subscription ended",
    detail: "Renew to keep daily refreshes running.",
    daysRemaining: 0,
    endingSoon: false,
    planName: "None",
  };
}
