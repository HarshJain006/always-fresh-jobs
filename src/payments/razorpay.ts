/**
 * Razorpay integration (placeholder).
 *
 * Plan: Premium is billed MONTHLY at ₹150 (15000 paise).
 * There is no other billing cadence — no weekly, yearly, or lifetime tier.
 *
 * TODO: Wire real Razorpay SDK once keys are added:
 *   - RAZORPAY_KEY_ID (public, safe to ship)
 *   - RAZORPAY_KEY_SECRET (server only, use secrets manager)
 *
 * Flow:
 *   1. Client calls createPayment() -> server creates a Razorpay monthly order.
 *   2. Client opens Razorpay checkout with the returned order.
 *   3. Client posts signature back -> verifyPayment() validates via HMAC.
 *   4. activateSubscription() flips the user's subscription flags for 30 days.
 *      Automation is gated by canUseAutomation(user), so it stays off until
 *      this activation succeeds.
 */

export const PREMIUM_MONTHLY_PAISE = 15000; // ₹150 / month
export const SUBSCRIPTION_PERIOD_DAYS = 30;

export interface CreatePaymentInput {
  userId: string;
  amountInPaise: number;
  plan: "premium_monthly";
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: "INR";
  keyId: string;
}

export async function createPayment(_input: CreatePaymentInput): Promise<RazorpayOrder> {
  // TODO: Call Razorpay `orders.create` from the server and return the order.
  //       amount must equal PREMIUM_MONTHLY_PAISE; reject any other value.
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

export async function activateSubscription(_userId: string): Promise<void> {
  // TODO: Update user record after successful monthly payment:
  //   subscription_status = 'active'
  //   subscription_plan   = 'premium_monthly'
  //   subscription_started_at = now
  //   subscription_expire_at  = now + SUBSCRIPTION_PERIOD_DAYS
  // Until this runs, canUseAutomation() will keep the scheduler skipping the user.
}

export async function cancelSubscription(_userId: string): Promise<void> {
  // TODO: Cancel with Razorpay + mark user subscription_status='cancelled'.
  //       The scheduler stops the user automatically on the next tick via canUseAutomation().
}
