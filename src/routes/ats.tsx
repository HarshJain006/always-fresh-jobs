/**
 * ADDED (ATS Score feature) — resume ATS score checker page.
 *
 * Free trial: 2 checks total. Paid subscription: unlimited.
 * Job description is optional; adding it switches scoring to role-specific matching.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Crown,
  FileText,
  Gauge,
  Loader2,
  Sparkles,
  Upload,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser, getSessionToken, requireClientSessionToken } from "@/auth/googleAuth";
import { getAtsStatus, runAtsCheck } from "@/routes/ats.functions";
import type { AtsResult } from "@/lib/atsScore";
import atsHero from "@/assets/ats-hero.jpg";

export const Route = createFileRoute("/ats")({
  head: () => ({
    meta: [
      { title: "ATS Resume Score Checker — DailyResume" },
      {
        name: "description",
        content:
          "Score your resume against applicant tracking systems in seconds. Get a match score, keyword gaps and fixes that get you shortlisted.",
      },
      { property: "og:title", content: "ATS Resume Score Checker — DailyResume" },
      {
        property: "og:description",
        content:
          "See exactly how recruiters' ATS software reads your resume — score, keyword gaps and instant fixes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AtsPage,
});

type Quota = {
  unlimited: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result || "");
      resolve(r.includes(",") ? r.split(",")[1] : r);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function scoreTone(score: number) {
  if (score >= 85) return { text: "text-emerald-600", ring: "stroke-emerald-500", label: "Excellent" };
  if (score >= 70) return { text: "text-primary", ring: "stroke-primary", label: "Good" };
  if (score >= 50) return { text: "text-amber-600", ring: "stroke-amber-500", label: "Needs work" };
  return { text: "text-destructive", ring: "stroke-destructive", label: "At risk" };
}

function Gauge360({ score }: { score: number }) {
  const tone = scoreTone(score);
  const r = 64;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-44 w-44 place-items-center">
      <svg viewBox="0 0 160 160" className="h-44 w-44 -rotate-90">
        <circle cx="80" cy="80" r={r} className="fill-none stroke-secondary" strokeWidth="12" />
        <circle
          cx="80"
          cy="80"
          r={r}
          className={`fill-none ${tone.ring} transition-all duration-1000`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * score) / 100}
        />
      </svg>
      <div className="absolute text-center">
        <div className={`text-4xl font-semibold tabular-nums ${tone.text}`}>{score}</div>
        <div className="text-xs font-medium text-muted-foreground">{tone.label}</div>
      </div>
    </div>
  );
}

function AtsPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [hasStoredResume, setHasStoredResume] = useState(false);
  const [accessAllowed, setAccessAllowed] = useState(true);
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [mode, setMode] = useState<"stored" | "upload" | "text">("stored");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [result, setResult] = useState<AtsResult | null>(null);

  useEffect(() => {
    if (!getCurrentUser() || !getSessionToken()) {
      navigate({ to: "/login" });
      return;
    }
    void (async () => {
      try {
        const s = await getAtsStatus({ data: { sessionToken: requireClientSessionToken() } });
        setQuota({
          unlimited: s.unlimited,
          used: s.used,
          limit: s.limit,
          remaining: s.remaining,
        });
        setHasStoredResume(s.hasStoredResume);
        setAccessAllowed(s.accessAllowed);
        setMode(s.hasStoredResume ? "stored" : "upload");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load your ATS status.");
      } finally {
        setReady(true);
      }
    })();
  }, [navigate]);

  const outOfChecks = !!quota && !quota.unlimited && (quota.remaining ?? 0) <= 0;

  async function handleRun() {
    if (busy) return;
    setBusy(true);
    try {
      const sessionToken = requireClientSessionToken();
      let dataBase64: string | undefined;
      let fileName: string | undefined;

      if (mode === "upload") {
        if (!pendingFile) throw new Error("Choose a PDF resume first.");
        if (pendingFile.size > 5 * 1024 * 1024) throw new Error("Resume must be under 5 MB.");
        dataBase64 = await fileToBase64(pendingFile);
        fileName = pendingFile.name;
      }
      if (mode === "text" && resumeText.trim().length < 200) {
        throw new Error("Paste a bit more of your resume text (at least a few paragraphs).");
      }

      const res = await runAtsCheck({
        data: {
          sessionToken,
          source: mode,
          dataBase64,
          fileName,
          resumeText: mode === "text" ? resumeText : undefined,
          jobDescription: jobDescription.trim() || undefined,
        },
      });
      setResult(res.result);
      setQuota(res.quota);
      toast.success(`ATS score: ${res.result.score}/100`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not score your resume.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading ATS checker…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        {/* Hero */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-surface-muted/40">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="p-7 sm:p-9">
              <Badge variant="secondary" className="mb-3">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> ATS score
              </Badge>
              <h1 className="font-heading text-3xl font-semibold leading-tight sm:text-4xl">
                75% of resumes never reach a human.
              </h1>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Applicant tracking systems rank you before a recruiter ever looks. Check your score,
                close the keyword gaps, and refresh daily so you stay on top of the list.
              </p>
              {quota && (
                <div className="mt-5 text-sm">
                  {quota.unlimited ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                      <Crown className="h-3.5 w-3.5" /> Unlimited checks with your plan
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 font-medium">
                      Free trial: {quota.remaining ?? 0} of {quota.limit} checks left
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="relative min-h-[220px]">
              <img
                src={atsHero}
                alt="ATS score dashboard showing a resume rated 92 out of 100"
                width={1600}
                height={912}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Input */}
        <Card className="mt-8 p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="font-medium">Resume to score</div>
              <div className="text-xs text-muted-foreground">PDF only, max 5 MB.</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {hasStoredResume && (
              <Button
                size="sm"
                variant={mode === "stored" ? "default" : "outline"}
                onClick={() => setMode("stored")}
              >
                Use my saved resume
              </Button>
            )}
            <Button
              size="sm"
              variant={mode === "upload" ? "default" : "outline"}
              onClick={() => setMode("upload")}
            >
              Upload a PDF
            </Button>
            <Button
              size="sm"
              variant={mode === "text" ? "default" : "outline"}
              onClick={() => setMode("text")}
            >
              Paste text
            </Button>
          </div>

          {mode === "upload" && (
            <label className="mt-4 block cursor-pointer">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                disabled={busy}
              />
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-surface-muted/40 p-7 text-center transition hover:bg-surface-muted/70">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <div className="mt-2 text-sm font-medium">
                  {pendingFile ? pendingFile.name : "Click to choose a PDF"}
                </div>
                <div className="text-xs text-muted-foreground">Max 5 MB</div>
              </div>
            </label>
          )}

          {mode === "text" && (
            <div className="mt-4">
              <Label htmlFor="resumeText" className="text-xs">
                Resume text
              </Label>
              <Textarea
                id="resumeText"
                rows={8}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your full resume text here…"
                className="mt-1.5"
                disabled={busy}
              />
            </div>
          )}

          <div className="mt-6">
            <Label htmlFor="jd" className="text-xs">
              Job description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="jd"
              rows={6}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description to get a role-specific match score and missing keywords."
              className="mt-1.5"
              disabled={busy}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              onClick={handleRun}
              disabled={busy || outOfChecks || !accessAllowed}
              className="bg-gradient-primary shadow-glow"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scoring…
                </>
              ) : (
                <>
                  <Gauge className="mr-2 h-4 w-4" /> Check ATS score
                </>
              )}
            </Button>
            {(outOfChecks || !accessAllowed) && (
              <Button asChild variant="outline">
                <Link to="/pricing">
                  <Crown className="mr-2 h-4 w-4" /> Upgrade for unlimited checks
                </Link>
              </Button>
            )}
          </div>
          {outOfChecks && (
            <p className="mt-3 text-xs text-muted-foreground">
              You've used both free-trial checks. Upgrade to score every resume and job description
              you want.
            </p>
          )}
        </Card>

        {/* Result */}
        {result && (
          <Card className="mt-6 p-6 sm:p-7">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <Gauge360 score={result.score} />
              <div className="flex-1">
                <div className="font-heading text-xl font-semibold">
                  {result.usedJobDescription ? "Role-specific ATS score" : "General ATS score"}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.wordCount} words analysed
                  {result.usedJobDescription
                    ? ` · ${result.matchedKeywords.length} of ${
                        result.matchedKeywords.length + result.missingKeywords.length
                      } key terms matched`
                    : " · add a job description for a sharper score"}
                  .
                </p>

                <div className="mt-5 space-y-3">
                  {result.breakdown.map((b) => (
                    <div key={b.key}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{b.label}</span>
                        <span className="tabular-nums text-muted-foreground">{b.score}/100</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-gradient-primary transition-all duration-700"
                          style={{ width: `${b.score}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{b.hint}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {result.missingKeywords.length > 0 && (
              <div className="mt-7">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Target className="h-4 w-4 text-primary" /> Missing keywords
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.missingKeywords.slice(0, 18).map((k) => (
                    <span
                      key={k}
                      className="rounded-full border border-border/60 bg-surface-muted/50 px-2.5 py-1 text-xs"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-7 rounded-xl border border-border/60 bg-surface-muted/40 p-5">
              <div className="text-sm font-medium">How to raise your score</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
