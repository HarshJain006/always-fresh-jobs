/**
 * Razorpay integration with Standard Checkout.
 *
 * After a verified payment, call activateSubscription(userId, planId).
 * Expiry is stored on the user row and enforced server-side.
 */

import { updateUser } from "@/database/users";
import { addMonths, getPlan, type PaidPlanId } from "@/payments/plans";
import type { SubscriptionPlan } from "@/database/schemas";
import crypto from "crypto";

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

export async function createPayment(input: CreatePaymentInput): Promise<RazorpayOrder> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) throw new Error("RAZORPAY_KEY_ID not configured");

  if (input.amountInPaise < 100) {
    throw new Error("Amount must be at least 100 paise");
  }

  try {
    const Razorpay = require("razorpay");
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: input.amountInPaise,
      currency: "INR",
      receipt: `receipt_${input.userId}_${Date.now()}`,
    });

    return {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      plan: input.plan,
    };
  } catch (error: any) {
    throw new Error(`Failed to create Razorpay order: ${error.message}`);
  }
}

export async function verifyPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<boolean> {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET not configured");

  try {
    const body = `${payload.razorpay_order_id}|${payload.razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    return expectedSignature === payload.razorpay_signature;
  } catch (error: any) {
    console.error("Signature verification error:", error);
    return false;
  }
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
