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
  Pause,
  Square,
  Play,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { getCurrentUser, logoutUser, updateSessionUser, requireClientSessionToken, getSessionToken, type AppUser } from "@/auth/googleAuth";
import {
  getDashboardState,
  saveNaukriCredentials,
  uploadUserResume,
  deleteUserResume,
  setPlatformConnected,
  setAutomationState,
  runNaukriNow,
} from "@/routes/dashboard.functions";
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
type Log = { id: string; ok: boolean; text: string; time: string; ts: number };
type AutomationState = "idle" | "running" | "paused";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState<{ name: string; size: string } | null>(null);
  const [state, setState] = useState<AutomationState>("idle");
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
    email: "",
    phone: "",
  });
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([
    { id: "naukri", name: "Naukri", connected: false, last: null },
    { id: "indeed", name: "Indeed", connected: false, last: null },
  ]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [accessAllowed, setAccessAllowed] = useState(true);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [accessReason, setAccessReason] = useState<"active" | "trial" | "expired" | "suspended">(
    "trial",
  );
  const [subscriptionExpireAt, setSubscriptionExpireAt] = useState<string | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const recentLogs = useMemo(() => {
    const cutoff = now - 7 * day;
    return logs.filter((l) => l.ts >= cutoff).sort((a, b) => b.ts - a.ts);
  }, [logs, now, day]);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u || !getSessionToken()) {
      navigate({ to: "/login" });
      return;
    }
    setUser(u);

    void (async () => {
      try {
        const dash = await getDashboardState({
          data: { sessionToken: requireClientSessionToken() },
        });
        // Always trust DB subscription / trial clocks over localStorage
        if (dash.user) {
          updateSessionUser(dash.user);
          setUser(dash.user);
        }
        setAccessAllowed(dash.access.allowed);
        setTrialDaysLeft(dash.access.daysRemaining);
        setAccessReason(dash.access.reason);
        setSubscriptionExpireAt(dash.access.subscriptionExpireAt ?? null);
        setSubscriptionPlan(dash.access.subscriptionPlan ?? null);
        if (!dash.access.allowed) {
          toast.error("Your access has ended. Renew your plan to keep DailyResume running.", {
            duration: 8000,
            action: {
              label: "Renew",
              onClick: () => navigate({ to: "/pricing" }),
            },
          });
        }
        setResume(dash.resume);
        setCredentialsSaved(dash.credentialsSaved);
        setCredentials({
          username: dash.credentials.username,
          email: dash.credentials.email,
          phone: dash.credentials.phone,
          password: "",
        });
        setPlatforms(dash.platforms);
        setState(dash.automationState);
        setLogs(dash.logs);
      } catch (err) {
        console.error(err);
        const msg = err instanceof Error ? err.message : "Could not load dashboard state.";
        toast.error(msg);
        if (/session|sign in/i.test(msg)) {
          await logoutUser();
          navigate({ to: "/login" });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const anyConnected = platforms.some((p) => p.connected);
  const step1Done = !!resume;
  const step2Done = anyConnected;
  const step3Done = state !== "idle" && step1Done && step2Done;

  const currentStep = useMemo(() => {
    if (!step1Done) return 1;
    if (!step2Done) return 2;
    return 3;
  }, [step1Done, step2Done]);

  if (!user || loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading dashboard…
      </div>
    );
  }

  const trialDays = trialDaysLeft ?? 0;
  const allowed = accessAllowed;


  function applyServerUserId(serverUserId: string | undefined) {
    if (!serverUserId || serverUserId === user.id) return;
    const updated = { ...user, id: serverUserId };
    updateSessionUser(updated);
    setUser(updated);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Resume must be under 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const stored = await uploadUserResume({
        data: {
          sessionToken: requireClientSessionToken(),
          fileName: file.name,
          contentType: file.type,
          dataBase64,
        },
      });
      applyServerUserId(stored.userId);
      setResume(stored);
      toast.success(
        resume ? "Resume replaced. Only your latest file is kept." : "Resume uploaded.",
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function handleRemoveResume() {
    if (!user) return;
    setBusy(true);
    try {
      await deleteUserResume({ data: { sessionToken: requireClientSessionToken() } });
      setResume(null);
      toast("Resume removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove resume.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!credentials.username || !credentials.phone) {
      toast.error("Username and phone are required.");
      return;
    }
    if (!credentials.password && !credentialsSaved) {
      toast.error("Password is required.");
      return;
    }
    setBusy(true);
    try {
      await saveNaukriCredentials({
        data: {
          sessionToken: requireClientSessionToken(),
          credentials: {
            username: credentials.username,
            password: credentials.password,
            email: credentials.email || credentials.username,
            phone: credentials.phone,
          },
        },
      });
      setCredentialsSaved(true);
      setCredentials((c) => ({ ...c, password: "" }));
      toast.success("Credentials saved securely.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save credentials.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePlatform(id: string) {
    if (id === "indeed" || !user) return;
    const current = platforms.find((p) => p.id === id);
    if (!current) return;
    setBusy(true);
    try {
      const res = await setPlatformConnected({
        data: {
          sessionToken: requireClientSessionToken(),
          platformId: id as "naukri",
          connected: !current.connected,
        },
      });
      applyServerUserId(res.userId);
      setPlatforms(res.platforms);
      toast.success(current.connected ? "Disconnected." : "Naukri connected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update platform.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await logoutUser();
    navigate({ to: "/" });
  }

  async function refreshLogs() {
    if (!user) return;
    const dash = await getDashboardState({ data: { sessionToken: requireClientSessionToken() } });
    applyServerUserId(dash.userId);
    setLogs(dash.logs);
    setPlatforms(dash.platforms);
  }

  async function handleStart() {
    if (!user) return;
    if (!allowed) {
      toast.error("Your trial has expired. Please upgrade to start.");
      return;
    }
    if (!step1Done) return toast.error("Upload your resume first.");
    if (!credentialsSaved) return toast.error("Save Naukri credentials first.");
    if (!step2Done) return toast.error("Connect Naukri first.");
    setBusy(true);
    try {
      await setAutomationState({ data: { sessionToken: requireClientSessionToken(), state: "running" } });
      setState("running");
      toast.success("Automation started. Your first refresh is running…");
      const result = await runNaukriNow({ data: { sessionToken: requireClientSessionToken() } });
      await refreshLogs();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start automation.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePause() {
    if (!user) return;
    try {
      await setAutomationState({ data: { sessionToken: requireClientSessionToken(), state: "paused" } });
      setState("paused");
      toast("Automation paused. Resume anytime.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not pause.");
    }
  }

  async function handleResumeAutomation() {
    if (!user) return;
    try {
      await setAutomationState({ data: { sessionToken: requireClientSessionToken(), state: "running" } });
      setState("running");
      toast.success("Automation resumed. Next refresh at 8:00 AM IST.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resume.");
    }
  }

  async function handleStop() {
    if (!user) return;
    try {
      await setAutomationState({ data: { sessionToken: requireClientSessionToken(), state: "idle" } });
      setState("idle");
      toast("Automation stopped.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not stop.");
    }
  }

  async function handleRunNow() {
    if (!user) return;
    if (!allowed) return toast.error("Your trial has expired.");
    if (!step1Done || !credentialsSaved || !step2Done) {
      return toast.error("Complete setup first (resume, credentials, connect Naukri).");
    }
    setBusy(true);
    try {
      toast("Starting your Naukri refresh…");
      const result = await runNaukriNow({ data: { sessionToken: requireClientSessionToken() } });
      await refreshLogs();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setBusy(false);
    }
  }

  const progressPct = step3Done ? 100 : step2Done ? 66 : step1Done ? 33 : 8;

  return (
    <div className="min-h-screen bg-background pb-16">
      <Toaster />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl">Hi, {user.name.split(" ")[0]}</h1>
            <p className="mt-1 text-muted-foreground">
              Let’s get your resume refreshing daily — in three quick steps.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>

        <SubscriptionBanner
          daysRemaining={trialDays}
          reason={accessReason}
          subscriptionExpireAt={subscriptionExpireAt}
          subscriptionPlan={subscriptionPlan}
        />

        <Card className="mt-6 border-border/60 p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold">Naukri account credentials</h3>
                {credentialsSaved && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Saved
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                We use these to sign in and refresh your profile daily. Stored encrypted — only used
                for your automatic refreshes.
              </p>
              <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleSaveCredentials}>
                <div className="grid gap-1.5">
                  <Label htmlFor="cred-username">Naukri email / username</Label>
                  <Input
                    id="cred-username"
                    value={credentials.username}
                    onChange={(e) => {
                      setCredentials({ ...credentials, username: e.target.value });
                      setCredentialsSaved(false);
                    }}
                    placeholder="you@example.com"
                    disabled={busy}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cred-password">Password</Label>
                  <Input
                    id="cred-password"
                    type="password"
                    value={credentials.password}
                    onChange={(e) => {
                      setCredentials({ ...credentials, password: e.target.value });
                      setCredentialsSaved(false);
                    }}
                    placeholder={credentialsSaved ? "•••••••• (enter to update)" : "••••••••"}
                    disabled={busy}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cred-email">Email address</Label>
                  <Input
                    id="cred-email"
                    type="email"
                    value={credentials.email}
                    onChange={(e) => {
                      setCredentials({ ...credentials, email: e.target.value });
                      setCredentialsSaved(false);
                    }}
                    placeholder="you@example.com"
                    disabled={busy}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cred-phone">Phone number</Label>
                  <Input
                    id="cred-phone"
                    type="tel"
                    value={credentials.phone}
                    onChange={(e) => {
                      setCredentials({ ...credentials, phone: e.target.value });
                      setCredentialsSaved(false);
                    }}
                    placeholder="+91 98765 43210"
                    disabled={busy}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={busy} className="bg-gradient-primary shadow-glow">
                    {credentialsSaved ? "Update credentials" : "Save credentials"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Card>

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

        <div className="mt-10 space-y-4">
          <StepCard
            n={1}
            title="Upload your resume"
            desc="One PDF only (max 5 MB). Uploading again replaces the previous file — we keep and compress only the latest version."
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
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleUpload}
                      disabled={busy}
                    />
                    <Button asChild size="sm" variant="outline" disabled={busy}>
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        Replace
                      </span>
                    </Button>
                  </label>
                  <Button size="sm" variant="ghost" onClick={handleRemoveResume} disabled={busy}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={busy}
                />
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
            desc="Link Naukri so we know where to refresh. Indeed support is coming soon."
            done={step2Done}
            active={currentStep === 2}
            locked={!step1Done}
          >
            <div className="divide-y divide-border/60 rounded-lg border border-border/60">
              {platforms.map((p) => {
                const comingSoon = p.id === "indeed";
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 ${comingSoon ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary font-semibold text-secondary-foreground">
                        {p.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {comingSoon
                            ? "Coming soon"
                            : p.connected
                              ? `Last refresh: ${p.last ?? "—"}`
                              : "Not connected"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {comingSoon ? (
                        <>
                          <Badge variant="outline">Coming soon</Badge>
                          <Button size="sm" variant="secondary" disabled>
                            <Plug className="mr-2 h-4 w-4" />
                            Connect
                          </Button>
                        </>
                      ) : (
                        <>
                          {p.connected && <Badge variant="secondary">Connected</Badge>}
                          <Button
                            size="sm"
                            variant={p.connected ? "ghost" : "default"}
                            onClick={() => togglePlatform(p.id)}
                            disabled={!step1Done || !credentialsSaved || busy}
                          >
                            {p.connected ? (
                              "Remove"
                            ) : (
                              <>
                                <Plug className="mr-2 h-4 w-4" />
                                Connect
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </StepCard>

          <StepCard
            n={3}
            title="Control your automation"
            desc="Runs every morning at 8:00 AM IST. Start, pause, or stop whenever you like."
            done={step3Done}
            active={currentStep === 3}
            locked={!step1Done || !step2Done}
          >
            <AutomationStatus state={state} />

            <div className="mt-4 flex flex-wrap gap-2">
              {state === "idle" && (
                <Button
                  onClick={handleStart}
                  disabled={!allowed || !step1Done || !step2Done || busy}
                  className="bg-gradient-primary shadow-glow"
                >
                  <Rocket className="mr-2 h-4 w-4" /> Start daily refresh
                </Button>
              )}
              {state === "running" && (
                <>
                  <Button variant="outline" onClick={handlePause} disabled={busy}>
                    <Pause className="mr-2 h-4 w-4" /> Pause
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleStop}
                    disabled={busy}
                    className="text-destructive hover:text-destructive"
                  >
                    <Square className="mr-2 h-4 w-4" /> Stop
                  </Button>
                  <Button variant="secondary" onClick={handleRunNow} disabled={busy}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Run now
                  </Button>
                </>
              )}
              {state === "paused" && (
                <>
                  <Button
                    onClick={handleResumeAutomation}
                    disabled={busy}
                    className="bg-gradient-primary shadow-glow"
                  >
                    <Play className="mr-2 h-4 w-4" /> Resume
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleStop}
                    disabled={busy}
                    className="text-destructive hover:text-destructive"
                  >
                    <Square className="mr-2 h-4 w-4" /> Stop
                  </Button>
                  <Button variant="secondary" onClick={handleRunNow} disabled={busy}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Run now
                  </Button>
                </>
              )}
            </div>
          </StepCard>
        </div>

        <Card className="mt-10 border-border/60 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent activity</h2>
            <span className="text-xs text-muted-foreground">Last 7 days · newest first</span>
          </div>
          {recentLogs.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No activity yet. Once automation starts, refresh events will appear here.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {recentLogs.map((l) => (
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
          )}
        </Card>
      </main>
    </div>
  );
}

function AutomationStatus({ state }: { state: AutomationState }) {
  if (state === "running") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/8 p-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-success/15 text-success">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-success">Automation active</div>
          <div className="text-xs text-muted-foreground">Next refresh: tomorrow, 8:00 AM IST</div>
        </div>
      </div>
    );
  }
  if (state === "paused") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-warning/20 text-warning-foreground">
          <Pause className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">Automation paused</div>
          <div className="text-xs text-muted-foreground">No refreshes until you resume.</div>
        </div>
      </div>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Press <span className="font-medium text-foreground">Start</span> to begin daily refreshes. You can
      pause or stop at any time.
    </p>
  );
}

function StepCard({
  n,
  title,
  desc,
  done,
  active,
  locked,
  children,
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
            done
              ? "bg-success text-success-foreground"
              : active
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "bg-secondary text-secondary-foreground",
          ].join(" ")}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : n}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">{title}</h3>
            {done && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Done
              </Badge>
            )}
            {!done && !active && !locked && <Circle className="h-3 w-3 text-muted-foreground" />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </Card>
  );
}

function SubscriptionBanner({
  daysRemaining,
  reason,
  subscriptionExpireAt,
  subscriptionPlan,
}: {
  daysRemaining: number;
  reason: "active" | "trial" | "expired" | "suspended";
  subscriptionExpireAt: string | null;
  subscriptionPlan: string | null;
}) {
  const expireLabel = subscriptionExpireAt
    ? new Date(subscriptionExpireAt).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const planName =
    subscriptionPlan === "premium_3m"
      ? "3 Months"
      : subscriptionPlan === "premium_6m"
        ? "6 Months"
        : subscriptionPlan === "premium_1m" || subscriptionPlan === "premium_monthly"
          ? "1 Month"
          : "Premium";

  if (reason === "active") {
    const endingSoon = daysRemaining > 0 && daysRemaining <= 7;
    if (endingSoon) {
      return (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 border-warning/50 bg-warning/10 p-5">
          <div className="flex items-center gap-3">
            <Crown className="h-5 w-5 text-warning-foreground" />
            <div>
              <div className="font-semibold text-warning-foreground">
                Premium ends in {daysRemaining} day{daysRemaining === 1 ? "" : "s"}
              </div>
              <div className="text-sm text-muted-foreground">
                {planName} · Valid until {expireLabel}. Renew now so daily refreshes don’t stop.
              </div>
            </div>
          </div>
          <Button asChild className="bg-gradient-primary shadow-glow">
            <Link to="/pricing">Renew plan</Link>
          </Button>
        </Card>
      );
    }
    return (
      <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 border-primary/40 bg-gradient-primary p-5 text-primary-foreground shadow-glow">
        <div className="flex items-center gap-3">
          <Crown className="h-5 w-5" />
          <div>
            <div className="font-semibold">Premium active · {planName}</div>
            <div className="text-sm opacity-90">
              {daysRemaining > 0
                ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left · until ${expireLabel}`
                : `Valid until ${expireLabel}`}
            </div>
          </div>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/pricing">Manage</Link>
        </Button>
      </Card>
    );
  }

  if (reason === "trial" && daysRemaining > 0) {
    return (
      <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 border-border/60 bg-surface-muted/40 p-5">
        <div>
          <div className="font-semibold">Free trial</div>
          <div className="text-sm text-muted-foreground">
            {daysRemaining} day{daysRemaining === 1 ? "" : "s"} remaining · Upgrade to keep
            automation running
          </div>
        </div>
        <Button asChild className="bg-gradient-primary shadow-glow">
          <Link to="/pricing">View plans</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 border-warning/40 bg-warning/10 p-5">
      <div>
        <div className="font-semibold text-warning-foreground">
          Access ended · Automation paused
        </div>
        <div className="text-sm text-muted-foreground">
          Choose a plan to resume daily refreshes.
        </div>
      </div>
      <Button asChild className="bg-gradient-primary shadow-glow">
        <Link to="/pricing">Subscribe</Link>
      </Button>
    </Card>
  );
}
