import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { AnalysisCard } from "@/components/AnalysisCard";
import { RedesignCard } from "@/components/RedesignCard";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Sparkles, ArrowRight, AlertCircle, RefreshCw, Camera } from "lucide-react";
import { toast } from "sonner";
import {
  getPhotoAnalysis,
  loadPhotoAnalysis,
  runPhotoAnalysis,
  retryWeakPhotoAnalyses,
  groupAnalysesByRoom,
  hasFallbackResults,
  countNeedingReview,
  isProductionValidAnalysisSet,
  isStaleAnalysisRelativeToCatalogue,
  catalogueIdentityFingerprint,
  usePhotos,
  type RoomAnalysis,
} from "@/features/ai-upload";
import {
  generateRedesignConcepts,
  clearRedesignConceptsCache,
  type RedesignConcept,
  REDESIGN_CONCEPTS,
} from "@/features/ai-design";
import { DISCLAIMER } from "@/core/reports";
import { useProject } from "@/hooks/useProjects";
import {
  useSetProjectStage,
  ProjectWorkflowShell,
  progressFromProjectFlags,
} from "@/features/projects";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/_authed/projects/$id/analysis")({
  head: () => ({ meta: [{ title: "AI analysis — Refurb Genius" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    // Transitional Redesign focus until IA-4 first-class route (no /redesign path).
    focus: search.focus === "redesign" ? ("redesign" as const) : undefined,
  }),
  component: AnalysisPage,
});

type AnalysisUiState = "loading" | "ready" | "no_photos" | "stale_mock" | "error";

function toCatalogue(photos: Array<{ id: string; url: string; name: string }>) {
  return photos.map((p) => ({ id: p.id, url: p.url, name: p.name }));
}

