import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Footer } from "@/components/site/Footer";
import {
  getCurrentUser,
  requireClientSessionToken,
  updateSessionUser,
  type AppUser,
} from "@/auth/googleAuth";
import { PAID_PLANS, type PaidPlanId } from "@/payments/plans";
import { subscriptionSummary } from "@/payments/subscriptionStatus";
import {
  activatePaidPlan,
  createRazorpayOrder,
  verifyAndActivatePaidPlan,
} from "@/routes/payment.functions";
import { openRazorpayCheckout } from "@/lib/razorpayCheckout";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — DailyResume" },
      {
        name: "description",
        content:
          "Plans from ₹199/month. 3 months ₹699 · 6 months ₹899. Keep your resume fresh every day.",
      },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<PaidPlanId | null>(null);
  useEffect(() => setUser(getCurrentUser()), []);

  const summary = user ? subscriptionSummary(user) : null;

  async function handleSubscribe(planId: PaidPlanId) {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setLoadingPlan(planId);
    try {
      const sessionToken = requireClientSessionToken();
      const checkout = await createRazorpayOrder({
        data: { sessionToken, planId },
      });

      let result;
      if (checkout.mode === "dev") {
        result = await activatePaidPlan({ data: { sessionToken, planId } });
      } else {
        const payment = await openRazorpayCheckout({
          key: checkout.keyId,
          amount: checkout.amount,
          currency: checkout.currency,
          name: "DailyResume",
          description: checkout.planName,
          order_id: checkout.orderId,
          prefill: {
            email: checkout.userEmail,
            name: checkout.userName,
          },
          theme: { color: "#0f766e" },
        });

        result = await verifyAndActivatePaidPlan({
          data: {
            sessionToken,
            planId,
            razorpay_order_id: payment.razorpay_order_id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
          },
        });
      }

      updateSessionUser(result.user);
      setUser(result.user);
      toast.success(result.message);
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start your plan.");
    } finally {
      setLoadingPlan(null);
    }
  }

  const hasActivePremium = summary?.kind === "premium";

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">Pricing</div>
          <h1 className="mt-3 text-4xl sm:text-5xl">Stay visible every day</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Start with a 3-day free trial. Pick a Premium plan — access ends exactly when your plan
            ends, with a reminder in the last 7 days.
          </p>
        </div>

        {user && summary && (
          <Card className="mt-10 border-border/60 p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Current plan
            </div>
            <div className="mt-1 text-lg font-semibold">{summary.title}</div>
            <div className="text-sm text-muted-foreground">{summary.detail}</div>
            {summary.endingSoon && (
              <p className="mt-2 text-sm font-medium text-warning-foreground">
                Ends in {summary.daysRemaining} day{summary.daysRemaining === 1 ? "" : "s"} — renew
                to avoid interruption.
              </p>
            )}
          </Card>
        )}

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60 p-6">
            <div className="text-sm font-medium text-muted-foreground">Free trial</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-4xl">₹0</span>
              <span className="text-muted-foreground">for 3 days</span>
            </div>
            <ul className="mt-5 space-y-2 text-sm">
              <Row>Upload one resume</Row>
              <Row>Connect Naukri</Row>
              <Row>Daily automatic refresh</Row>
            </ul>
            <Button asChild variant="outline" className="mt-6 w-full">
              <Link to={user ? "/dashboard" : "/login"}>
                {user ? "Go to dashboard" : "Start free trial"}
              </Link>
            </Button>
          </Card>

          {PAID_PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={
                plan.popular
                  ? "relative border-primary/40 bg-surface p-6 shadow-glow"
                  : "border-border/60 p-6"
              }
            >
              {plan.popular && (
                <div className="absolute -top-3 left-6 rounded-full bg-gradient-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  <Crown className="mr-1 inline h-3 w-3" /> Popular
                </div>
              )}
              <div className="text-sm font-medium text-primary">{plan.name}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-4xl">{plan.label}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{plan.blurb}</p>
              <ul className="mt-5 space-y-2 text-sm">
                <Row>Daily resume refresh</Row>
                <Row>Full activity history</Row>
                <Row>Ends after {plan.months} month{plan.months === 1 ? "" : "s"}</Row>
                <Row>Reminder in last 7 days</Row>
              </ul>
              <Button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan !== null}
                className={
                  plan.popular
                    ? "mt-6 w-full bg-gradient-primary shadow-glow"
                    : "mt-6 w-full"
                }
                variant={plan.popular ? "default" : "outline"}
              >
                {loadingPlan === plan.id
                  ? "Processing…"
                  : hasActivePremium
                    ? `Extend ${plan.name}`
                    : `Get ${plan.name}`}
              </Button>
            </Card>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Access runs only for the plan duration you purchase. Renew anytime before it ends.
        </p>
      </main>
      <Footer />
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span>{children}</span>
    </li>
  );
}
