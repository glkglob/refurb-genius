import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { LoadingState } from "@/components/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  projectStore,
  calculateProjectProgress,
  estimatedRefurbCost,
  estimatedProfit,
  type ProjectStage,
} from "@/core/projects";
import {
  Camera,
  Sparkles,
  Calculator,
  FileText,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Circle,
  Bed,
  Bath,
  Ruler,
  Home,
} from "lucide-react";
import { useSyncExternalStore } from "react";

export const Route = createFileRoute("/projects/$id/")({
  head: () => ({ meta: [{ title: "Project — Refurb Genius" }] }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const snapshot = useSyncExternalStore(
    projectStore.subscribe,
    projectStore.getSnapshot,
    projectStore.getSnapshot,
  );
  const project = snapshot.projects.find((p) => p.id === id);

  if (snapshot.loading || !snapshot.loaded) {
    return (
      <AppLayout title="Project" subtitle="Loading project details…">
        <LoadingState label="Loading project…" />
      </AppLayout>
    );
  }

  if (!project) return <Navigate to="/dashboard" />;

  const progress = calculateProjectProgress(id);

  const workflow: { stage: ProjectStage; to: typeof workflowRoutes[number]; label: string; desc: string; icon: typeof Camera }[] = [
    { stage: "photos", to: "/projects/$id/upload", label: "Upload Photos", desc: "Add property photos for AI analysis.", icon: Camera },
    { stage: "analysis", to: "/projects/$id/analysis", label: "AI Analysis", desc: "Room-by-room condition & redesigns.", icon: Sparkles },
    { stage: "estimate", to: "/projects/$id/estimate", label: "Estimate", desc: "Detailed regional refurb estimate.", icon: Calculator },
    { stage: "report", to: "/projects/$id/report", label: "Report", desc: "Investor-ready report and metrics.", icon: FileText },
  ];

  const status: { stage: ProjectStage; label: string }[] = [
    { stage: "photos", label: "Photos uploaded" },
    { stage: "analysis", label: "Analysis ready" },
    { stage: "estimate", label: "Estimate ready" },
    { stage: "report", label: "Report ready" },
  ];

  const nextStage = workflow.find((w) => !progress[w.stage]) ?? workflow[workflow.length - 1];

  return (
    <AppLayout
      title={project.name}
      subtitle={`${project.address} · ${project.postcode}`}
      actions={
        <Button asChild>
          <Link to={nextStage.to} params={{ id }}>
            Continue: {nextStage.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      }
    >
      {/* Property summary */}
      <Card className="mb-6">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Address" value={project.address} icon={MapPin} />
          <Detail label="Postcode" value={project.postcode} />
          <Detail label="Region" value={project.region} />
          <Detail label="Property type" value={project.property_type} icon={Home} />
          <Detail label="Bedrooms" value={String(project.bedrooms)} icon={Bed} />
          <Detail label="Bathrooms" value={String(project.bathrooms)} icon={Bath} />
          <Detail label="Size" value={`${project.size_sqm} m²`} icon={Ruler} />
          <Detail label="Status" value={project.status} />
          <Detail label="Created" value={new Date(project.created_at).toLocaleDateString("en-GB")} />
        </CardContent>
      </Card>

      {/* Money */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Money label="Purchase price" value={project.purchase_price} />
        <Money label="Estimated refurb" value={estimatedRefurbCost(project)} />
        <Money label="Estimated GDV" value={project.estimated_gdv} accent />
        <Money label="Estimated profit" value={estimatedProfit(project)} />
      </div>

      {project.notes && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-foreground">{project.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Workflow */}
      <h2 className="mb-3 text-lg font-semibold text-foreground">Workflow</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {workflow.map((w) => {
          const done = progress[w.stage];
          const isNext = w === nextStage && !done;
          return (
            <Link key={w.stage} to={w.to} params={{ id }}>
              <Card
                className={`h-full transition-shadow hover:shadow-md ${
                  isNext ? "border-accent ring-1 ring-accent/40" : ""
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <w.icon className="h-5 w-5" />
                    </div>
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground">{w.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{w.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Status checklist */}
      <h2 className="mb-3 text-lg font-semibold text-foreground">Project status</h2>
      <Card>
        <CardContent className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {status.map((s) => {
            const done = progress[s.stage];
            return (
              <div
                key={s.stage}
                className={`flex items-center gap-2.5 rounded-lg border p-3 text-sm ${
                  done ? "border-accent/30 bg-accent/5 text-foreground" : "border-border bg-secondary/30 text-muted-foreground"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                <span className="font-medium">{s.label}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </AppLayout>
  );
}

const workflowRoutes = [
  "/projects/$id/upload",
  "/projects/$id/analysis",
  "/projects/$id/estimate",
  "/projects/$id/report",
] as const;

function Detail({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof MapPin }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {value}
      </p>
    </div>
  );
}

function Money({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-2 text-2xl font-semibold tracking-tight ${accent ? "text-accent" : "text-foreground"}`}>
          £{value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}
