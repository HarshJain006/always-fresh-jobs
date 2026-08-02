import { createFileRoute, Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import {
  CheckCircle2,
  Download,
  MonitorSmartphone,
  Share,
  Smartphone,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { usePwaInstall } from "@/pwa/usePwaInstall";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download app — DailyResume" },
      {
        name: "description",
        content:
          "Install DailyResume on your phone or computer. Open it like a native app — no App Store needed.",
      },
    ],
  }),
  component: DownloadPage,
});

function DownloadPage() {
  const { canPrompt, installed, promptInstall } = usePwaInstall();

  async function handleInstall() {
    const ok = await promptInstall();
    if (ok) toast.success("DailyResume installed.");
    else if (!canPrompt) toast.message("Follow the steps below for your device.");
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <Zap className="h-6 w-6" />
          </div>
          <div className="mt-6 text-xs font-semibold uppercase tracking-widest text-primary">
            Progressive Web App
          </div>
          <h1 className="mt-3 text-4xl tracking-tight sm:text-5xl">Install DailyResume</h1>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Add it to your home screen for one-tap access — works on phone and desktop, no store
            download required.
          </p>
        </div>

        <Card className="mt-10 border-border/60 p-6 text-center shadow-elegant">
          {installed ? (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <div className="text-lg font-semibold">Already installed</div>
              <p className="text-sm text-muted-foreground">
                You’re using the app version. Open it from your home screen or app launcher anytime.
              </p>
              <Button asChild className="mt-2 bg-gradient-primary shadow-glow">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <img
                src="/pwa-icon-192.png"
                alt="DailyResume app icon"
                width={72}
                height={72}
                className="rounded-2xl shadow-elegant"
              />
              <div className="text-lg font-semibold">Get the app</div>
              <p className="max-w-md text-sm text-muted-foreground">
                {canPrompt
                  ? "Your browser can install DailyResume now. Tap below to add it."
                  : "If the install button isn’t available, use the platform steps below."}
              </p>
              <Button
                size="lg"
                className="mt-2 bg-gradient-primary shadow-glow"
                onClick={() => {
                  if (canPrompt) void handleInstall();
                  else document.getElementById("install-guides")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                {canPrompt ? "Install app" : "See install steps"}
              </Button>
              {!canPrompt && (
                <p className="text-xs text-muted-foreground">
                  Tip: Chrome (Android) or Edge / Chrome (desktop) can show a one-tap install.
                </p>
              )}
            </div>
          )}
        </Card>

        <div id="install-guides" className="mt-10 grid scroll-mt-24 gap-4 sm:grid-cols-2">
          <GuideCard
            icon={Smartphone}
            title="iPhone / iPad"
            steps={[
              "Open dailyresume.in in Safari",
              "Tap Share",
              "Choose Add to Home Screen",
              "Tap Add",
            ]}
          />
          <GuideCard
            icon={Smartphone}
            title="Android"
            steps={[
              "Open in Chrome",
              "Tap the menu (⋮)",
              "Tap Install app or Add to Home screen",
              "Confirm Install",
            ]}
          />
          <GuideCard
            icon={MonitorSmartphone}
            title="Windows / Mac"
            steps={[
              "Open in Chrome or Edge",
              "Click the install icon in the address bar",
              "Or use the Install app button above",
              "Launch from Start / Applications",
            ]}
          />
          <GuideCard
            icon={Share}
            title="Why install?"
            steps={[
              "Opens full-screen like a native app",
              "Faster return to your dashboard",
              "Works offline for the shell",
              "No App Store or Play Store needed",
            ]}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}

function GuideCard({
  icon: Icon,
  title,
  steps,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  steps: string[];
}) {
  return (
    <Card className="border-border/60 p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </Card>
  );
}
