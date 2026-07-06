import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Upload,
  RefreshCw,
  Eye,
  Clock,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Zap,
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
  { icon: Clock, title: "Save hours weekly", desc: "No more logging into 3 portals every day." },
  { icon: ShieldCheck, title: "Secure by design", desc: "Credentials encrypted. Sessions isolated per user." },
  { icon: Sparkles, title: "More platforms soon", desc: "Naukri today. Indeed, LinkedIn and more coming." },
];

const STEPS = [
  { n: "01", title: "Sign in with Google", desc: "One click. No passwords to remember." },
  { n: "02", title: "Upload your resume", desc: "PDF only. We validate and store it securely." },
  { n: "03", title: "Connect job portals", desc: "Link Naukri, Indeed or LinkedIn in seconds." },
  { n: "04", title: "We refresh daily", desc: "Automation runs every morning. You get notified." },
];

const PLATFORMS = [
  { name: "Naukri", status: "Live", tone: "success" as const },
  { name: "Indeed", status: "Live", tone: "success" as const },
  { name: "LinkedIn", status: "Beta", tone: "warning" as const },
  { name: "Monster", status: "Soon", tone: "muted" as const },
  { name: "Shine", status: "Soon", tone: "muted" as const },
  { name: "Foundit", status: "Soon", tone: "muted" as const },
];

