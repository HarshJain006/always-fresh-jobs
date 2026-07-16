/**
 * Paid subscription plans — source of truth for pricing + duration.
 */

import type { SubscriptionPlan } from "@/database/schemas";

export type PaidPlanId = "premium_1m" | "premium_3m" | "premium_6m";

export interface PlanDefinition {
  id: PaidPlanId;
  /** Legacy DB value alias (optional) */
  legacyId?: SubscriptionPlan;
  name: string;
  months: number;
  priceInr: number;
  amountInPaise: number;
  label: string;
  blurb: string;
  popular?: boolean;
}

export const PAID_PLANS: PlanDefinition[] = [
  {
    id: "premium_1m",
    legacyId: "premium_monthly",
    name: "1 Month",
    months: 1,
    priceInr: 199,
    amountInPaise: 19900,
    label: "₹199",
    blurb: "Perfect to try Premium",
  },
  {
    id: "premium_3m",
    name: "3 Months",
    months: 3,
    priceInr: 699,
    amountInPaise: 69900,
    label: "₹699",
    blurb: "Best value for job season",
    popular: true,
  },
  {
    id: "premium_6m",
    name: "6 Months",
    months: 6,
    priceInr: 899,
    amountInPaise: 89900,
    label: "₹899",
    blurb: "Lowest monthly cost",
  },
];

export function getPlan(planId: string): PlanDefinition | undefined {
  if (planId === "premium_monthly") return PAID_PLANS.find((p) => p.id === "premium_1m");
  return PAID_PLANS.find((p) => p.id === planId);
}

export function planLabel(planId: string | null | undefined): string {
  if (!planId || planId === "free_trial") return "Free trial";
  return getPlan(planId)?.name ?? "Premium";
}

/** Add calendar months in a stable way (local date math). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Handle month overflow (e.g. Jan 31 + 1 month)
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export const SUBSCRIPTION_WARNING_DAYS = 7;
