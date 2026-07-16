/**
 * Server functions for paid plans.
 * activatePaidPlan should only be called after a verified payment in production.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSessionUser } from "@/security/serverAuth";
import { activateSubscription } from "@/payments/razorpay";
import { getPlan, type PaidPlanId } from "@/payments/plans";
import { getAuthoritativeAccess } from "@/security/accessControl";

const PAID_IDS = new Set<PaidPlanId>(["premium_1m", "premium_3m", "premium_6m"]);

export const activatePaidPlan = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string; planId: PaidPlanId }) => data)
  .handler(async ({ data }) => {
    if (!PAID_IDS.has(data.planId)) {
      throw new Error("Invalid plan selected.");
    }
    const plan = getPlan(data.planId);
    if (!plan) throw new Error("Unknown plan.");

    const user = await requireSessionUser(data.sessionToken);

    // When Razorpay is wired: verify payment signature here first, then activate.
    // Until then, activation is allowed for signed-in users selecting a plan
    // (replace this gate with verifyPayment once keys are live).
    const razorpayReady = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
    if (razorpayReady) {
      throw new Error("Complete payment checkout first, then confirm your plan.");
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