const FAQ = [
  { q: "Is this against portal terms of service?", a: "ResumePulse simulates the same actions you'd take manually — a light-weight resume refresh once per day. Use responsibly and at your own discretion." },
  { q: "Where do you store my portal password?", a: "Credentials are encrypted at rest with per-user keys and only decrypted inside the isolated automation worker at run time." },
  { q: "Do I need to keep my computer on?", a: "No. Automation runs on our infrastructure. You can close your browser and your profile still gets refreshed daily." },
  { q: "What happens after my free trial?", a: "You keep your account and data. Automation pauses until you upgrade to the ₹150/month plan." },
  { q: "Can I cancel anytime?", a: "Yes. Cancel from your dashboard. Your subscription runs until the end of the billing period." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="hero-bg relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Now supporting Naukri, Indeed & LinkedIn
          </div>
          <h1 className="mx-auto max-w-4xl text-5xl leading-[1.05] sm:text-6xl md:text-7xl">
            Your resume,{" "}
            <span className="italic text-primary">refreshed every day.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Recruiters filter by recently updated profiles. ResumePulse keeps yours on top —
            automatically, across every job portal you care about.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-gradient-primary shadow-glow">
              <Link to="/login">
                Start 2-day free trial <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how">See how it works</a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required · Cancel anytime
          </p>

          {/* Preview card */}
          <div className="relative mx-auto mt-16 max-w-4xl">
            <div className="absolute inset-x-10 -top-6 h-24 bg-gradient-primary opacity-30 blur-3xl" />
            <Card className="relative overflow-hidden border-border/60 bg-surface p-0 shadow-elegant">
              <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
                <div className="ml-3 text-xs text-muted-foreground">
                  resumepulse.app / dashboard
                </div>
              </div>
              <div className="grid gap-4 p-6 sm:grid-cols-3">
                <StatCard label="Automation" value="Active" tone="success" />
                <StatCard label="Last refresh" value="Today · 8:05 AM" tone="muted" />
                <StatCard label="Next refresh" value="Tomorrow · 8:00 AM" tone="muted" />
                <div className="sm:col-span-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Recent activity</div>
                  <ul className="space-y-2 text-sm">
                    <ActivityRow ok text="Resume updated on Naukri" time="8:02 AM" />
                    <ActivityRow ok text="Resume updated on LinkedIn" time="8:04 AM" />
                    <ActivityRow ok text="Resume updated on Indeed" time="8:05 AM" />
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionHeader
          eyebrow="Features"
          title="Everything to stay visible"
          desc="Focus on interviews. We'll handle the busywork of keeping your profile fresh."
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="border-border/60 p-6 transition hover:shadow-elegant">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-border/60 bg-surface-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeader
            eyebrow="How it works"
            title="Set up in under 2 minutes"
            desc="Four steps. Then never think about it again."
          />
          <div className="mt-14 grid gap-6 md:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <div className="font-display text-5xl italic text-primary/30">{s.n}</div>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section id="platforms" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionHeader
          eyebrow="Supported platforms"
          title="Every portal that matters"
          desc="One dashboard. All the job sites you use."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORMS.map((p) => (
            <Card key={p.name} className="flex items-center justify-between border-border/60 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-secondary-foreground font-semibold">
                  {p.name[0]}
                </div>
                <div className="font-medium">{p.name}</div>
              </div>
              <StatusPill tone={p.tone}>{p.status}</StatusPill>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section id="pricing" className="border-y border-border/60 bg-surface-muted/40">
        <div className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
          <SectionHeader
            eyebrow="Pricing"
            title="Simple, honest pricing"
            desc="Try free for 2 days. Then just ₹150/month. Cancel anytime."
          />
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <Card className="border-border/60 p-8">
              <div className="text-sm font-medium text-muted-foreground">Free trial</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-5xl">₹0</span>
                <span className="text-muted-foreground">for 2 days</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                <Check>Upload one resume</Check>
                <Check>Connect one portal</Check>
                <Check>Daily automatic refresh</Check>
                <Check>Activity logs</Check>
              </ul>
              <Button asChild variant="outline" className="mt-8 w-full">
                <Link to="/login">Start trial</Link>
              </Button>
            </Card>
            <Card className="relative border-primary/40 bg-surface p-8 shadow-glow">
              <div className="absolute -top-3 left-8 rounded-full bg-gradient-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Most popular
              </div>
              <div className="text-sm font-medium text-primary">Premium</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-5xl">₹150</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                <Check>Everything in trial</Check>
                <Check>All supported portals</Check>
                <Check>Priority refresh window</Check>
                <Check>Email notifications</Check>
                <Check>Full activity history</Check>
              </ul>
              <Button asChild className="mt-8 w-full bg-gradient-primary shadow-glow">
                <Link to="/pricing">Subscribe now</Link>
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <SectionHeader eyebrow="FAQ" title="Questions, answered" desc="" />
        <Accordion type="single" collapsible className="mt-10">
          {FAQ.map((item, i) => (
            <AccordionItem key={i} value={`i${i}`} className="border-border/60">
              <AccordionTrigger className="text-left text-base font-medium">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
        <Card className="hero-bg relative overflow-hidden border-border/60 p-12 text-center shadow-elegant">
          <Zap className="mx-auto mb-4 h-8 w-8 text-primary" />
          <h2 className="text-4xl sm:text-5xl">Stop chasing recruiters.</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Let ResumePulse keep your profile alive across every portal, every day.
          </p>
          <Button asChild size="lg" className="mt-8 bg-gradient-primary shadow-glow">
            <Link to="/login">
              Start your free trial <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </Card>
      </section>

      <Footer />
    </div>
  );
}

function SectionHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</div>
      <h2 className="mt-3 text-4xl sm:text-5xl">{title}</h2>
      {desc && <p className="mt-4 text-muted-foreground">{desc}</p>}
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span>{children}</span>
    </li>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: "success" | "muted" }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-muted/60 p-4 text-left">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`mt-1 font-semibold ${tone === "success" ? "text-success" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function ActivityRow({ ok, text, time }: { ok: boolean; text: string; time: string }) {
  return (
    <li className="flex items-center justify-between rounded-md bg-surface-muted/40 px-3 py-2 text-left">
      <div className="flex items-center gap-2">
        <CheckCircle2 className={`h-4 w-4 ${ok ? "text-success" : "text-destructive"}`} />
        <span>{text}</span>
      </div>
      <span className="text-xs text-muted-foreground">{time}</span>
    </li>
  );
}

function StatusPill({ tone, children }: { tone: "success" | "warning" | "muted"; children: React.ReactNode }) {
  const map = {
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    muted: "bg-secondary text-muted-foreground",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[tone]}`}>{children}</span>
  );
}
