import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Calculator, LineChart, Camera } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Refurb Genius — AI Refurbishment Analysis for UK Property" },
      { name: "description", content: "AI-first proptech for UK investors. Analyse refurbs, generate redesigns, estimate costs and project ROI in minutes." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> AI-native UK proptech
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
              Refurbishment intelligence for UK property investors.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Upload photos of any property and get AI-powered condition analysis, redesign concepts,
              accurate cost estimates and investor metrics — all in minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/dashboard">
                  Open dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </div>

          <div className="mt-20 grid gap-6 sm:grid-cols-3">
            {[
              { icon: Camera, title: "Photo-led analysis", desc: "Upload property photos and get room-by-room AI condition reports." },
              { icon: Calculator, title: "Regional estimates", desc: "Refurb costs benchmarked across all 12 UK regions." },
              { icon: LineChart, title: "Investor metrics", desc: "GDV, ROI, yield and uplift modelled instantly." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
