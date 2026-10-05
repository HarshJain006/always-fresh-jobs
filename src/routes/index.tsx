import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  Mail,
  Bell,
  Star,
  Download,
  Globe2,
  MapPin,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser, AUTH_CHANGE_EVENT, STORAGE_KEY, type AppUser } from "@/auth/googleAuth";
import recruiterInvites from "@/assets/recruiter-invites.jpg";
import heroImage from "@/assets/image.png";
import panelFeatures from "@/assets/panel-features.jpg";
import panelSteps from "@/assets/panel-steps.jpg";
import panelPlatforms from "@/assets/panel-platforms.jpg";
import panelFaq from "@/assets/panel-faq.jpg";
import panelCta from "@/assets/panel-cta.jpg";

export const Route = createFileRoute("/")({ component: Landing });

/** Reflects localStorage session; clears when the user logs out. */
function useAuthUser() {
  const [user, setUser] = useState<AppUser | null>(null);
  useEffect(() => {
    const sync = () => setUser(getCurrentUser());
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(AUTH_CHANGE_EVENT, sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AUTH_CHANGE_EVENT, sync);
      window.removeEventListener("focus", sync);
    };
  }, []);
  return user;
}

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
  { name: "Indeed", status: "Coming soon", desc: "Global job search platform" },
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

const ATLASWORK_WORLD_TILES = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

