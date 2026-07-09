import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  RefreshCw,
  Eye,
  Clock,
  ShieldCheck,
  Sparkles,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({ component: Landing });

const FEATURES = [
  { icon: Upload, title: "Upload once", desc: "Add your resume a single time. We securely store and reuse it." },
  { icon: RefreshCw, title: "Daily auto-refresh", desc: "We update your profile every morning while you sleep." },
  { icon: Eye, title: "Recruiter visibility", desc: "Active profiles rank higher — get seen first." },
  { icon: Clock, title: "Save hours weekly", desc: "No more logging into multiple portals every day." },
  { icon: ShieldCheck, title: "Secure by design", desc: "Credentials encrypted. Sessions isolated per user." },
  { icon: Sparkles, title: "Zero maintenance", desc: "Set it once. We handle the rest — forever." },
];

const STEPS = [
  { n: "01", title: "Sign in with Google", desc: "One click. No passwords to remember." },
  { n: "02", title: "Upload your resume", desc: "PDF only. We validate and store it securely." },
  { n: "03", title: "Connect job portals", desc: "Link Naukri or Indeed in seconds." },
  { n: "04", title: "We refresh daily", desc: "Automation runs every morning. You get notified." },
];

const PLATFORMS = [
  { name: "Naukri", status: "Live", desc: "India's largest job portal" },
  { name: "Indeed", status: "Live", desc: "Global job search platform" },
];

const FAQ = [
  {
    q: "What does DailyResume do?",
    a: "DailyResume automatically refreshes your resume every day on job portals like Naukri and Indeed. You upload it once, connect your accounts, and we keep your profile marked as recently updated — without you lifting a finger.",
  },
  {
    q: "Why do we do it?",
    a: "Job seekers waste hours every week logging into multiple portals just to click 'update' so their resume looks fresh. We built DailyResume to remove that repetitive busywork so you can focus on interviews and real applications instead.",
  },
  {
    q: "Why is it required?",
    a: "Recruiters filter and sort candidates by 'recently updated' profiles. A resume that hasn't been touched in a week gets buried under thousands of newer ones. Daily refreshes keep you at the top of recruiter searches — which directly translates to more views, more calls and more interviews.",
  },
];

const PANELS = ["Intro", "Features", "How it works", "Platforms", "FAQ", "Start"];

