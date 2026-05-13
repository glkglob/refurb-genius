import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { PlatformNavButtons } from "@/components/PlatformNavButtons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Briefcase,
  HardHat,
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  Wrench,
  Zap,
  Droplets,
  PaintBucket,
  Hammer,
  Thermometer,
  LayoutGrid,
  Star,
  MessageSquare,
  FileText,
  UserCheck,
  Loader2,
  MapPin,
  CalendarDays,
  SlidersHorizontal,
} from "lucide-react";
import { DISCLAIMER } from "@/core/reports";
import type { TradesJob, TradesJobCategory } from "@/core/trades";
import { TRADES_JOB_CATEGORIES } from "@/core/trades";
import {
  formatCategoryLabel,
  formatBudgetRange,
  formatShortDate,
} from "@/core/trades/tradesJob.selectors";
import { listPostedTradesJobs } from "@/services/trades/tradesJobStore";

export const Route = createFileRoute("/trades")({
  head: () => ({
    meta: [
      { title: "Trades Marketplace — Refurb Genius" },
      {
        name: "description",
        content:
          "Post refurbishment jobs or register as a tradesperson. Connecting UK property clients with trusted local trades.",
      },
    ],
  }),
  component: TradesPage,
});

function TradesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <TradesHero />
      <AudienceCards />
      <LiveJobListings />
      <HowItWorks />
      <JobDetails />
      <TradeCategories />
      <TrustSafety />
      <FinalCTA />
      <TradesFooter />
    </div>
  );
}

function TradesHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,oklch(0.7_0.16_160/0.12),transparent_60%)]"
      />
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-16 text-center lg:pt-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          <HardHat className="h-3.5 w-3.5 text-accent" /> Trades Marketplace — coming soon
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Post refurbishment jobs and connect with{" "}
          <span className="text-accent">trusted trades.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Refurb Genius is building a marketplace where UK property clients post scoped jobs
          directly from their analysis and local tradespeople register to quote — vetted, rated, and
          ready.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/trades/new">
              Post a job <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#register-trade">Register as a tradesperson</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function AudienceCards() {
  return (
    <section className="border-t border-border bg-secondary/30 py-20">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeader
          eyebrow="Who it's for"
          title="Built for clients and trades alike."
          subtitle="Whether you're managing a refurb or looking for your next job, Refurb Genius connects you directly."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Card className="relative overflow-hidden border-border">
            <CardContent className="p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Briefcase className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-foreground">For clients</h3>
              <p className="mt-2 text-muted-foreground">
                Post your scoped refurbishment job with a budget range, timeline, and property
                details. Receive expressions of interest from rated local trades.
              </p>
              <ul className="mt-5 space-y-2">
                {[
                  "Pre-scope your job with an AI estimate first",
                  "Set budget, timeline and location",
                  "Get contacted by verified tradespeople",
                  "No obligation — post for free",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button asChild className="w-full sm:w-auto">
                  <Link to="/trades/new">
                    Post a job <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border">
            <CardContent className="p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <HardHat className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-foreground">For tradespeople</h3>
              <p className="mt-2 text-muted-foreground">
                Register your trade, set your working area and categories, and receive alerts when
                relevant jobs are posted near you.
              </p>
              <ul className="mt-5 space-y-2">
                {[
                  "Browse scoped jobs in your area",
                  "Register interest and quote directly",
                  "Build a verified profile and ratings",
                  "No commission on completed jobs",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8" id="register-trade">
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Register interest <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

// ─── Live job listings ────────────────────────────────────────────────────────

type JobsState =
  | { status: "loading" }
  | { status: "ok"; jobs: TradesJob[] }
  | { status: "error"; message: string };

function usePostedJobs(category: string): JobsState {
  const [state, setState] = useState<JobsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    listPostedTradesJobs(category || undefined)
      .then((jobs) => {
        if (!cancelled) setState({ status: "ok", jobs });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load jobs.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  return state;
}

function LiveJobListings() {
  const [activeCategory, setActiveCategory] = useState<string>("");
  const state = usePostedJobs(activeCategory);

  return (
    <section className="py-20" id="live-jobs">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          eyebrow="Live jobs"
          title="Posted refurbishment jobs."
          subtitle="Browse jobs posted by UK property clients — apply directly with a short message."
        />

        <PlatformNavButtons exclude={["/trades"]} className="mt-8" />

        {/* Category filter */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filter:
          </span>
          <button
            onClick={() => setActiveCategory("")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === ""
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-foreground"
            }`}
          >
            All categories
          </button>
          {TRADES_JOB_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === cat.value
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="mt-8">
          {state.status === "loading" && (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {state.status === "error" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
              {state.message}
            </div>
          )}

          {state.status === "ok" && state.jobs.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-secondary/30 py-16 text-center">
              <Briefcase className="h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-foreground">No jobs posted yet</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                {activeCategory
                  ? `No ${formatCategoryLabel(activeCategory as TradesJobCategory)} jobs are live right now. Check back soon.`
                  : "Be the first to post a refurbishment job to the marketplace."}
              </p>
              <Button asChild size="sm" className="mt-2">
                <Link to="/trades/new">
                  Post a job <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}

          {state.status === "ok" && state.jobs.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {state.jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function JobCard({ job }: { job: TradesJob }) {
  const descPreview =
    job.description.length > 120 ? job.description.slice(0, 120).trimEnd() + "…" : job.description;

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        {/* Category pill */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
            {formatCategoryLabel(job.jobCategory)}
          </span>
          <span className="text-xs text-muted-foreground">{formatShortDate(job.createdAt)}</span>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold leading-snug text-foreground">{job.title}</h3>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {job.postcode && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.postcode}
            </span>
          )}
          {job.desiredStartDate && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatShortDate(job.desiredStartDate)}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="flex-1 text-sm text-muted-foreground">{descPreview}</p>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-medium text-foreground">{formatBudgetRange(job)}</span>
          <Button asChild size="sm" variant="outline">
            <Link to="/trades/$jobId" params={{ jobId: job.id }}>
              View job <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Marketing sections ────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      icon: FileText,
      title: "Run an AI estimate",
      desc: "Use Refurb Genius to scope your refurb, generate a cost estimate, and identify the trade categories needed.",
    },
    {
      icon: ClipboardList,
      title: "Post your job",
      desc: "Publish the scoped job to the marketplace with budget range, location, timeline, and any specific requirements.",
    },
    {
      icon: MessageSquare,
      title: "Trades register interest",
      desc: "Verified local tradespeople browse your posting and send you an expression of interest to quote.",
    },
    {
      icon: UserCheck,
      title: "Choose and appoint",
      desc: "Review profiles, ratings, and previous work. Appoint directly through the platform.",
    },
  ];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          eyebrow="How it works"
          title="From analysis to appointed trades in four steps."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Card key={s.title} className="relative overflow-hidden">
              <CardContent className="p-6">
                <span className="absolute right-4 top-4 text-5xl font-bold text-secondary">
                  {i + 1}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function JobDetails() {
  const details = [
    {
      label: "Property address",
      note: "Town/postcode area — full address shared only after appointment",
    },
    { label: "Property type", note: "Terraced, semi, detached, flat, HMO, commercial" },
    {
      label: "Trade categories needed",
      note: "e.g. kitchen fit, full rewire, bathroom, decoration",
    },
    { label: "Budget range", note: "Approximate spend — helps trades self-select" },
    { label: "Preferred start date", note: "Flexible or fixed — ASAP, within 4 weeks, etc." },
    { label: "Scope description", note: "Auto-generated from AI estimate or written manually" },
    { label: "Photos", note: "Room-by-room condition photos from your analysis" },
    { label: "Access notes", note: "Occupied, vacant, key safe, viewing by appointment" },
  ];

  return (
    <section className="border-y border-border bg-secondary/30 py-20">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeader
          eyebrow="Job postings"
          title="What clients include in a job posting."
          subtitle="A well-scoped posting gets faster, more accurate interest from trades."
        />
        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          {details.map((d) => (
            <div
              key={d.label}
              className="flex items-start gap-3 rounded-xl border border-border bg-background p-4"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-medium text-foreground">{d.label}</p>
                <p className="text-xs text-muted-foreground">{d.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TradeCategories() {
  const categories = [
    { icon: Wrench, label: "General builder" },
    { icon: Zap, label: "Electrician" },
    { icon: Droplets, label: "Plumber" },
    { icon: PaintBucket, label: "Decorator" },
    { icon: Hammer, label: "Carpenter / joiner" },
    { icon: LayoutGrid, label: "Tiler" },
    { icon: Thermometer, label: "Heating engineer" },
    { icon: HardHat, label: "Structural / groundworks" },
  ];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeader
          eyebrow="Trade categories"
          title="Every trade a UK refurb needs."
          subtitle="Tradespeople register under one or more categories and receive alerts only for relevant jobs."
        />
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {categories.map((c) => (
            <Card key={c.label} className="group hover:border-accent/40 transition-colors">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors">
                  <c.icon className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-foreground">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustSafety() {
  const notes = [
    {
      icon: ShieldCheck,
      title: "Verified tradespeople",
      body: "All tradespeople complete identity verification and provide proof of relevant insurance before being approved to register interest.",
    },
    {
      icon: Star,
      title: "Ratings after each job",
      body: "Clients leave verified ratings once a job completes. Trades build a public track record visible to all future clients.",
    },
    {
      icon: UserCheck,
      title: "Client-controlled contact",
      body: "Full address and contact details are only shared once you choose to accept an expression of interest. No unsolicited contact.",
    },
    {
      icon: ClipboardList,
      title: "Dispute support",
      body: "Refurb Genius provides a neutral dispute support process if an issue arises between a client and an appointed trade.",
    },
  ];

  return (
    <section className="border-t border-border bg-secondary/30 py-20">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeader
          eyebrow="Trust & safety"
          title="Safe for clients. Fair for trades."
          subtitle="Every part of the marketplace is designed to protect both sides of the relationship."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {notes.map((n) => (
            <div
              key={n.title}
              className="flex items-start gap-4 rounded-xl border border-border bg-background p-6"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <n.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{n.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-primary p-10 text-center text-primary-foreground sm:p-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,oklch(0.7_0.16_160/0.25),transparent_70%)]"
          />
          <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">
            Be first to know when trades launches.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Create a free Refurb Genius account today. We'll notify you the moment the trades
            marketplace opens in your area.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/auth" search={{ mode: "signup" }}>
                Create free account <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 text-primary-foreground hover:bg-white/10"
            >
              <Link to="/">Back to Refurb Genius</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-lg text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function TradesFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-xs text-muted-foreground">{DISCLAIMER}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Refurb Genius. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
