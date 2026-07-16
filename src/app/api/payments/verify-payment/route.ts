import { verifyPayment, activateSubscription } from "@/payments/razorpay";
import type { PaidPlanId } from "@/payments/plans";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      console.error("[verify-payment] invalid JSON");
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planId } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment fields" }, { status: 400 });
    }
    if (!userId || !planId) {
      return NextResponse.json({ error: "Missing userId or planId" }, { status: 400 });
    }

    const valid = await verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
    if (!valid) {
      console.warn("[verify-payment] signature mismatch", { razorpay_order_id, razorpay_payment_id });
      return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
    }

    try {
      await activateSubscription(userId, planId as PaidPlanId);
    } catch (actErr: any) {
      console.error("[verify-payment] activateSubscription failed:", actErr?.stack || actErr);
      return NextResponse.json({ error: "Failed to activate subscription" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("[verify-payment] unexpected error:", err?.stack || err);
    return NextResponse.json({ error: err?.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Payments verify-payment endpoint. Use POST." }, { status: 200 });
}
