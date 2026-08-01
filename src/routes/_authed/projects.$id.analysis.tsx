import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { AnalysisCard } from "@/components/AnalysisCard";
import { RedesignCard } from "@/components/RedesignCard";
import { PipelineChecklist } from "@/components/PipelineChecklist";
import { buildProjectPipelineSteps } from "@/components/pipeline-checklist";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  getPhotoAnalysis,
  loadPhotoAnalysis,
  runPhotoAnalysis,
  groupAnalysesByRoom,
  hasFallbackResults,
  isRetryableAnalysis,
  needsHumanReview,
  type RoomAnalysis,
} from "@/features/ai-upload";
import {
  generateRedesignConcepts,
  type RedesignConcept,
  REDESIGN_CONCEPTS,
} from "@/features/ai-design";
import { DISCLAIMER } from "@/core/reports";
import { useProject } from "@/hooks/useProjects";
import { useSetProjectStage } from "@/features/projects";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/_authed/projects/$id/analysis")({
  head: () => ({ meta: [{ title: "AI analysis — Refurb Genius" }] }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const { id } = Route.useParams();
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(id);
  const setStage = useSetProjectStage();
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [results, setResults] = useState<RoomAnalysis[]>([]);
  const [concepts, setConcepts] = useState<RedesignConcept[]>(REDESIGN_CONCEPTS);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [redesignError, setRedesignError] = useState<string | null>(null);

  const roomGroups = useMemo(() => groupAnalysesByRoom(results), [results]);
  const fallbackCount = useMemo(
    () => results.filter((r) => r.source === "fallback" || isRetryableAnalysis(r)).length,
    [results],
  );
  const needsReviewCount = useMemo(
    () => results.filter((r) => needsHumanReview(r)).length,
    [results],
  );

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

    const afterAnalysis = (r: RoomAnalysis[]) => {
      if (cancelled) return;
      setResults(r);
      setLoading(false);
      setStage.mutate({ id, stage: "analysis", value: true });
      trackEvent("ai_analysis_completed", { room_count: r.length });

      const fallbacks = r.filter((a) => a.source === "fallback").length;
      if (fallbacks > 0) {
        trackEvent("analysis_fallback", {
          projectId: id,
          fallback_count: fallbacks,
          total: r.length,
        });
      }

      setConceptsLoading(true);
      setRedesignError(null);
      generateRedesignConcepts({ projectId: id })
        .then((generated) => {
          if (cancelled) return;
          setConcepts(generated);
          setConceptsLoading(false);
        })
        .catch((err) => {
          if (!cancelled) {
            setConceptsLoading(false);
            const msg =
              err instanceof Error ? err.message : "Could not generate redesign concepts.";
            setRedesignError(msg);
            toast.error("Redesign concepts unavailable", {
              description: "Using default suggestions. You can retry later.",
            });
          }
        });
    };

    const cached = getPhotoAnalysis(id);
    if (cached?.length) {
      afterAnalysis(cached);
      return () => {
        cancelled = true;
      };
    }

    loadPhotoAnalysis(id)
      .then((persisted) => {
        if (cancelled) return;
        if (persisted?.length) {
          afterAnalysis(persisted);
          return;
        }
        trackEvent("ai_analysis_started", { projectId: id });
        return runPhotoAnalysis({ projectId: id })
          .then(afterAnalysis)
          .catch((err: unknown) => {
            if (cancelled) return;
            setLoading(false);
            toast.error(err instanceof Error ? err.message : "Analysis failed. Please try again.");
          });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        toast.error(
          err instanceof Error ? err.message : "Failed to load analysis. Please try again.",
        );
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, project?.id]);

  const handleRetryWeak = async () => {
    setRetrying(true);
    trackEvent("analysis_retry", {
      projectId: id,
      retry_count: fallbackCount,
    });
    try {
      const fresh = await runPhotoAnalysis({ projectId: id });
      setResults(fresh);
      setStage.mutate({ id, stage: "analysis", value: true });
      const stillWeak = fresh.filter((a) => a.source === "fallback").length;
      if (stillWeak > 0) {
        trackEvent("analysis_fallback", {
          projectId: id,
          fallback_count: stillWeak,
          total: fresh.length,
        });
        toast.message("Re-analysis finished", {
          description: `${stillWeak} photo${stillWeak === 1 ? "" : "s"} still need review.`,
        });
      } else {
        toast.success("Re-analysis complete.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-analysis failed.");
    } finally {
      setRetrying(false);
    }
  };

  if (projectLoading) {
    return (
      <AppLayout title="AI analysis" subtitle="Loading project details…">
        <LoadingState label="Loading project…" />
      </AppLayout>
    );
  }

  if (projectError) {
    return (
      <AppLayout title="AI analysis" subtitle="Failed to load project">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load project"
          description="We couldn't load this project. Please try again or contact support if the problem persists."
        />
      </AppLayout>
    );
  }

  if (!project) return <Navigate to="/dashboard" />;

  if (loading) {
    return (
      <AppLayout title="AI analysis" subtitle="Analysing your photos…">
        <LoadingState label="Running photo analysis on your photos…" />
      </AppLayout>
    );
  }

  const pipelineSteps = buildProjectPipelineSteps({
    photoCount: results.length,
    analysisComplete: results.length > 0,
    analysisHasFallback: hasFallbackResults(results),
    estimateComplete: project.estimate_done,
    current: "analyse",
  });

  return (
    <AppLayout
      title="AI analysis"
      subtitle="Room-by-room condition assessment with recommended works."
      actions={
        <div className="flex flex-wrap gap-2">
          {fallbackCount > 0 ? (
            <Button variant="outline" onClick={() => void handleRetryWeak()} disabled={retrying}>
              <RefreshCw className={`mr-1 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
              Re-analyse weak photos
            </Button>
          ) : null}
          <Button asChild>
            <Link to="/projects/$id/estimate" params={{ id }} search={{ from: undefined }}>
              Continue to estimate <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      }
    >
      <div className="mb-5">
        <PipelineChecklist steps={pipelineSteps} />
      </div>

      {needsReviewCount > 0 ? (
        <div className="mb-5 flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              {needsReviewCount} photo{needsReviewCount === 1 ? "" : "s"} need human review
            </p>
            <p className="mt-0.5 text-xs opacity-90">
              Low-confidence or fallback results are kept so you can still continue — re-analyse or
              edit before treating them as final scope.
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-10">
        {roomGroups.map((group) => (
          <section key={group.roomType}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {group.roomType}
              </h2>
              <Badge variant="secondary">
                {group.analyses.length} photo{group.analyses.length === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline">
                {Math.round(group.averageConfidence * 100)}% avg confidence
              </Badge>
              {group.needsReviewCount > 0 ? (
                <Badge variant="destructive">{group.needsReviewCount} need review</Badge>
              ) : null}
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {group.analyses.map((r) => (
                <AnalysisCard key={r.id} analysis={r} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No analysis yet"
          description="Upload photos first, then run AI analysis."
        />
      ) : null}

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

        {redesignError ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Redesign generation failed: {redesignError} (showing defaults)
          </div>
        ) : null}

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
              Generate a UK refurbishment cost estimate based on this analysis. AI suggestions
              pre-fill scope — they never silently overwrite your edits.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            onClick={() => trackEvent("estimate_generated", { projectId: id })}
          >
            <Link to="/projects/$id/estimate" params={{ id }} search={{ from: undefined }}>
              View estimate <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">{DISCLAIMER}</p>
    </AppLayout>
  );
}
