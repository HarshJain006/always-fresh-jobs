import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Upload,
  Plug,
  Pause,
  Play,
  Trash2,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  Zap,
  LogOut,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/site/Header";
import { getCurrentUser, logoutUser, type AppUser } from "@/auth/googleAuth";
import { checkTrialStatus } from "@/database/users";
import { canUseAutomation } from "@/security/accessControl";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ResumePulse" },
      { name: "description", content: "Manage your resume, connected platforms and automation schedule." },
    ],
  }),
  component: Dashboard,
});

type Platform = { id: string; name: string; connected: boolean; last: string | null };
type Log = { id: string; platform: string; ok: boolean; text: string; time: string };

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [resume, setResume] = useState<{ name: string; size: string } | null>(null);
  const [paused, setPaused] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([
    { id: "naukri", name: "Naukri", connected: true, last: "Today, 8:02 AM" },
    { id: "indeed", name: "Indeed", connected: false, last: null },
    { id: "linkedin", name: "LinkedIn", connected: false, last: null },
  ]);
  const [logs] = useState<Log[]>([
    { id: "1", platform: "Naukri", ok: true, text: "Resume updated on Naukri", time: "Today, 8:02 AM" },
    { id: "2", platform: "Indeed", ok: false, text: "Indeed update failed — retry scheduled", time: "Yesterday, 8:04 AM" },
    { id: "3", platform: "Naukri", ok: true, text: "Resume updated on Naukri", time: "Yesterday, 8:02 AM" },
  ]);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      navigate({ to: "/login" });
      return;
    }
    setUser(u);
  }, [navigate]);

  if (!user) return null;

  const trial = checkTrialStatus(user);
  const allowed = canUseAutomation(user);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }
    setResume({ name: file.name, size: `${(file.size / 1024).toFixed(0)} KB` });
    toast.success("Resume uploaded.");
  }

  function togglePlatform(id: string) {
    setPlatforms((p) =>
      p.map((x) =>
        x.id === id
          ? { ...x, connected: !x.connected, last: !x.connected ? "Just now" : null }
          : x,
      ),
    );
  }

  async function handleLogout() {
    await logoutUser();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Greeting + subscription banner */}
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-4xl">Hi, {user.name.split(" ")[0]}</h1>
            <p className="mt-1 text-muted-foreground">Here's what's happening with your resume.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>

        <SubscriptionBanner user={user} trialDaysLeft={trial.daysRemaining} />

        {/* Top stats */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card className="border-border/60 p-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Resume
            </div>
            <div className="mt-2 text-lg font-semibold">
              {resume ? resume.name : "No resume uploaded"}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {resume ? resume.size : "PDF · Max 5 MB"}
            </div>
          </Card>
          <Card className="border-border/60 p-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Zap className="h-3.5 w-3.5" /> Automation
            </div>
            <div className="mt-2 flex items-center gap-2">
              {allowed && !paused ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
                  <span className="text-lg font-semibold text-success">Active</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                  <span className="text-lg font-semibold text-muted-foreground">
                    {paused ? "Paused" : "Inactive"}
                  </span>
                </>
              )}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {allowed ? "Next refresh: tomorrow, 8:00 AM" : "Subscribe to enable"}
            </div>
          </Card>
          <Card className="border-border/60 p-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Last refresh
            </div>
            <div className="mt-2 text-lg font-semibold">Today, 8:05 AM</div>
            <div className="mt-1 text-sm text-muted-foreground">Across 1 platform</div>
          </Card>
        </div>

        {/* Resume + platforms */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <Card className="border-border/60 p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Resume</h2>
              <label>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleUpload}
                />
                <Button asChild size="sm" variant="outline">
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    {resume ? "Replace" : "Upload"}
                  </span>
                </Button>
              </label>
            </div>
            {resume ? (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-border/60 bg-surface-muted/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{resume.name}</div>
                    <div className="text-xs text-muted-foreground">{resume.size}</div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setResume(null);
                    toast("Resume removed");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="No resume yet"
                desc="Upload a PDF to start daily refreshes."
              />
            )}
          </Card>

          <Card className="border-border/60 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Automation</h2>
              <Badge variant={allowed && !paused ? "default" : "secondary"}>
                {allowed && !paused ? "Running" : paused ? "Paused" : "Off"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Runs every morning at 8:00 AM IST across your connected platforms.
            </p>
            <div className="mt-4 flex gap-2">
              {paused ? (
                <Button
                  disabled={!allowed}
                  onClick={() => {
                    setPaused(false);
                    toast.success("Automation resumed");
                  }}
                  className="w-full"
                >
                  <Play className="mr-2 h-4 w-4" /> Resume
                </Button>
              ) : (
                <Button
                  disabled={!allowed}
                  variant="outline"
                  onClick={() => {
                    setPaused(true);
                    toast("Automation paused");
                  }}
                  className="w-full"
                >
                  <Pause className="mr-2 h-4 w-4" /> Pause
                </Button>
              )}
            </div>
            {!allowed && (
              <p className="mt-3 text-xs text-warning-foreground">
                Your trial has expired.{" "}
                <Link to="/pricing" className="underline">
                  Upgrade to continue
                </Link>
                .
              </p>
            )}
          </Card>
        </div>

        {/* Platforms */}
        <Card className="mt-8 border-border/60 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Connected platforms</h2>
            <Button size="sm" variant="outline">
              <Plug className="mr-2 h-4 w-4" /> Connect platform
            </Button>
          </div>
          <div className="mt-4 divide-y divide-border/60">
            {platforms.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary font-semibold text-secondary-foreground">
                    {p.name[0]}
                  </div>
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.connected ? `Last refresh: ${p.last}` : "Not connected"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.connected && <Badge variant="secondary">Connected</Badge>}
                  <Button
                    size="sm"
                    variant={p.connected ? "ghost" : "default"}
                    onClick={() => togglePlatform(p.id)}
                  >
                    {p.connected ? "Remove" : "Connect"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Activity */}
        <Card className="mt-8 border-border/60 p-6">
          <h2 className="text-xl font-semibold">Recent activity</h2>
          <ul className="mt-4 space-y-2">
            {logs.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-muted/40 p-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  {l.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>{l.text}</span>
                </div>
                <span className="text-xs text-muted-foreground">{l.time}</span>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}

function SubscriptionBanner({ user, trialDaysLeft }: { user: AppUser; trialDaysLeft: number }) {
  if (user.subscription_status === "active") {
    return (
      <Card className="mt-6 flex items-center justify-between border-primary/40 bg-gradient-primary p-5 text-primary-foreground shadow-glow">
        <div className="flex items-center gap-3">
          <Crown className="h-5 w-5" />
          <div>
            <div className="font-semibold">Premium active</div>
            <div className="text-sm opacity-90">Next renewal: 15 Aug 2026</div>
          </div>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/pricing">Manage</Link>
        </Button>
      </Card>
    );
  }
  if (trialDaysLeft > 0) {
    return (
      <Card className="mt-6 flex items-center justify-between border-border/60 bg-surface-muted/40 p-5">
        <div>
          <div className="font-semibold">Free trial</div>
          <div className="text-sm text-muted-foreground">
            {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} remaining · Upgrade to keep automation running
          </div>
        </div>
        <Button asChild className="bg-gradient-primary shadow-glow">
          <Link to="/pricing">Upgrade ₹150/mo</Link>
        </Button>
      </Card>
    );
  }
  return (
    <Card className="mt-6 flex items-center justify-between border-warning/40 bg-warning/10 p-5">
      <div>
        <div className="font-semibold text-warning-foreground">Trial expired · Automation paused</div>
        <div className="text-sm text-muted-foreground">Subscribe to resume daily refreshes.</div>
      </div>
      <Button asChild className="bg-gradient-primary shadow-glow">
        <Link to="/pricing">Subscribe</Link>
      </Button>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-surface-muted/40 p-10 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <div className="mt-3 font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{desc}</div>
    </div>
  );
}
