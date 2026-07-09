/**
 * Razorpay integration (placeholder).
 *
 * TODO: Wire real Razorpay SDK once keys are added:
 *   - RAZORPAY_KEY_ID (public, safe to ship)
 *   - RAZORPAY_KEY_SECRET (server only, use secrets manager)
 *
 * Flow:
 *   1. Client calls createPayment() -> server creates Razorpay order.
 *   2. Client opens Razorpay checkout with the returned order.
 *   3. Client posts signature back -> verifyPayment() validates via HMAC.
 *   4. activateSubscription() flips the user's subscription flags.
 */

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
  // TODO: Update user record: subscription_status='active', plan='premium_monthly',
  //       subscription_started_at=now, subscription_expire_at=now+30d.
}

export async function cancelSubscription(_userId: string): Promise<void> {
  // TODO: Cancel with Razorpay + mark user subscription_status='cancelled'.
}
