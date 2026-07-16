/**
 * Subscription helpers — days remaining, renewal warnings.
 */

import type { User } from "@/database/schemas";
import { checkSubscriptionStatus, checkTrialStatus } from "@/database/users";
import { SUBSCRIPTION_WARNING_DAYS, planLabel } from "@/payments/plans";

export function getPaidDaysRemaining(user: User): number {
  if (!user.subscription_expire_at) return 0;
  const msLeft = new Date(user.subscription_expire_at).getTime() - Date.now();
  if (msLeft <= 0) return 0;
  // Only count when we are (or were) on a paid plan window
  const status = checkSubscriptionStatus(user);
  if (status !== "active" && status !== "cancelled") return 0;
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
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
      title: "Free trial",
      detail: `${trial.daysRemaining} day${trial.daysRemaining === 1 ? "" : "s"} remaining`,
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