function Landing() {
  const user = useAuthUser();
  const scrollToFeatures = () => {
    document.getElementById("features-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8 lg:px-0">
        <Panel><IntroPanel onStart={scrollToFeatures} signedIn={!!user} /></Panel>
        <div className="mt-10 space-y-10 sm:space-y-12 lg:space-y-16">
          <div id="features-panel" className="scroll-mt-24">
            <FeaturesPanel />
          </div>
          <StepsPanel />
          <PlatformsPanel />
          <FaqPanel />
          <CtaPanel signedIn={!!user} />
        </div>
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative w-full py-4 sm:py-6 lg:py-8">
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

/* -------- Panels -------- */

function IntroPanel({ onStart, signedIn }: { onStart: () => void; signedIn: boolean }) {
  return (
    <div className="relative">
      <div className="hero-bg absolute -inset-24 -z-10" aria-hidden />
      <div className="grid-pattern absolute -inset-24 -z-10" aria-hidden />
      <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <h1 className="text-5xl leading-[1.08] tracking-tight sm:text-6xl md:text-7xl">
            Get seen by recruiters,{" "}
            <span className="text-gradient-primary">every single day.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Recruiters filter by recently updated profiles. DailyResume keeps yours on top —
            automatically, across every job portal you use.
          </p>
          <div className="mt-8 max-w-xl rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/8 via-primary/5 to-transparent p-4 ring-soft">
            <p className="text-sm leading-relaxed text-foreground/80">
              <span className="font-semibold text-foreground">Land the package you actually deserve</span>
              {" "}— by reaching the maximum number of recruiters, every single day.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {signedIn ? (
              <Button asChild size="lg" className="bg-gradient-primary shadow-glow">
                <Link to="/dashboard">
                  Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="bg-gradient-primary shadow-glow">
                <Link to="/login">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <Link to="/download">
                <Download className="mr-2 h-4 w-4" /> Download app
              </Link>
            </Button>
            <Button size="lg" variant="ghost" onClick={onStart}>
              See how it works →
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div className="relative">
            <div
              className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent blur-2xl"
              aria-hidden
            />
            <img
              src={heroImage}
              alt="Recruiters reviewing a resume"
              width={720}
              height={480}
              className="w-full h-auto object-contain"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatCard value="8:00 AM" label="Daily refresh, IST" />
            <StatCard value="2 min" label="One-time setup" />
            <StatCard value="100%" label="Hands-off" />
            <StatCard value="Daily" label="Recruiter visibility" />
          </div>
        </div>
      </div>

      <div className="mt-12 sm:mt-14">
        <AtlasworkPanel />
      </div>

      {/* Social proof — real-world recruiter invites */}
      <div className="mt-14 grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary backdrop-blur">
            Real results
          </div>
          <h2 className="mt-4 text-3xl tracking-tight sm:text-4xl">
            Invites land in your inbox — while you sleep.
          </h2>
          <p className="mt-4 max-w-lg text-muted-foreground">
            Users who keep their profile fresh every day get contacted by recruiters
            across Naukri, Indeed and LinkedIn — for roles they never even applied to.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <TrustStat icon={Mail} value="3.2×" label="More recruiter messages" />
            <TrustStat icon={Bell} value="5×" label="More profile views" />
            <TrustStat icon={Star} value="4.8/5" label="User rating" />
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent blur-2xl" aria-hidden />
          <img
            src={recruiterInvites}
            alt="Recruiter messages and interview invitations from Google, Microsoft and Amazon"
            loading="lazy"
            width={1600}
            height={912}
            className="w-full rounded-2xl border border-border/60 shadow-elegant"
          />
        </div>
      </div>
    </div>
  );
}

function TrustStat({ icon: Icon, value, label }: { icon: typeof Mail; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-4 backdrop-blur">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-2 font-display text-xl font-bold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PanelImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-auto mt-10 max-w-3xl">
      <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent blur-2xl" aria-hidden />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        width={1200}
        height={800}
        className="w-full rounded-2xl border border-border/60 shadow-elegant"
      />
    </div>
  );
}

function FeaturesPanel() {
  return (
    <div>
      <PanelHeader eyebrow="Features" title="Everything to stay visible" />
      <PanelImage src={panelFeatures} alt="Icons representing DailyResume features" />
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
      <PanelImage src={panelSteps} alt="Four-step onboarding: sign in, upload resume, connect portals, automate" />
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
      <PanelImage src={panelPlatforms} alt="Naukri and Indeed connected to a central resume" />
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {PLATFORMS.map((p) => {
          const live = p.status === "Live";
          return (
            <Card
              key={p.name}
              className={`flex items-center justify-between border-border/60 p-5 transition hover:shadow-elegant ${live ? "" : "opacity-60"}`}
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
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  live
                    ? "bg-success/12 text-success"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {live && <CheckCircle2 className="h-3 w-3" />}
                {p.status}
              </span>
            </Card>
          );
        })}
      </div>
      <div className="mt-6 flex justify-center">
        <Button asChild variant="outline" size="sm">
          <Link to="/freelancers">
            Explore Atlaswork map <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function AtlasworkPanel() {
  return (
    <div className="mx-auto max-w-6xl">
      <PanelHeader eyebrow="Worldwide discovery" title="Not just visible to recruiters. Visible to the world." />
      <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            DailyResume keeps your resume fresh for recruiter searches. Atlaswork gives freelancers a
            public map profile so clients everywhere can discover the people, skills, and services they need.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <AtlasworkBenefit icon={MapPin} title="Be found by location" text="Pin your professional profile on a live world map." />
            <AtlasworkBenefit icon={Globe2} title="Reach beyond job boards" text="Show your services, skills, and availability to the world." />
          </div>
          <Button asChild size="lg" className="mt-8 bg-gradient-primary shadow-glow">
            <Link to="/freelancers">
              Explore Atlaswork <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div
          role="img"
          aria-label="OpenStreetMap world map with Atlaswork freelancer profile pins in New York, London, and Delhi"
          className="relative mx-auto aspect-square w-full max-w-[500px] overflow-hidden rounded-2xl border border-border/60 bg-surface-muted shadow-elegant"
        >
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
            {ATLASWORK_WORLD_TILES.map(({ x, y }) => (
              <img
                key={`${x}-${y}`}
                src={`https://tile.openstreetmap.org/1/${x}/${y}.png`}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-primary/10" aria-hidden />
          <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs font-semibold shadow-elegant backdrop-blur">
            <Globe2 className="h-4 w-4 text-primary" /> Freelancer profiles worldwide
          </div>
          {[
            { place: "New York", left: "29%", top: "39%" },
            { place: "London", left: "51%", top: "34%" },
            { place: "Delhi", left: "72%", top: "43%" },
          ].map((pin) => (
            <div key={pin.place} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: pin.left, top: pin.top }}>
              <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-gradient-primary text-primary-foreground shadow-glow">
                <UserRound className="h-4 w-4" />
              </div>
              <span className="absolute left-1/2 top-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/60 bg-background/95 px-2 py-1 text-[10px] font-semibold text-foreground shadow-elegant">
                {pin.place}
              </span>
            </div>
          ))}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="absolute bottom-2 right-2 z-10 rounded bg-background/90 px-1.5 py-1 text-[9px] text-muted-foreground">
            © OpenStreetMap contributors
          </a>
        </div>
      </div>
    </div>
  );
}

function AtlasworkBenefit({ icon: Icon, title, text }: { icon: typeof MapPin; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-secondary to-background text-primary ring-soft">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function FaqPanel() {
  return (
    <div className="mx-auto max-w-4xl">
      <PanelHeader eyebrow="FAQ" title="Questions, answered" />
      <PanelImage src={panelFaq} alt="Friendly support answering questions" />
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

function CtaPanel({ signedIn }: { signedIn: boolean }) {
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
          <img
            src={panelCta}
            alt="Rocket launching from a laptop, symbolizing career acceleration"
            loading="lazy"
            width={1200}
            height={800}
            className="mx-auto mt-8 w-full max-w-xl rounded-2xl border border-border/60 shadow-elegant"
          />
          <Button asChild size="lg" className="mt-8 bg-gradient-primary shadow-glow">
            <Link to={signedIn ? "/dashboard" : "/login"}>
              {signedIn ? (
                <>Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></>
              ) : (
                <>Get Started <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Link>
          </Button>
          <div className="mt-3">
            <Button asChild size="lg" variant="outline">
              <Link to="/download">
                <Download className="mr-2 h-4 w-4" /> Download app
              </Link>
            </Button>
          </div>
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
