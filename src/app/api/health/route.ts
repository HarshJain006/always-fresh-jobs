import { NextResponse } from "next/server";

export async function GET() {
	try {
		return NextResponse.json(
			{
				ok: true,
				now: new Date().toISOString(),
				razorpay_key_present: !!process.env.RAZORPAY_KEY_ID,
				razorpay_secret_present: !!process.env.RAZORPAY_KEY_SECRET,
				node_version: process.version,
			},
			{ status: 200 },
		);
	} catch (err: any) {
		console.error("[health] error:", err?.stack || err);
		return NextResponse.json({ ok: false, error: "health check failed" }, { status: 500 });
	}
}
