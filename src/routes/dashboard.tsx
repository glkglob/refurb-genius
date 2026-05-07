import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mockProjects, mockRecentAnalyses } from "@/lib/mockData";
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
  const projects = mockProjects;
  const totalRefurb = projects.reduce((s, p) => s + p.estimate, 0);
  const totalProfit = projects.reduce((s, p) => s + (p.uplift - p.estimate), 0);
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
                <Link key={p.id} to="/projects/$id" params={{ id: p.id }} className="group">
                  <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                    <div className="h-28 bg-gradient-to-br from-primary to-accent" />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-foreground group-hover:text-accent">
                          {p.name}
                        </h3>
                        <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                          {p.status}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {p.region}
                      </p>
                      <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          £{p.estimate.toLocaleString()} refurb
                        </span>
                        <span className="flex items-center gap-1 font-medium text-accent">
                          Open <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
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
