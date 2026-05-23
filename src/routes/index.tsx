import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Sparkles,
  Camera,
  Wand2,
  Calculator,
  LineChart,
  FileDown,
  Upload,
  ScanSearch,
  CheckCircle2,
  PoundSterling,
  Percent,
  TrendingUp,
} from "lucide-react";
import heroAfter from "@/assets/hero-after.jpg";
import beforeImg from "@/assets/before.jpg";
import afterImg from "@/assets/after.jpg";
import { DISCLAIMER } from "@/core/reports";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Refurb Genius — Upload a property and instantly see its future potential" },
      {
        name: "description",
        content:
          "Upload room photos, review condition flags, see regional refurb estimates, model ROI and export a downloadable deal summary.",
      },
      {
        property: "og:title",
        content: "Refurb Genius — AI refurbishment analysis for UK property",
      },
      {
        property: "og:description",
        content: "Upload a property and instantly see its future potential.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <HowItWorks />
      <FeatureSplit
        eyebrow="AI Photo Analysis"
        title="See condition the way a surveyor would."
        body="Upload photos of any room. Our AI assesses condition, flags priorities, and pinpoints what needs work — wall by wall, surface by surface."
        bullets={[
          "Room-by-room condition scoring",
          "Priority levels (high / medium / low)",
          "Damp, dated, and structural flags",
        ]}
        icon={Camera}
        image={beforeImg}
        reverse={false}
      />
      <FeatureSplit
        eyebrow="AI Room Redesign"
        title="Visualise the finished refurb instantly."
        body="Generate beautiful redesign concepts for kitchens, bathrooms, living areas — tuned to UK buyer and tenant taste."
        bullets={[
          "Multiple style directions",
          "Specification-aware visuals",
          "Shareable with investors and trades",
        ]}
        icon={Wand2}
        image={afterImg}
        reverse
      />
      <CostEstimator />
      <InvestorMetrics />
      <ReportExport />
      <BeforeAfter />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,oklch(0.7_0.16_160/0.12),transparent_60%)]"
      />
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-12 lg:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> AI-native UK proptech
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Upload a property and instantly see its{" "}
              <span className="text-accent">future potential.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Upload room photos, then add property type, UK region, floor area, condition and
              finish level. First, you’ll see condition flags and a regional refurb cost range. A
              first-pass estimate usually takes about 2 minutes once the inputs are complete.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#workflow"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                See how it works
              </a>
            </div>
            <ul className="mt-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              {[
                "12 UK regions supported by regional labour multipliers",
                "No payment card required to create a free account",
                "PDF/export available after an estimate is generated",
              ].map((item) => (
                <li
                  key={item}
                  className="rounded-lg border border-border bg-background/70 px-3 py-2"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-border shadow-2xl">
              <img
                src={heroAfter}
                alt="Beautifully renovated UK living room"
                width={1280}
                height={896}
                className="h-auto w-full"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-xl border border-border bg-card p-4 shadow-lg sm:block">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Projected ROI
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">18.4%</p>
            </div>
            <div className="absolute -top-6 -right-6 hidden rounded-xl border border-border bg-card p-4 shadow-lg sm:block">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Refurb estimate
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">£64,500</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Upload,
      title: "Upload photos",
      desc: "Drop in photos of every room. JPG or PNG, no setup.",
    },
    {
      icon: ScanSearch,
      title: "AI analyses",
      desc: "Condition, redesigns and refurb scope generated automatically.",
    },
    {
      icon: FileDown,
      title: "Get your report",
      desc: "Costs, ROI and a polished investor-ready report — instantly.",
    },
  ];
  return (
    <section id="workflow" className="border-t border-border bg-secondary/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          eyebrow="How it works"
          title="From photos to investor report in three steps."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Card key={s.title} className="relative overflow-hidden">
              <CardContent className="p-6">
                <span className="absolute right-4 top-4 text-5xl font-bold text-secondary">
                  {i + 1}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureSplit({
  eyebrow,
  title,
  body,
  bullets,
  icon: Icon,
  image,
  reverse,
}: {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  icon: typeof Camera;
  image: string;
  reverse: boolean;
}) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div
          className={`grid items-center gap-12 lg:grid-cols-2 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}
        >
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
              <Icon className="h-4 w-4" /> {eyebrow}
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{body}</p>
            <ul className="mt-6 space-y-2.5">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border shadow-xl">
            <img
              src={image}
              alt={title}
              width={1024}
              height={768}
              loading="lazy"
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function CostEstimator() {
  const rows = [
    { c: "Kitchen", v: "£14,500" },
    { c: "Bathroom", v: "£9,800" },
    { c: "Electrics", v: "£7,200" },
    { c: "Decoration", v: "£6,300" },
    { c: "Windows", v: "£8,200" },
  ];
  return (
    <section className="border-y border-border bg-primary py-20 text-primary-foreground">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
              <Calculator className="h-4 w-4" /> UK Refurb Cost Estimator
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Costs benchmarked across every UK region.
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/80">
              Detailed line-item estimates that adjust to local labour and material rates — from
              London to the Highlands.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                "Line-item category breakdowns",
                "Built-in 10% contingency",
                "Regional rate adjustments",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-end justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary-foreground/60">
                  Total estimate
                </p>
                <p className="mt-1 text-3xl font-semibold">£64,500</p>
              </div>
              <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent">
                London
              </span>
            </div>
            <div className="mt-4 divide-y divide-white/10">
              {rows.map((r) => (
                <div key={r.c} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-primary-foreground/80">{r.c}</span>
                  <span className="font-medium">{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InvestorMetrics() {
  const m = [
    { label: "GDV", value: "£410,000", icon: TrendingUp },
    { label: "ROI", value: "18.4%", icon: Percent },
    { label: "Yield", value: "6.2%", icon: LineChart },
    { label: "Refurb cost", value: "£64,500", icon: PoundSterling },
  ];
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          eyebrow="Investor Metrics"
          title="Cost, scope and ROI assumptions in one view."
          subtitle="Purchase price, GDV, ROI, gross yield, monthly rent — modelled instantly from the analysis."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {m.map((x) => (
            <Card key={x.label}>
              <CardContent className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <x.icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {x.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  {x.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReportExport() {
  return (
    <section className="border-t border-border bg-secondary/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
              <FileDown className="h-4 w-4" /> Report Export
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Investor-ready reports in one click.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Export a polished PDF report with analysis, redesigns, costings and metrics — perfect
              for JV partners, lenders and your own deal pipeline.
            </p>
            <ul className="mt-6 space-y-2.5">
              {["Branded PDF export", "Full cost breakdown", "Embedded redesign visuals"].map(
                (b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {b}
                  </li>
                ),
              )}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <p className="text-sm font-semibold text-foreground">Refurb Report — 12 Elm Street</p>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                PDF
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Purchase" value="£285,000" />
              <Stat label="Refurb" value="£64,500" />
              <Stat label="GDV" value="£410,000" />
              <Stat label="ROI" value="18.4%" />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-3/4 rounded-full bg-accent" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Project margin vs cost</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function BeforeAfter() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          eyebrow="Before & After"
          title="See the potential before you buy."
          subtitle="A quick example of how Refurb Genius reimagines a tired property."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-border shadow-lg">
            <div className="relative">
              <span className="absolute left-4 top-4 z-10 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground">
                Before
              </span>
              <img
                src={beforeImg}
                alt="Property before refurbishment"
                width={1024}
                height={768}
                loading="lazy"
                className="h-72 w-full object-cover sm:h-96"
              />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border shadow-lg">
            <div className="relative">
              <span className="absolute left-4 top-4 z-10 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                After
              </span>
              <img
                src={afterImg}
                alt="Property after AI redesign"
                width={1024}
                height={768}
                loading="lazy"
                className="h-72 w-full object-cover sm:h-96"
              />
            </div>
          </div>
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
            Start seeing every property's potential.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Join UK investors using Refurb Genius to analyse deals faster and with more confidence.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
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

function Footer() {
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
