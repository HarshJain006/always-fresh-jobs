import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Upload,
  Plug,
  Trash2,
  FileText,
  CheckCircle2,
  XCircle,
  Zap,
  LogOut,
  Crown,
  Rocket,
  Circle,
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
      { title: "Dashboard — DailyResume" },
      { name: "description", content: "Set up your daily resume refresh in three simple steps." },
    ],
  }),
  component: Dashboard,
});

type Platform = { id: string; name: string; connected: boolean; last: string | null };
type Log = { id: string; ok: boolean; text: string; time: string };

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [resume, setResume] = useState<{ name: string; size: string } | null>(null);
  const [started, setStarted] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([
    { id: "naukri", name: "Naukri", connected: false, last: null },
    { id: "indeed", name: "Indeed", connected: false, last: null },
  ]);
  const [logs] = useState<Log[]>([
    { id: "1", ok: true, text: "Resume updated on Naukri", time: "Today, 8:02 AM" },
    { id: "2", ok: false, text: "Indeed update failed — retry scheduled", time: "Yesterday, 8:04 AM" },
  ]);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      navigate({ to: "/login" });
      return;
    }
    setUser(u);
  }, [navigate]);

  const anyConnected = platforms.some((p) => p.connected);
  const step1Done = !!resume;
  const step2Done = anyConnected;
  const step3Done = started && step1Done && step2Done;

  const currentStep = useMemo(() => {
    if (!step1Done) return 1;
    if (!step2Done) return 2;
    return 3;
  }, [step1Done, step2Done]);

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

  function handleStart() {
    if (!allowed) {
      toast.error("Your trial has expired. Please upgrade to start.");
      return;
    }
    if (!step1Done) return toast.error("Upload your resume first.");
    if (!step2Done) return toast.error("Connect at least one platform.");
    setStarted(true);
    toast.success("Automation started. First refresh tomorrow at 8:00 AM.");
  }

  const progressPct = step3Done ? 100 : step2Done ? 66 : step1Done ? 33 : 8;

  return (
    <div className="min-h-screen bg-background pb-32">
      <Toaster />
      <Header />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Greeting */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl">Hi, {user.name.split(" ")[0]}</h1>
            <p className="mt-1 text-muted-foreground">
              Let's get your resume refreshing daily — in three quick steps.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>

        <SubscriptionBanner user={user} trialDaysLeft={trial.daysRemaining} />

        {/* Progress bar */}
        <div className="mt-8">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Setup progress</span>
            <span className="tabular-nums">{progressPct}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Linear steps */}
        <div className="mt-10 space-y-4">
          <StepCard
            n={1}
            title="Upload your resume"
            desc="A single PDF, up to 5 MB. We store it securely and reuse it every day."
            done={step1Done}
            active={currentStep === 1}
          >
            {resume ? (
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-muted/40 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{resume.name}</div>
                    <div className="text-xs text-muted-foreground">{resume.size}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label>
                    <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
                    <Button asChild size="sm" variant="outline">
                      <span><Upload className="mr-2 h-4 w-4" />Replace</span>
                    </Button>
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => { setResume(null); toast("Resume removed"); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-surface-muted/40 p-8 text-center transition hover:bg-surface-muted/70">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <div className="mt-2 text-sm font-medium">Click to upload PDF</div>
                  <div className="text-xs text-muted-foreground">Max 5 MB</div>
                </div>
              </label>
            )}
          </StepCard>

          <StepCard
            n={2}
            title="Connect your job portals"
            desc="Link at least one — Naukri or Indeed — so we know where to refresh."
            done={step2Done}
            active={currentStep === 2}
            locked={!step1Done}
          >
            <div className="divide-y divide-border/60 rounded-lg border border-border/60">
              {platforms.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary font-semibold text-secondary-foreground">
                      {p.name[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
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
                      disabled={!step1Done}
                    >
                      {p.connected ? "Remove" : (<><Plug className="mr-2 h-4 w-4" />Connect</>)}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </StepCard>

          <StepCard
            n={3}
            title="Start daily refresh"
            desc="Automation runs every morning at 8:00 AM IST. You can pause anytime."
            done={step3Done}
            active={currentStep === 3}
            locked={!step1Done || !step2Done}
          >
            {step3Done ? (
              <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/8 p-4">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-success/15 text-success">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-success">Automation active</div>
                  <div className="text-xs text-muted-foreground">Next refresh: tomorrow, 8:00 AM IST</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Once you press <span className="font-medium text-foreground">Start</span>, we'll take over — no more manual logins.
              </p>
            )}
          </StepCard>
        </div>

        {/* Recent activity — only after started */}
        {step3Done && (
          <Card className="mt-10 border-border/60 p-6">
            <h2 className="text-lg font-semibold">Recent activity</h2>
            <ul className="mt-4 space-y-2">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-muted/40 p-3 text-sm">
                  <div className="flex items-center gap-3">
                    {l.ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span>{l.text}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{l.time}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </main>

      {/* Sticky Start bar at bottom */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="hidden text-sm text-muted-foreground sm:block">
            {step3Done
              ? "You're all set — automation is running."
              : `Step ${currentStep} of 3 · ${step1Done ? "" : "Upload resume"}${!step1Done ? "" : !step2Done ? "Connect a platform" : "Ready to start"}`}
          </div>
          <Button
            size="lg"
            onClick={handleStart}
            disabled={!allowed || step3Done || !step1Done || !step2Done}
            className="ml-auto bg-gradient-primary shadow-glow"
          >
            <Rocket className="mr-2 h-4 w-4" />
            {step3Done ? "Running" : "Start daily refresh"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepCard({
  n, title, desc, done, active, locked, children,
}: {
  n: number;
  title: string;
  desc: string;
  done: boolean;
  active: boolean;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={[
        "border-border/60 p-6 transition",
        locked ? "opacity-55" : "",
        active && !done ? "ring-1 ring-primary/40 shadow-elegant" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div
          className={[
            "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold",
            done ? "bg-success text-success-foreground" : active ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-secondary-foreground",
          ].join(" ")}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : n}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">{title}</h3>
            {done && <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Done</Badge>}
            {!done && !active && !locked && <Circle className="h-3 w-3 text-muted-foreground" />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </Card>
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
