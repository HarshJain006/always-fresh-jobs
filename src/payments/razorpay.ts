/**
 * Razorpay integration with Standard Checkout.
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
  if (input.amountInPaise < 100) {
    throw new Error("Amount must be at least 100 paise");
  }

  try {
    // <-- replaced network call with robust fetch implementation -->
    const fetchImpl: typeof fetch =
      (globalThis as any).fetch?.bind(globalThis) ??
      // dynamic import only if needed (no hard dependency)
      (await import("node-fetch")).default;

    const keyId = process.env.RAZORPAY_KEY_ID!;
    const keySecret = process.env.RAZORPAY_KEY_SECRET!;

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const response = await fetchImpl("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountInPaise,
        currency: "INR",
        receipt: `receipt_${input.userId}_${Date.now()}`,
      }),
    });

    if (!response.ok) {
      let errBody: any = {};
      try { errBody = await response.json(); } catch { /* ignore parse errors */ }
      const msg =
        errBody?.error?.description ||
        errBody?.description ||
        errBody?.message ||
        `status ${response.status}`;
      throw new Error(`Razorpay API error: ${msg}`);
    }

    const order = await response.json();

    return {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      plan: input.plan,
    };
  } catch (error: any) {
    console.error("[Razorpay createPayment] error:", error?.stack || error);
    throw new Error(`Failed to create Razorpay order: ${error?.message || "unknown error"}`);
  }
}

export async function verifyPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<boolean> {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    console.error("RAZORPAY_KEY_SECRET not configured");
    return false;
  }

  try {
    const body = `${payload.razorpay_order_id}|${payload.razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    const isValid = expectedSignature === payload.razorpay_signature;
    
    if (!isValid) {
      console.error("[Signature Mismatch]", {
        expected: expectedSignature,
        received: payload.razorpay_signature,
      });
    }

    return isValid;
  } catch (error: any) {
    console.error("[Signature Verification Error]", error);
    return false;
  }
}

/**
 * Mark premium after a verified payment.
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
  const updated = await updateUser(
    userId,
    { subscription_status: "cancelled" },
    { allowBillingFields: true },
  );
  if (!updated) throw new Error("Could not cancel subscription — user not found.");
}