function AnalysisPage() {
  const { id } = Route.useParams();
  const { focus } = Route.useSearch();
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(id);
  const { data: projectPhotos, isLoading: photosLoading } = usePhotos(id);
  const setStage = useSetProjectStage();
  const [uiState, setUiState] = useState<AnalysisUiState>("loading");
  const [retrying, setRetrying] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [results, setResults] = useState<RoomAnalysis[]>([]);
  const [concepts, setConcepts] = useState<RedesignConcept[]>(REDESIGN_CONCEPTS);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [redesignError, setRedesignError] = useState<string | null>(null);

  const catalogue = useMemo(() => toCatalogue(projectPhotos ?? []), [projectPhotos]);
  const catalogueFingerprint = useMemo(() => catalogueIdentityFingerprint(catalogue), [catalogue]);
  const photoCount = catalogue.length;
  const roomGroups = useMemo(() => groupAnalysesByRoom(results), [results]);
  const needsReviewCount = useMemo(() => countNeedingReview(results), [results]);
  const analysisIsValid = useMemo(
    () => isProductionValidAnalysisSet(results, catalogue),
    [results, catalogue],
  );

  const loadRedesign = useCallback((projectId: string) => {
    setConceptsLoading(true);
    setRedesignError(null);
    generateRedesignConcepts({ projectId })
      .then((generated) => {
        setConcepts(generated);
        setConceptsLoading(false);
      })
      .catch((err) => {
        setConceptsLoading(false);
        const msg = err instanceof Error ? err.message : "Could not generate redesign concepts.";
        setRedesignError(msg);
        toast.error("Redesign concepts unavailable", {
          description: "Using default suggestions. You can retry later.",
        });
      });
  }, []);

  const afterValidAnalysis = useCallback(
    (r: RoomAnalysis[]) => {
      // Durable success only: never set analysis_done / redesign from invalid authority.
      if (!isProductionValidAnalysisSet(r, catalogue)) {
        setResults([]);
        setAnalysing(false);
        setUiState(catalogue.length === 0 ? "no_photos" : "stale_mock");
        return;
      }
      setResults(r);
      setUiState("ready");
      setAnalysing(false);
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

      loadRedesign(id);
    },
    [catalogue, id, loadRedesign, setStage],
  );

  const runFreshAnalysis = useCallback(async () => {
    if (photoCount < 1) {
      setUiState("no_photos");
      setResults([]);
      return;
    }
    setAnalysing(true);
    setUiState("loading");
    trackEvent("ai_analysis_started", { projectId: id });
    try {
      const r = await runPhotoAnalysis({ projectId: id });
      afterValidAnalysis(r);
    } catch (err: unknown) {
      setAnalysing(false);
      setUiState(photoCount < 1 ? "no_photos" : "error");
      toast.error(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    }
  }, [afterValidAnalysis, id, photoCount]);

  // IA-1 transitional Redesign focus: scroll to embedded redesign without a /redesign route.
  useEffect(() => {
    if (focus !== "redesign" || uiState !== "ready") return;
    const el = document.getElementById("project-redesign");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focus, uiState]);

  useEffect(() => {
    let cancelled = false;

    if (!project || photosLoading) {
      return () => {
        cancelled = true;
      };
    }

    setResults([]);
    setUiState("loading");
    setConcepts(REDESIGN_CONCEPTS);

    // Gate: no photos → no analysis, no analysis_done, no redesign generation.
    if (catalogue.length === 0) {
      setUiState("no_photos");
      setResults([]);
      return () => {
        cancelled = true;
      };
    }

    const resolve = async () => {
      const cached = getPhotoAnalysis(id);
      if (cached?.length && isProductionValidAnalysisSet(cached, catalogue)) {
        if (!cancelled) afterValidAnalysis(cached);
        return;
      }

      try {
        const persisted = await loadPhotoAnalysis(id);
        if (cancelled) return;

        if (persisted?.length && isProductionValidAnalysisSet(persisted, catalogue)) {
          afterValidAnalysis(persisted);
          return;
        }

        if (persisted?.length && isStaleAnalysisRelativeToCatalogue(persisted, catalogue)) {
          // Do not present mock/stale rows as completed AI work.
          // Do not mark analysis_done. Do not generate redesign from mocks.
          setResults([]);
          setUiState("stale_mock");
          return;
        }

        // No valid persisted analysis and photos exist → run real analysis.
        trackEvent("ai_analysis_started", { projectId: id });
        const r = await runPhotoAnalysis({ projectId: id });
        if (cancelled) return;
        afterValidAnalysis(r);
      } catch (err: unknown) {
        if (cancelled) return;
        setUiState("error");
        toast.error(
          err instanceof Error ? err.message : "Failed to load analysis. Please try again.",
        );
      }
    };

    void resolve();

    return () => {
      cancelled = true;
    };
    // Fingerprint (not length) so same-count photo replacement invalidates authority.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, project?.id, photosLoading, catalogueFingerprint]);

  const handleRetryWeak = async () => {
    setRetrying(true);
    trackEvent("analysis_retry", {
      projectId: id,
      retry_count: needsReviewCount,
    });
    try {
      const fresh = await retryWeakPhotoAnalyses({ projectId: id });
      if (!isProductionValidAnalysisSet(fresh, catalogue)) {
        setResults([]);
        setUiState("stale_mock");
        return;
      }
      setResults(fresh);
      setUiState("ready");
      setStage.mutate({ id, stage: "analysis", value: true });

      clearRedesignConceptsCache(id);
      setConceptsLoading(true);
      setRedesignError(null);
      try {
        const regenerated = await generateRedesignConcepts({ projectId: id });
        setConcepts(regenerated);
      } catch (regenErr) {
        const msg =
          regenErr instanceof Error ? regenErr.message : "Could not regenerate redesign concepts.";
        setRedesignError(msg);
        toast.error("Redesign concepts unavailable", {
          description: "Analyses were updated. Redesign suggestions may be stale until retry.",
        });
      } finally {
        setConceptsLoading(false);
      }

      const stillNeedReview = countNeedingReview(fresh);
      if (stillNeedReview > 0) {
        trackEvent("analysis_fallback", {
          projectId: id,
          fallback_count: stillNeedReview,
          total: fresh.length,
        });
        toast.message("Re-analysis finished", {
          description: `${stillNeedReview} photo${stillNeedReview === 1 ? "" : "s"} still need review.`,
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

  // Project load failure: no durable project identity → keep bare layout (cannot invent shell).
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

  // Initial project fetch with no cached identity yet.
  if ((projectLoading || photosLoading) && !project) {
    return (
      <AppLayout title="AI analysis" subtitle="Loading project details…">
        <LoadingState label="Loading project…" />
      </AppLayout>
    );
  }

  if (!project) return <Navigate to="/dashboard" />;

  // IA-1-R1: every project-aware Analysis state keeps the shared workflow shell.
  const workflowRoute =
    focus === "redesign"
      ? ({ surface: "analysis", focus: "redesign" } as const)
      : ({ surface: "analysis" } as const);

  const shellProgress = {
    ...progressFromProjectFlags(project),
    photoCount,
    analysisDone: analysisIsValid || project.analysis_done,
    analysisNeedsAttention:
      uiState === "ready"
        ? hasFallbackResults(results) || needsReviewCount > 0
        : Boolean(project.analysis_done && (uiState === "stale_mock" || uiState === "error")),
  };

  const analysisShell = (opts: {
    pageSubtitle: string;
    actions?: ReactNode;
    children: ReactNode;
  }) => (
    <ProjectWorkflowShell
      project={project}
      route={workflowRoute}
      progress={shellProgress}
      pageTitle={project.name?.trim() || "Analysis"}
      pageSubtitle={opts.pageSubtitle}
      actions={opts.actions}
    >
      {opts.children}
    </ProjectWorkflowShell>
  );

  if (projectLoading || photosLoading) {
    return analysisShell({
      pageSubtitle: "Loading project details…",
      children: <LoadingState label="Loading project…" />,
    });
  }

  if (uiState === "no_photos") {
    return analysisShell({
      pageSubtitle: "Upload photos before analysis",
      children: (
        <EmptyState
          icon={Camera}
          title="NO PHOTOS TO ANALYSE"
          description="Upload at least one project photo before running AI analysis. Analysis never uses demo or bundled images."
          action={
            <Button asChild>
              <Link to="/projects/$id/upload" params={{ id }}>
                Upload project photos
              </Link>
            </Button>
          }
        />
      ),
    });
  }

  if (uiState === "stale_mock") {
    return analysisShell({
      pageSubtitle: "Re-analysis required",
      children: (
        <EmptyState
          icon={AlertCircle}
          title="Previous analysis was not based on the current project photos"
          description="Run analysis again to use your uploaded photos. Demo or mock results are not treated as completed AI work."
          action={
            <Button onClick={() => void runFreshAnalysis()} disabled={analysing || retrying}>
              <Sparkles className="mr-1 h-4 w-4" />
              {analysing ? "Analysing…" : "Analyse uploaded photos"}
            </Button>
          }
        />
      ),
    });
  }

  if (uiState === "loading" || analysing) {
    return analysisShell({
      pageSubtitle: "Analysing your photos…",
      children: <LoadingState label="Running photo analysis on your photos…" />,
    });
  }

  if (uiState === "error" && results.length === 0) {
    return analysisShell({
      pageSubtitle: "Analysis unavailable",
      children: (
        <EmptyState
          icon={AlertCircle}
          title="Analysis failed"
          description="We could not complete photo analysis. Check your photos and try again."
          action={
            <Button onClick={() => void runFreshAnalysis()} disabled={analysing}>
              Analyse uploaded photos
            </Button>
          }
        />
      ),
    });
  }

  return analysisShell({
    pageSubtitle: "Room-by-room condition assessment with recommended works.",
    actions: (
      <div className="flex flex-wrap gap-2">
        {needsReviewCount > 0 && analysisIsValid ? (
          <Button variant="outline" onClick={() => void handleRetryWeak()} disabled={retrying}>
            <RefreshCw className={`mr-1 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            Re-analyse weak photos
          </Button>
        ) : null}
        {analysisIsValid ? (
          <>
            {/*
                IA-1 transitional: do not establish permanent Analysis → Estimate.
                Redesign remains stage 3; first-class /redesign is IA-4.
                Primary continuation surfaces Redesign (embedded here).
              */}
            <Button asChild>
              <Link to="/projects/$id/analysis" params={{ id }} search={{ focus: "redesign" }}>
                Continue to Redesign <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/projects/$id/estimate" params={{ id }} search={{ from: undefined }}>
                Estimate
              </Link>
            </Button>
          </>
        ) : null}
      </div>
    ),
    children: (
      <>
        {needsReviewCount > 0 ? (
          <div className="mb-5 flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">
                {needsReviewCount} photo{needsReviewCount === 1 ? "" : "s"} need human review
              </p>
              <p className="mt-0.5 text-xs opacity-90">
                Low-confidence or fallback results are kept so you can still continue — re-analyse
                or edit before treating them as final scope.
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
            action={
              <Button onClick={() => void runFreshAnalysis()} disabled={analysing}>
                Analyse uploaded photos
              </Button>
            }
          />
        ) : null}

        {analysisIsValid ? (
          <div id="project-redesign" className="mt-12 scroll-mt-24">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  AI redesign concepts
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Six visual directions generated from your hero photo. Pick the one that matches
                  your buyer or tenant.
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
        ) : null}

        {analysisIsValid ? (
          <Card className="mt-8 border-dashed">
            <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Ready for cost estimate?
                </h3>
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
        ) : null}

        <p className="mt-6 text-xs text-muted-foreground">{DISCLAIMER}</p>
      </>
    ),
  });
}
