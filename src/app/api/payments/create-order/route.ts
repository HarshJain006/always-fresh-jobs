import { createPayment } from "@/payments/razorpay";
import type { CreatePaymentInput } from "@/payments/razorpay";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amountInPaise, plan } = body as CreatePaymentInput;

    if (!userId || !amountInPaise || !plan) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const order = await createPayment({ userId, amountInPaise, plan });
    return NextResponse.json(order, { status: 200 });
  } catch (error: any) {
    console.error("[Create Order Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to create order" },
      { status: 500 },
    );
  }
}
