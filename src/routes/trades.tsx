import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";

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
  MessageSquare,
  FileText,
  UserCheck,
  Loader2,
  MapPin,
  CalendarDays,
  SlidersHorizontal,
} from "lucide-react";
import { DISCLAIMER } from "@/core/reports";
import type { PublicTradesJob, TradesJobCategory } from "@/core/trades";
import { TRADES_JOB_CATEGORIES } from "@/core/trades";
import {
  formatCategoryLabel,
  formatBudgetRange,
  formatShortDate,
} from "@/core/trades/tradesJob.selectors";
import { listPostedTradesJobs } from "@/features/trades";

export const Route = createFileRoute("/trades")({
  head: () => ({
    meta: [
      { title: "Trades Job Board — Refurb Genius" },
      {
        name: "description",
        content:
          "Post and browse UK refurbishment jobs on the Trades job board (limited beta). Provider marketplace features are still developing.",
      },
    ],
  }),
  component: TradesPage,
});

function TradesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <TradesHero />
        <AudienceCards />
        <LiveJobListings />
        <HowItWorks />
        <JobDetails />
        <TradeCategories />
        <TrustSafety />
        <FinalCTA />
      </main>
      <TradesFooter />
    </div>
  );
}

function TradesHero() {
  const { user } = useAuth();

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,oklch(0.7_0.16_160/0.12),transparent_60%)]"
      />
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-16 text-center lg:pt-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          <HardHat className="h-3.5 w-3.5 text-accent" /> Trades job board — limited beta
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Post and browse refurbishment <span className="text-accent">jobs</span> on the Trades
          board.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          The job board is available now in limited beta: post scoped refurbishment work, browse
          posted jobs, and manage your own listings. A verified provider marketplace, matching, and
          identity checks are still developing — not live yet.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/trades/new"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Post a job <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <a
            href="#register-trade"
            className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Create a trade profile
          </a>
          {user ? (
            <Link
              to="/marketplace"
              data-testid="trades-marketplace-home"
              className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              Marketplace — My Jobs and My Interests
            </Link>
          ) : null}
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
          subtitle="Post work, browse the job board, or create a self-submitted trade profile. Matching and verification are not live yet."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Card className="relative overflow-hidden border-border">
            <CardContent className="p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Briefcase className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-foreground">For clients</h3>
              <p className="mt-2 text-muted-foreground">
                Post a scoped refurbishment job with budget range, timeline, and property details.
                Manage your listings and review expressions of interest where tradespeople respond.
              </p>
              <ul className="mt-5 space-y-2">
                {[
                  "Optionally scope work first with a Refurb Genius estimate",
                  "Set budget, timeline and area",
                  "Publish to the public Trades job board",
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
                Create a self-submitted trade profile, set categories and working area, and browse
                posted jobs on the board.
              </p>
              <ul className="mt-5 space-y-2">
                {[
                  "Browse posted jobs on the job board",
                  "Register interest on jobs you can take on",
                  "Create a self-submitted trade profile",
                  "No platform commission on jobs you complete offline",
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
                    Create account <ArrowRight className="h-4 w-4" />
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
  | { status: "ok"; jobs: PublicTradesJob[] }
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

        {/* Category filter */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filter:
          </span>
          <button
            onClick={() => setActiveCategory("")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === ""
                ? "border-accent bg-accent/10 text-accent-text"
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
                  ? "border-accent bg-accent/10 text-accent-text"
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
                  : "Be the first to post a refurbishment job to the Trades job board."}
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

function JobCard({ job }: { job: PublicTradesJob }) {
  const descPreview =
    job.description.length > 120 ? job.description.slice(0, 120).trimEnd() + "…" : job.description;

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        {/* Category pill */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent-text">
            {formatCategoryLabel(job.jobCategory)}
          </span>
          <span className="text-xs text-muted-foreground">{formatShortDate(job.createdAt)}</span>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold leading-snug text-foreground">{job.title}</h3>

        {/* Meta row — outward postcode only (privacy boundary) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {job.outwardPostcode && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.outwardPostcode}
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
      title: "Scope your work (optional)",
      desc: "Use Refurb Genius estimates when you want cost context. Posting a job does not automatically publish an estimate or match providers.",
    },
    {
      icon: ClipboardList,
      title: "Post your job",
      desc: "Publish to the Trades job board with budget range, area, timeline, and requirements. Full street address stays private from public listings.",
    },
    {
      icon: MessageSquare,
      title: "Trades register interest",
      desc: "Tradespeople can browse posted jobs and send an expression of interest. Responses are not guaranteed.",
    },
    {
      icon: UserCheck,
      title: "Review and decide",
      desc: "Review any interest you receive and arrange next steps yourself. Platform appointment, matching, and verification are not live yet.",
    },
  ];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader eyebrow="How it works" title="How the Trades job board works today." />
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
      note: "Kept private from public job listings — only the job owner sees the full address",
    },
    {
      label: "Public location",
      note: "Area / outward postcode only on the public job board",
    },
    { label: "Property type", note: "Terraced, semi, detached, flat, and other types you choose" },
    {
      label: "Trade categories needed",
      note: "e.g. kitchen fit, full rewire, bathroom, decoration",
    },
    { label: "Budget range", note: "Approximate spend — helps tradespeople self-select" },
    { label: "Preferred start date", note: "Flexible or fixed — ASAP, within 4 weeks, etc." },
    { label: "Scope description", note: "Written by you when you post the job" },
  ];

  return (
    <section className="border-y border-border bg-secondary/30 py-20">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeader
          eyebrow="Job postings"
          title="What clients can include in a job posting."
          subtitle="Clear scope and budget help tradespeople decide whether to register interest."
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
          title="Categories commonly used on refurb jobs."
          subtitle="When you create a trade profile you can select the categories you work in."
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
      title: "Self-submitted profiles",
      body: "Trade profiles may contain information entered by the tradesperson. Refurb Genius does not currently run identity or insurance verification.",
    },
    {
      icon: UserCheck,
      title: "Your checks still matter",
      body: "Carry out your own checks before appointing anyone. You remain responsible for selecting and contracting with tradespeople.",
    },
    {
      icon: MapPin,
      title: "Private property address",
      body: "Full street address is kept private from public job listings. Public views show Area (outward postcode) only.",
    },
    {
      icon: ClipboardList,
      title: "Verification still developing",
      body: "Provider verification, ratings, matching, and dispute support are not live product features yet.",
    },
  ];

  return (
    <section className="border-t border-border bg-secondary/30 py-20">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeader
          eyebrow="Trust & safety"
          title="What is true today."
          subtitle="We describe current capability honestly while verification and marketplace features are still developing."
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
            Use the Trades job board today.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Create a free account to post a job or create a trade profile. Provider directory,
            verification, and matching remain under development.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/trades/new">
                Post a job <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 text-primary-foreground hover:bg-white/10"
            >
              <Link to="/auth" search={{ mode: "signup" }}>
                Create free account
              </Link>
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
      <span className="text-xs font-semibold uppercase tracking-wider text-accent-text">
        {eyebrow}
      </span>
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
