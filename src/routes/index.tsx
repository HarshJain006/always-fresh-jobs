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
  { name: "Naukri", status: "Live", tone: "success" as const },
  { name: "Indeed", status: "Live", tone: "success" as const },
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
      <section className="hero-bg relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            Get seen by recruiters,{" "}
            <span className="text-primary">every single day.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Recruiters filter by recently updated profiles. ResumePulse keeps yours on top —
            automatically, across every job portal you use.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-gradient-primary shadow-glow">
              <Link to="/login">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how">See how it works</a>
            </Button>
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
                <div className="font-display text-5xl font-bold text-primary/30">{s.n}</div>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section id="platforms" className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
        <SectionHeader
          eyebrow="Supported platforms"
          title="Currently supported"
          desc="More platforms coming soon."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {PLATFORMS.map((p) => (
            <Card key={p.name} className="flex items-center justify-between border-border/60 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-secondary-foreground font-semibold">
                  {p.name[0]}
                </div>
                <div className="font-medium">{p.name}</div>
              </div>
              <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                {p.status}
              </span>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/60 bg-surface-muted/40">
        <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
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
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
        <Card className="hero-bg relative overflow-hidden border-border/60 p-12 text-center shadow-elegant">
          <Zap className="mx-auto mb-4 h-8 w-8 text-primary" />
          <h2 className="text-4xl font-bold sm:text-5xl">Stop chasing recruiters.</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Let ResumePulse keep your profile alive across every portal, every day.
          </p>
          <Button asChild size="lg" className="mt-8 bg-gradient-primary shadow-glow">
            <Link to="/login">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
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
      <h2 className="mt-3 text-4xl font-bold sm:text-5xl">{title}</h2>
      {desc && <p className="mt-4 text-muted-foreground">{desc}</p>}
    </div>
  );
}
