import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Upload,
  RefreshCw,
  Eye,
  Clock,
  ShieldCheck,
  Sparkles,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
    q: "What does ResumePulse do?",
    a: "ResumePulse automatically refreshes your resume every day on job portals like Naukri and Indeed. You upload it once, connect your accounts, and we keep your profile marked as recently updated — without you lifting a finger.",
  },
  {
    q: "Why do we do it?",
    a: "Job seekers waste hours every week logging into multiple portals just to click 'update' so their resume looks fresh. We built ResumePulse to remove that repetitive busywork so you can focus on interviews and real applications instead.",
  },
  {
    q: "Why is it required?",
    a: "Recruiters filter and sort candidates by 'recently updated' profiles. A resume that hasn't been touched in a week gets buried under thousands of newer ones. Daily refreshes keep you at the top of recruiter searches — which directly translates to more views, more calls and more interviews.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-bg absolute inset-0" aria-hidden />
        <div className="grid-pattern absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 py-28 text-center sm:px-6 sm:py-36">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            Live · Refreshing profiles right now
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl text-5xl leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
            Get seen by recruiters,
            <br className="hidden sm:block" />{" "}
            <span className="text-gradient-primary">every single day.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Recruiters filter by recently updated profiles. ResumePulse keeps yours on top —
            automatically, across every job portal you use.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-gradient-primary shadow-glow">
              <Link to="/login">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a href="#how">See how it works →</a>
            </Button>
          </div>

          {/* Trust strip */}
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-4 border-t border-border/60 pt-8 text-left sm:gap-8">
            <Stat value="8:00 AM" label="Daily refresh, IST" />
            <Stat value="2 min" label="One-time setup" />
            <Stat value="100%" label="Hands-off after that" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
        <SectionHeader
          eyebrow="Features"
          title="Everything to stay visible"
          desc="Focus on interviews. We'll handle the busywork of keeping your profile fresh."
        />
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative bg-background p-8 transition-colors hover:bg-surface-muted/40"
            >
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-border/60 bg-surface-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
          <SectionHeader
            eyebrow="How it works"
            title="Set up in under 2 minutes"
            desc="Four steps. Then never think about it again."
          />
          <div className="relative mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
            <div
              className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
              aria-hidden
            />
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
      </section>

      {/* Platforms */}
      <section id="platforms" className="mx-auto max-w-4xl px-4 py-28 sm:px-6">
        <SectionHeader
          eyebrow="Supported platforms"
          title="Currently supported"
          desc="More platforms coming soon."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {PLATFORMS.map((p) => (
            <Card
              key={p.name}
              className="group relative flex items-center justify-between overflow-hidden border-border/60 p-5 transition hover:shadow-elegant"
            >
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
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/60 bg-surface-muted/40">
        <div className="mx-auto max-w-3xl px-4 py-28 sm:px-6">
          <SectionHeader eyebrow="FAQ" title="Questions, answered" desc="" />
          <Accordion type="single" collapsible className="mt-12 space-y-3">
            {FAQ.map((item, i) => (
              <AccordionItem
                key={i}
                value={`i${i}`}
                className="rounded-xl border border-border/60 bg-background px-5 shadow-elegant"
              >
                <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-28 sm:px-6">
        <Card className="relative overflow-hidden border-border/60 p-14 text-center shadow-elegant">
          <div className="hero-bg absolute inset-0" aria-hidden />
          <div className="grid-pattern absolute inset-0" aria-hidden />
          <div className="relative">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Zap className="h-5 w-5" />
            </div>
            <h2 className="mt-6 text-4xl tracking-tight sm:text-5xl">
              Stop chasing recruiters.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Let ResumePulse keep your profile alive across every portal, every day.
            </p>
            <Button asChild size="lg" className="mt-8 bg-gradient-primary shadow-glow">
              <Link to="/login">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>
      </section>

      <Footer />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
        {eyebrow}
      </div>
      <h2 className="mt-5 text-4xl tracking-tight sm:text-5xl">{title}</h2>
      {desc && <p className="mt-4 text-muted-foreground">{desc}</p>}
    </div>
  );
}
