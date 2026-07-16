/**
 * Razorpay integration (placeholder) + subscription activation.
 *
 * After a verified payment, call activateSubscription(userId, planId).
 * Expiry is stored on the user row and enforced server-side.
 */

import { updateUser } from "@/database/users";
import { addMonths, getPlan, type PaidPlanId } from "@/payments/plans";
import type { SubscriptionPlan } from "@/database/schemas";

export interface CreatePaymentInput {
  userId: string;
  amountInPaise: number;
  plan: PaidPlanId;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: "INR";
  keyId: string;
  plan: PaidPlanId;
}

export async function createPayment(_input: CreatePaymentInput): Promise<RazorpayOrder> {
  // TODO: Call Razorpay `orders.create` from the server and return the order.
  throw new Error("Razorpay not configured yet");
}

export async function verifyPayment(_payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<boolean> {
  // TODO: HMAC-SHA256 verification with RAZORPAY_KEY_SECRET.
  return false;
}

/**
 * Mark premium after a verified payment.
 * Extends from now (or from current expire_at if still active — stack renewals).
 */
export async function activateSubscription(userId: string, planId: PaidPlanId): Promise<void> {
  const plan = getPlan(planId);
  if (!plan) throw new Error("Unknown subscription plan.");

  const { findUserById } = await import("@/database/users");
  const existing = await findUserById(userId);
  if (!existing) throw new Error("Could not activate subscription — user not found.");

  const now = new Date();
  const currentExp = existing.subscription_expire_at
    ? new Date(existing.subscription_expire_at)
    : null;
  const base =
    existing.subscription_status === "active" && currentExp && currentExp.getTime() > now.getTime()
      ? currentExp
      : now;
  const expire = addMonths(base, plan.months);

  const updated = await updateUser(
    userId,
    {
      subscription_status: "active",
      subscription_plan: plan.id as SubscriptionPlan,
      subscription_started_at:
        existing.subscription_status === "active" && existing.subscription_started_at
          ? existing.subscription_started_at
          : now.toISOString(),
      subscription_expire_at: expire.toISOString(),
    },
    { allowBillingFields: true },
  );
  if (!updated) throw new Error("Could not activate subscription — user not found.");
}

export async function cancelSubscription(userId: string): Promise<void> {
  // Access continues until subscription_expire_at; mark cancelled for display.
  const updated = await updateUser(
    userId,
    { subscription_status: "cancelled" },
    { allowBillingFields: true },
  );
  if (!updated) throw new Error("Could not cancel subscription — user not found.");
}
