import { verifyPayment, activateSubscription } from "@/payments/razorpay";
import type { PaidPlanId } from "@/payments/plans";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planId } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId || !planId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const isValid = await verifyPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 400 },
      );
    }

    await activateSubscription(userId, planId as PaidPlanId);

    return NextResponse.json(
      { success: true, message: "Payment verified and subscription activated" },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[Verify Payment Error]", error);
    return NextResponse.json(
      { error: error.message || "Payment verification failed" },
      { status: 500 },
    );
  }
}