function Landing() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Only horizontal scroll (trackpad / shift+wheel / arrow keys) changes panels.
  // Vertical scroll is preserved for content inside each panel.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setActive(Math.max(0, Math.min(PANELS.length - 1, i)));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") el.scrollBy({ left: el.clientWidth, behavior: "smooth" });
      if (e.key === "ArrowLeft") el.scrollBy({ left: -el.clientWidth, behavior: "smooth" });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, []);


  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  const next = () => goTo(Math.min(active + 1, PANELS.length - 1));
  const prev = () => goTo(Math.max(active - 1, 0));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header />

      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollerRef}
          className="flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Panel><IntroPanel onStart={next} /></Panel>
          <Panel><FeaturesPanel /></Panel>
          <Panel><StepsPanel /></Panel>
          <Panel><PlatformsPanel /></Panel>
          <Panel><FaqPanel /></Panel>
          <Panel><CtaPanel /></Panel>
        </div>

        {/* Nav arrows */}
        <button
          onClick={prev}
          disabled={active === 0}
          aria-label="Previous"
          className="absolute left-4 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border/60 bg-background/80 shadow-elegant backdrop-blur transition hover:scale-105 disabled:pointer-events-none disabled:opacity-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          onClick={next}
          disabled={active === PANELS.length - 1}
          aria-label="Next"
          className="absolute right-4 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border/60 bg-background/80 shadow-elegant backdrop-blur transition hover:scale-105 disabled:pointer-events-none disabled:opacity-0"
        >
          <ArrowRight className="h-4 w-4" />
        </button>

        {/* Progress dots + label */}
        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 rounded-full border border-border/60 bg-background/80 px-4 py-2 shadow-elegant backdrop-blur">
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {String(active + 1).padStart(2, "0")} / {String(PANELS.length).padStart(2, "0")}
          </span>
          <span className="h-3 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            {PANELS.map((p, i) => (
              <button
                key={p}
                onClick={() => goTo(i)}
                aria-label={p}
                className={`h-1.5 rounded-full transition-all ${
                  i === active ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>
          <span className="hidden text-xs font-medium text-foreground sm:inline">{PANELS[active]}</span>
        </div>
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative flex h-full w-screen shrink-0 snap-center items-start overflow-y-auto sm:items-center">
      <div className="mx-auto w-full max-w-6xl px-6 pb-24 pt-10 sm:px-12 sm:py-16">{children}</div>
    </section>
  );
}

/* -------- Panels -------- */

function IntroPanel({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative">
      <div className="hero-bg absolute -inset-24 -z-10" aria-hidden />
      <div className="grid-pattern absolute -inset-24 -z-10" aria-hidden />
      <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            Live · Refreshing profiles right now
          </div>
          <h1 className="mt-6 text-5xl leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
            Get seen by recruiters,{" "}
            <span className="text-gradient-primary">every single day.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Recruiters filter by recently updated profiles. DailyResume keeps yours on top —
            automatically, across every job portal you use.
          </p>
          <div className="mt-8 max-w-xl rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/8 via-primary/5 to-transparent p-4 ring-soft">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed text-foreground/80">
                <span className="font-semibold text-foreground">Land the package you actually deserve</span>
                {" "}— by reaching the maximum number of recruiters, every single day.
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="bg-gradient-primary shadow-glow">
              <Link to="/login">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="ghost" onClick={onStart}>
              See how it works →
            </Button>
          </div>

        </div>
        <div className="grid grid-cols-2 gap-4">
          <StatCard value="8:00 AM" label="Daily refresh, IST" />
          <StatCard value="2 min" label="One-time setup" />
          <StatCard value="100%" label="Hands-off" />
          <StatCard value="Daily" label="Recruiter visibility" />
        </div>
      </div>
    </div>
  );
}

function FeaturesPanel() {
  return (
    <div>
      <PanelHeader eyebrow="Features" title="Everything to stay visible" />
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="group bg-background p-7 transition-colors hover:bg-surface-muted/40">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepsPanel() {
  return (
    <div>
      <PanelHeader eyebrow="How it works" title="Set up in under 2 minutes" />
      <div className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
        <div className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" aria-hidden />
        {STEPS.map((s) => (
          <div key={s.n} className="relative">
            <div className="relative z-10 grid h-12 w-12 place-items-center rounded-full border border-border/60 bg-background font-display text-sm font-bold text-primary shadow-elegant">
              {s.n}
            </div>
            <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformsPanel() {
  return (
    <div className="mx-auto max-w-3xl">
      <PanelHeader eyebrow="Supported platforms" title="Currently supported" />
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {PLATFORMS.map((p) => (
          <Card key={p.name} className="flex items-center justify-between border-border/60 p-5 transition hover:shadow-elegant">
            <div className="flex items-center gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-secondary to-background font-semibold text-secondary-foreground ring-soft">
                {p.name[0]}
              </div>
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.desc}</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-medium text-success">
              <CheckCircle2 className="h-3 w-3" />
              {p.status}
            </span>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">More platforms coming soon.</p>
    </div>
  );
}

function FaqPanel() {
  return (
    <div className="mx-auto max-w-4xl">
      <PanelHeader eyebrow="FAQ" title="Questions, answered" />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {FAQ.map((item, i) => (
          <Card key={i} className="border-border/60 p-6 shadow-elegant">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">
              {String(i + 1).padStart(2, "0")}
            </div>
            <h3 className="mt-3 text-lg font-semibold">{item.q}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CtaPanel() {
  return (
    <div className="relative">
      <Card className="relative overflow-hidden border-border/60 p-14 text-center shadow-elegant">
        <div className="hero-bg absolute inset-0" aria-hidden />
        <div className="grid-pattern absolute inset-0" aria-hidden />
        <div className="relative">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <Zap className="h-5 w-5" />
          </div>
          <h2 className="mt-6 text-4xl tracking-tight sm:text-5xl">Stop chasing recruiters.</h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Let DailyResume keep your profile alive across every portal, every day.
          </p>
          <Button asChild size="lg" className="mt-8 bg-gradient-primary shadow-glow">
            <Link to="/login">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* -------- Bits -------- */

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-5 backdrop-blur ring-soft">
      <div className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</div>
    </div>
  );
}

function PanelHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
        {eyebrow}
      </div>
      <h2 className="mt-5 text-4xl tracking-tight sm:text-5xl">{title}</h2>
    </div>
  );
}
