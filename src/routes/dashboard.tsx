import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mockProjects } from "@/lib/mockData";
import { Building2, PoundSterling, TrendingUp, FolderPlus, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Refurb Genius" }] }),
  component: Dashboard,
});

function Dashboard() {
  const totalEstimate = mockProjects.reduce((s, p) => s + p.estimate, 0);
  const totalUplift = mockProjects.reduce((s, p) => s + p.uplift, 0);

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Overview of your active refurbishment projects."
      actions={
        <Button asChild>
          <Link to="/projects/new"><FolderPlus className="h-4 w-4" /> New project</Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Active projects" value={String(mockProjects.length)} icon={Building2} />
        <MetricCard label="Forecast refurb spend" value={`£${totalEstimate.toLocaleString()}`} icon={PoundSterling} />
        <MetricCard label="Projected uplift" value={`£${totalUplift.toLocaleString()}`} icon={TrendingUp} tone="accent" />
      </div>

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Projects</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockProjects.map((p) => (
            <Card key={p.id} className="overflow-hidden transition-shadow hover:shadow-md">
              <div className="h-32 bg-gradient-to-br from-primary to-accent" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.address}</p>
                  </div>
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    {p.status}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">£{p.estimate.toLocaleString()}</span>
                  <Link
                    to="/projects/$id"
                    params={{ id: p.id }}
                    className="flex items-center gap-1 font-medium text-accent hover:underline"
                  >
                    Open <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
