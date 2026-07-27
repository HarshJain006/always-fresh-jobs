/**
 * Production runtime detection (Netlify / live domain).
 */

export function isProductionRuntime(): boolean {
  if (typeof process === "undefined") return false;

  if (process.env.NODE_ENV === "production") return true;
  if (process.env.NETLIFY === "true") return true;
  if (process.env.CONTEXT === "production" || process.env.CONTEXT === "deploy-preview") {
    return process.env.CONTEXT === "production";
  }

  const appUrl = (process.env.VITE_APP_URL || process.env.URL || "").toLowerCase();
  if (appUrl.includes("dailyresume.in")) return true;

  return false;
}

export function assertLiveRazorpayKeyId(keyId: string): void {
  if (!isProductionRuntime()) return;

  if (keyId.startsWith("rzp_test_")) {
    throw new Error(
      "Razorpay test keys cannot be used in production. Set live keys (rzp_live_…) in Netlify.",
    );
  }
  if (!keyId.startsWith("rzp_live_")) {
    throw new Error("Invalid Razorpay key. Use your live key from the Razorpay dashboard.");
  }
}
