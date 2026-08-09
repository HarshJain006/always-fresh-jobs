import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Share,
  Smartphone,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePwaInstall, type InstallOutcome } from "@/pwa/usePwaInstall";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download app — DailyResume" },
      {
        name: "description",
        content:
          "Install DailyResume on your phone or computer in one tap. Works like a native app — no App Store needed.",
      },
    ],
  }),
  component: DownloadPage,
});

type GuideKind = "ios" | "android" | "desktop" | "in-app" | null;

function DownloadPage() {
  const { installed, platform, busy, canPrompt, inAppBrowser, promptInstall } = usePwaInstall();
  const [guide, setGuide] = useState<GuideKind>(null);

  const deviceLabel = useMemo(() => {
    if (platform === "ios") return "iPhone / iPad";
    if (platform === "android") return "Android";
    if (platform === "desktop") return "this computer";
    return "your device";
  }, [platform]);

  async function handleInstall() {
    const outcome: InstallOutcome = await promptInstall();

    if (outcome === "accepted") {
      toast.success("DailyResume installed — open it from your home screen.");
      return;
    }
    if (outcome === "already-installed") {
      toast.message("DailyResume is already installed on this device.");
      return;
    }
    if (outcome === "dismissed") {
      toast.message("Install cancelled. Tap Install again anytime.");
      return;
    }
    if (outcome === "ios-manual") {
      setGuide("ios");
      return;
    }
    if (outcome === "android-manual") {
      setGuide("android");
      return;
    }
    if (outcome === "desktop-manual") {
      setGuide("desktop");
      return;
    }
    if (outcome === "in-app-browser") {
      setGuide("in-app");
      return;
    }
    setGuide(platform === "ios" ? "ios" : platform === "android" ? "android" : "desktop");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <Toaster />
      {/* Soft atmosphere — not a flat white slab */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.04_180)_0%,_transparent_55%),radial-gradient(ellipse_at_bottom_right,_oklch(0.95_0.03_265)_0%,_transparent_45%)]"
      />
      <Header />
      <main className="mx-auto flex max-w-lg flex-col px-4 pb-20 pt-14 sm:px-6">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <Zap className="h-7 w-7" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            DailyResume app
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl tracking-tight sm:text-5xl">
            Install on {deviceLabel}
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-muted-foreground">
            One tap installs DailyResume on this device — home screen icon, full-screen app, no
            store required.
          </p>
        </div>

        <div className="mt-10 rounded-3xl border border-border/50 bg-surface/80 p-8 text-center shadow-elegant backdrop-blur-sm">
          {installed ? (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <div>
                <div className="text-xl font-semibold">Installed</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  You’re already in the app. Open it anytime from your home screen.
                </p>
              </div>
              <Button asChild size="lg" className="mt-2 h-12 w-full max-w-xs bg-gradient-primary shadow-glow">
                <Link to="/dashboard">Open Dashboard</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <img
                src="/pwa-icon-192.png"
                alt="DailyResume"
                width={88}
                height={88}
                className="rounded-[22px] shadow-elegant"
              />
              <div>
                <div className="text-xl font-semibold">DailyResume</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {canPrompt
                    ? "Ready to install on this device"
                    : inAppBrowser
                      ? "Open in Chrome or Safari to install"
                      : "Tap below to install automatically"}
                </p>
              </div>

              <Button
                size="lg"
                disabled={busy}
                className="mt-1 h-14 w-full max-w-xs text-base font-semibold bg-gradient-primary shadow-glow"
                onClick={() => void handleInstall()}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Installing…
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-5 w-5" />
                    Install DailyResume
                  </>
                )}
              </Button>

              <p className="max-w-xs text-xs text-muted-foreground">
                Works on Android, iPhone, Windows, Mac, and Chromebooks. On iPhone, Safari will ask
                you to confirm Add to Home Screen.
              </p>
            </div>
          )}
        </div>

        {!installed && (
          <button
            type="button"
            className="mt-6 text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() =>
              setGuide(
                inAppBrowser
                  ? "in-app"
                  : platform === "ios"
                    ? "ios"
                    : platform === "android"
                      ? "android"
                      : "desktop",
              )
            }
          >
            Having trouble? Show install help
          </button>
        )}
      </main>
      <Footer />

      <InstallGuideDialog kind={guide} onClose={() => setGuide(null)} />
    </div>
  );
}

function InstallGuideDialog({
  kind,
  onClose,
}: {
  kind: GuideKind;
  onClose: () => void;
}) {
  const open = kind != null;
  const title =
    kind === "ios"
      ? "Install on iPhone / iPad"
      : kind === "android"
        ? "Finish install on Android"
        : kind === "desktop"
          ? "Install on this computer"
          : kind === "in-app"
            ? "Open in your browser"
            : "Install help";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {kind === "ios" ? <Share className="h-5 w-5 text-primary" /> : <Smartphone className="h-5 w-5 text-primary" />}
            {title}
          </DialogTitle>
          <DialogDescription>
            {kind === "ios" &&
              "Apple doesn’t allow one-tap install from the web. Follow these 3 steps in Safari:"}
            {kind === "android" &&
              "Your browser didn’t show the automatic dialog. Install from the Chrome menu:"}
            {kind === "desktop" &&
              "Use Chrome or Edge — look for the install icon in the address bar, or:"}
            {kind === "in-app" &&
              "You’re inside another app’s browser (Instagram, LinkedIn, etc.). Install only works in Chrome or Safari."}
          </DialogDescription>
        </DialogHeader>

        {kind === "ios" && (
          <ol className="mt-2 space-y-3 text-sm text-foreground">
            <li className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </span>
              <span>
                Tap the <strong>Share</strong> button at the bottom of Safari
              </span>
            </li>
            <li className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <span>
                Scroll and tap <strong>Add to Home Screen</strong>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                3
              </span>
              <span>
                Tap <strong>Add</strong> — DailyResume appears on your home screen
              </span>
            </li>
          </ol>
        )}

        {kind === "android" && (
          <ol className="mt-2 space-y-3 text-sm text-foreground">
            <li className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </span>
              <span>
                Tap the <strong>⋮</strong> menu in Chrome
              </span>
            </li>
            <li className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <span>
                Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                3
              </span>
              <span>
                Confirm <strong>Install</strong>
              </span>
            </li>
          </ol>
        )}

        {kind === "desktop" && (
          <ol className="mt-2 space-y-3 text-sm text-foreground">
            <li className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </span>
              <span>Open this site in <strong>Chrome</strong> or <strong>Edge</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <span>
                Click the <strong>install</strong> icon in the address bar (or menu → Install
                DailyResume)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                3
              </span>
              <span>Confirm — it opens like a desktop app</span>
            </li>
          </ol>
        )}

        {kind === "in-app" && (
          <div className="mt-2 space-y-3 text-sm text-foreground">
            <p>
              Tap the <strong>⋯</strong> or Share menu in this app, then choose{" "}
              <strong>Open in Chrome</strong> / <strong>Open in Safari</strong>. Come back to this
              page and tap <strong>Install DailyResume</strong>.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={async () => {
                const url = typeof window !== "undefined" ? window.location.href : "";
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Link copied — paste it in Chrome or Safari.");
                } catch {
                  toast.message(url || "Open dailyresume.in/download in Chrome or Safari.");
                }
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Copy install link
            </Button>
          </div>
        )}

        <Button className="mt-4 w-full" onClick={onClose}>
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
