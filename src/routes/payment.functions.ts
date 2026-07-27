/**
 * Server functions for paid plans and Razorpay checkout.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSessionUser } from "@/security/serverAuth";
import {
  activateSubscription,
  createPayment,
  fetchRazorpayOrder,
  verifyPayment,
} from "@/payments/razorpay";
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

function requireRazorpayConfigured(): void {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Payments are not configured. Please try again later.");
  }
}

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string; planId: PaidPlanId }) => data)
  .handler(async ({ data }) => {
    requireRazorpayConfigured();
    const plan = assertPaidPlan(data.planId);
    const user = await requireSessionUser(data.sessionToken);

    const order = await createPayment({
      userId: user.id,
      amountInPaise: plan.amountInPaise,
      plan: data.planId,
    });

    return {
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
    requireRazorpayConfigured();
    const plan = assertPaidPlan(data.planId);
    const user = await requireSessionUser(data.sessionToken);

    const valid = await verifyPayment({
      razorpay_order_id: data.razorpay_order_id,
      razorpay_payment_id: data.razorpay_payment_id,
      razorpay_signature: data.razorpay_signature,
    });

    if (!valid) {
      throw new Error("Payment verification failed. Please contact support if you were charged.");
    }

    const order = await fetchRazorpayOrder(data.razorpay_order_id);
    if (order.amount !== plan.amountInPaise) {
      throw new Error("Payment amount does not match the selected plan.");
    }
    if (order.notes?.user_id && order.notes.user_id !== user.id) {
      throw new Error("Payment does not belong to this account.");
    }
    if (order.notes?.plan && order.notes.plan !== data.planId) {
      throw new Error("Payment plan mismatch.");
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
