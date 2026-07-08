import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { getCurrentUser, type AppUser } from "@/auth/googleAuth";
import { checkTrialStatus } from "@/database/users";
import { createPayment } from "@/payments/razorpay";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — DailyResume" },
      { name: "description", content: "₹150/month for daily automated resume refresh across all supported job portals." },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => setUser(getCurrentUser()), []);

  const trial = user ? checkTrialStatus(user) : null;

  async function handleSubscribe() {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setLoading(true);
    try {
      await createPayment({ userId: user.id, amountInPaise: 15000, plan: "premium_monthly" });
      toast.success("Payment flow will be enabled once Razorpay keys are added.");
    } catch (e) {
      toast.error("Could not start payment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">Pricing</div>
          <h1 className="mt-3 text-5xl">Stay visible for less than a coffee</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Start with a 2-day free trial. Upgrade to Premium for continuous daily automation across all your job portals.
          </p>
        </div>

        {user && (
          <Card className="mt-10 border-border/60 p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Current plan
            </div>
            <div className="mt-1 text-lg font-semibold">
              {user.subscription_status === "active"
                ? "Premium — Active"
                : trial && trial.daysRemaining > 0
                  ? `Free trial · ${trial.daysRemaining} day${trial.daysRemaining === 1 ? "" : "s"} left`
                  : "Trial expired"}
            </div>
          </Card>
        )}

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card className="border-border/60 p-8">
            <div className="text-sm font-medium text-muted-foreground">Free trial</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-5xl">₹0</span>
              <span className="text-muted-foreground">for 2 days</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              <Row>Upload one resume</Row>
              <Row>Connect one portal</Row>
              <Row>Daily automatic refresh</Row>
              <Row>Activity logs</Row>
            </ul>
            <Button asChild variant="outline" className="mt-8 w-full">
              <Link to={user ? "/dashboard" : "/login"}>
                {user ? "Go to dashboard" : "Start free trial"}
              </Link>
            </Button>
          </Card>

          <Card className="relative border-primary/40 bg-surface p-8 shadow-glow">
            <div className="absolute -top-3 left-8 rounded-full bg-gradient-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              <Crown className="mr-1 inline h-3 w-3" /> Recommended
            </div>
            <div className="text-sm font-medium text-primary">Premium</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-5xl">₹150</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              <Row>Daily automatic resume updates</Row>
              <Row>Priority refresh window</Row>
              <Row>Full activity history</Row>
            </ul>
            <Button
              onClick={handleSubscribe}
              disabled={loading || user?.subscription_status === "active"}
              className="mt-8 w-full bg-gradient-primary shadow-glow"
            >
              {user?.subscription_status === "active"
                ? "You're subscribed"
                : loading
                  ? "Starting…"
                  : "Subscribe now"}
            </Button>
          </Card>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Payments handled securely by Razorpay.
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
