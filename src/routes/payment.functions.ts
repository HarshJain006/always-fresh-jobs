/**
 * Server functions for paid plans and Razorpay checkout.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSessionUser } from "@/security/serverAuth";
import { activateSubscription, createPayment, verifyPayment } from "@/payments/razorpay";
import { getPlan, type PaidPlanId } from "@/payments/plans";
import { getAuthoritativeAccess } from "@/security/accessControl";

const PAID_IDS = new Set<PaidPlanId>(["premium_1m", "premium_3m", "premium_6m"]);

function assertPaidPlan(planId: string) {
  if (!PAID_IDS.has(planId as PaidPlanId)) {
    throw new Error("Invalid plan selected.");
  }
  const plan = getPlan(planId);
  if (!plan) throw new Error("Unknown plan.");
  return plan;
}

function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string; planId: PaidPlanId }) => data)
  .handler(async ({ data }) => {
    const plan = assertPaidPlan(data.planId);
    const user = await requireSessionUser(data.sessionToken);

    if (!razorpayConfigured()) {
      return { mode: "dev" as const, planId: plan.id };
    }

    const order = await createPayment({
      userId: user.id,
      amountInPaise: plan.amountInPaise,
      plan: data.planId,
    });

    return {
      mode: "razorpay" as const,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId,
      planId: plan.id,
      planName: plan.name,
      userEmail: user.email,
      userName: user.name,
    };
  });

export const verifyAndActivatePaidPlan = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sessionToken: string;
      planId: PaidPlanId;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const plan = assertPaidPlan(data.planId);
    const user = await requireSessionUser(data.sessionToken);

    if (!razorpayConfigured()) {
      throw new Error("Payments are not configured on the server.");
    }

    const valid = await verifyPayment({
      razorpay_order_id: data.razorpay_order_id,
      razorpay_payment_id: data.razorpay_payment_id,
      razorpay_signature: data.razorpay_signature,
    });

    if (!valid) {
      throw new Error("Payment verification failed. Please contact support if you were charged.");
    }

    const planFromRequest = getPlan(data.planId);
    if (!planFromRequest || planFromRequest.amountInPaise < 100) {
      throw new Error("Invalid plan selected.");
    }

    await activateSubscription(user.id, data.planId);
    const access = await getAuthoritativeAccess(user.id);

    return {
      ok: true,
      user: access.user,
      plan: plan.id,
      planName: plan.name,
      expireAt: access.subscriptionExpireAt,
      daysRemaining: access.daysRemaining,
      message: `${plan.name} plan is active until your renewal date.`,
    };
  });

/** Dev-only activation when Razorpay keys are not set. */
export const activatePaidPlan = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string; planId: PaidPlanId }) => data)
  .handler(async ({ data }) => {
    const plan = assertPaidPlan(data.planId);
    const user = await requireSessionUser(data.sessionToken);

    if (razorpayConfigured()) {
      throw new Error("Use checkout to pay for your plan.");
    }

    await activateSubscription(user.id, data.planId);
    const access = await getAuthoritativeAccess(user.id);

    return {
      ok: true,
      user: access.user,
      plan: plan.id,
      planName: plan.name,
      expireAt: access.subscriptionExpireAt,
      daysRemaining: access.daysRemaining,
      message: `${plan.name} plan is active until your renewal date.`,
    };
  });
