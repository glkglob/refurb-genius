import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { AnalysisCard } from "@/components/AnalysisCard";
import { RedesignCard } from "@/components/RedesignCard";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Sparkles, ArrowRight, AlertCircle } from "lucide-react";
import { analysisStore, type RoomAnalysis, generateRedesignConcepts } from "@/core/ai";
import type { RedesignConcept } from "@/core/ai";
import { projectStore } from "@/core/projects";
import { DISCLAIMER } from "@/core/reports";
import { REDESIGN_CONCEPTS } from "@/core/ai";

export const Route = createFileRoute("/projects/$id/analysis")({
  head: () => ({ meta: [{ title: "AI analysis — Refurb Genius" }] }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const { id } = Route.useParams();
  const snapshot = useSyncExternalStore(
    projectStore.subscribe,
    projectStore.getSnapshot,
    projectStore.getSnapshot,
  );
  const project = snapshot.projects.find((p) => p.id === id);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<RoomAnalysis[]>([]);
  const [concepts, setConcepts] = useState<RedesignConcept[]>(REDESIGN_CONCEPTS);
  const [conceptsLoading, setConceptsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!project) {
      return () => {
        cancelled = true;
      };
    }

    setResults([]);
    setLoading(true);
    setConcepts(REDESIGN_CONCEPTS);

    const cached = analysisStore.get(id);

    const afterAnalysis = (r: RoomAnalysis[]) => {
      if (cancelled) return;
      setResults(r);
      setLoading(false);
      projectStore.setStage(id, "analysis", true);

      // Kick off redesign concept generation (real AI when key present).
      if (import.meta.env.VITE_OPENAI_API_KEY) {
        setConceptsLoading(true);
        generateRedesignConcepts({ projectId: id }).then((generated) => {
          if (cancelled) return;
          setConcepts(generated);
          setConceptsLoading(false);
        }).catch(() => {
          if (!cancelled) setConceptsLoading(false);
        });
      }
    };

    if (cached?.length) {
      afterAnalysis(cached);
      return () => {
        cancelled = true;
      };
    }

    analysisStore.run(id).then(afterAnalysis);

    return () => {
      cancelled = true;
    };
  }, [id, project]);

  if (snapshot.loading || !snapshot.loaded) {
    return (
      <AppLayout title="AI analysis" subtitle="Loading project details…">
        <LoadingState label="Loading project…" />
      </AppLayout>
    );
  }

  if (snapshot.error) {
    return (
      <AppLayout title="AI analysis" subtitle="Failed to load project">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load project"
          description="We couldn't load this project. Please try again or contact support if the problem persists."
          action={<Button onClick={() => projectStore.refresh()}>Try again</Button>}
        />
      </AppLayout>
    );
  }

  if (!project) return <Navigate to="/dashboard" />;

  if (loading) {
    return (
      <AppLayout title="AI analysis" subtitle="Analysing your photos…">
        <LoadingState label={import.meta.env.VITE_OPENAI_API_KEY ? "Running AI analysis on your photos…" : "Running mock AI analysis on your photos"} />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="AI analysis"
      subtitle="Room-by-room condition assessment with recommended works."
      actions={
        <Button asChild>
          <Link to="/projects/$id/estimate" params={{ id }}>
            Continue to estimate <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        {results.map((r) => (
          <AnalysisCard key={r.id} analysis={r} />
        ))}
      </div>

      <div className="mt-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              AI redesign concepts
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Six visual directions generated from your hero photo. Pick the one that matches your
              buyer or tenant.
            </p>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex">
            <Sparkles className="mr-1 h-3 w-3 text-accent" />
            {conceptsLoading ? "Generating…" : "Concept previews"}
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {concepts.map((c) => (
            <RedesignCard key={c.style} concept={c} beforePhotoUrl={results[0]?.photo_url} />
          ))}
        </div>
      </div>

      <Card className="mt-8 border-dashed">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-foreground">Ready for cost estimate?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a UK refurbishment cost estimate based on this analysis.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/projects/$id/estimate" params={{ id }}>
              View estimate <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">{DISCLAIMER}</p>
    </AppLayout>
  );
}
