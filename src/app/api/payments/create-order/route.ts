import { createPayment } from "@/payments/razorpay";
import type { CreatePaymentInput } from "@/payments/razorpay";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      console.error("[create-order] invalid JSON body");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { userId, amountInPaise, plan } = body as CreatePaymentInput;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }
    if (!Number.isInteger(amountInPaise) || amountInPaise < 100) {
      return NextResponse.json(
        { error: "Invalid amountInPaise (min 100)" },
        { status: 400 },
      );
    }
    if (!plan || typeof plan !== "string") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const order = await createPayment({ userId, amountInPaise, plan });
    return NextResponse.json(order, { status: 200 });
  } catch (err: any) {
    console.error("[create-order] unexpected error:", err?.stack || err);
    return NextResponse.json(
      { error: err?.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: "Payments create-order endpoint. Use POST." },
    { status: 200 },
  );
}
