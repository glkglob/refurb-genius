import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { EmptyState } from "@/components/EmptyState";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mockRecentAnalyses } from "@/core/reports";
import { projectStore, estimatedRefurbCost } from "@/core/projects";
import { runRoiEngine } from "@/core/roi";
import { useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2,
  PoundSterling,
  TrendingUp,
  FolderPlus,
  ArrowRight,
  Sparkles,
  MapPin,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Refurb Genius" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const projects = useSyncExternalStore(
    projectStore.subscribe,
    () => projectStore.list(),
    () => projectStore.list(),
  );
  const totalRefurb = projects.reduce((s, p) => s + estimatedRefurbCost(p), 0);
  const totalProfit = projects.reduce((s, p) => {
    const roi = runRoiEngine({
      purchase_price: p.purchase_price,
      refurb_budget: estimatedRefurbCost(p),
      estimated_gdv: p.estimated_gdv,
      rental_income: 0,
      holding_costs: 0,
      region: p.region,
      property_condition: "Dated",
    });
    return s + roi.estimated_profit;
  }, 0);
  const firstName = (user?.fullName ?? user?.email ?? "there").split(/[\s@]/)[0];

  return (
    <AppLayout
      title={`Welcome back, ${firstName}`}
      subtitle="Your refurbishment portfolio at a glance."
      actions={
        <Button asChild>
          <Link to="/projects/new">
            <FolderPlus className="h-4 w-4" /> New project
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total projects"
          value={String(projects.length)}
          icon={Building2}
          hint="Across your portfolio"
        />
        <MetricCard
          label="Total refurb value"
          value={`£${totalRefurb.toLocaleString()}`}
          icon={PoundSterling}
          hint="Forecast spend"
        />
        <MetricCard
          label="Estimated profit"
          value={`£${totalProfit.toLocaleString()}`}
          icon={TrendingUp}
          tone="accent"
          hint="Projected uplift minus refurb"
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent projects</h2>
            <Link to="/projects/new" className="text-sm font-medium text-accent hover:underline">
              Create new
            </Link>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No projects yet"
              description="Create your first refurbishment project to start analysing."
              action={
                <Button asChild>
                  <Link to="/projects/new">
                    <FolderPlus className="h-4 w-4" /> New project
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent AI analyses</h2>
          </div>
          {mockRecentAnalyses.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No analyses yet"
              description="Upload property photos to run your first AI analysis."
            />
          ) : (
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {mockRecentAnalyses.map((a) => (
                  <Link
                    key={a.id}
                    to="/projects/$id/analysis"
                    params={{ id: a.projectId }}
                    className="flex gap-3 p-4 transition-colors hover:bg-secondary/60"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {a.projectName}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground">{a.when}</span>
                      </div>
                      <p className="text-xs font-medium text-accent">{a.room}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {a.summary}
                      </p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
