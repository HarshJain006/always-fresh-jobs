import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { googleLogin } from "@/auth/googleAuth";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — DailyResume" },
      { name: "description", content: "Sign in to DailyResume with Google to start your free 3-day trial." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    try {
      await googleLogin();
      toast.success("Welcome to DailyResume!");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error("Sign-in failed. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="hero-bg min-h-screen">
      <Toaster />
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12">
        <Link to="/" className="mb-8 flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
            <Zap className="h-4 w-4" />
          </span>
          <span className="text-lg tracking-tight">DailyResume</span>
        </Link>
        <Card className="w-full border-border/60 bg-surface p-8 shadow-elegant">
          <h1 className="text-3xl">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with Google to continue. New here? We'll start your 3-day free trial automatically.
          </p>
          <Button
            onClick={handleGoogle}
            disabled={loading}
            variant="outline"
            className="mt-8 h-12 w-full text-base"
          >
            <GoogleIcon className="mr-3 h-5 w-5" />
            {loading ? "Signing you in…" : "Continue with Google"}
          </Button>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our Terms and Privacy Policy.
          </p>
        </Card>
        <Link to="/" className="mt-6 text-sm text-muted-foreground hover:text-foreground">
          ← Back to homepage
        </Link>
      </div>
    </div>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.67-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.67 2.84C6.72 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
