import { createFileRoute, Link, Navigate, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { AnalysisCard } from "@/components/AnalysisCard";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Sparkles, ArrowRight, AlertCircle, RefreshCw, Camera } from "lucide-react";
import { toast } from "sonner";
import {
  getPhotoAnalysis,
  loadPhotoAnalysis,
  runPhotoAnalysis,
  retryWeakPhotoAnalyses,
  groupAnalysesByRoom,
  countNeedingReview,
  isProductionValidAnalysisSet,
  isStaleAnalysisRelativeToCatalogue,
  catalogueIdentityFingerprint,
  usePhotos,
  type RoomAnalysis,
} from "@/features/ai-upload";
import { DISCLAIMER } from "@/core/reports";
import { useProject } from "@/hooks/useProjects";
import {
  useSetProjectStage,
  ProjectWorkflowShell,
  progressFromProjectFlags,
  analysisShellFlagsFromCurrency,
  buildPhotosAnalysisWorkflowState,
  resolveProjectNextAction,
} from "@/features/projects";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/_authed/projects/$id/analysis")({
  head: () => ({ meta: [{ title: "AI analysis — Refurb Genius" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    // Compatibility: historical Redesign focus — see beforeLoad redirect.
    focus: search.focus === "redesign" ? ("redesign" as const) : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    // IA-4: converge transitional Analysis?focus=redesign → first-class Redesign.
    if (search.focus === "redesign") {
      throw redirect({
        to: "/projects/$id/redesign",
        params: { id: params.id },
      });
    }
  },
  component: AnalysisPage,
});

type AnalysisUiState = "loading" | "ready" | "no_photos" | "stale_mock" | "error";

function toCatalogue(photos: Array<{ id: string; url: string; name: string }>) {
  return photos.map((p) => ({ id: p.id, url: p.url, name: p.name }));
}

function AnalysisPage() {
  const { id } = Route.useParams();
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(id);
  const { data: projectPhotos, isLoading: photosLoading } = usePhotos(id);
  const setStage = useSetProjectStage();
  const [uiState, setUiState] = useState<AnalysisUiState>("loading");
  const [retrying, setRetrying] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [results, setResults] = useState<RoomAnalysis[]>([]);

  const catalogue = useMemo(() => toCatalogue(projectPhotos ?? []), [projectPhotos]);
  const catalogueFingerprint = useMemo(() => catalogueIdentityFingerprint(catalogue), [catalogue]);
  const photoCount = catalogue.length;
  const roomGroups = useMemo(() => groupAnalysesByRoom(results), [results]);
  const needsReviewCount = useMemo(() => countNeedingReview(results), [results]);
  const analysisIsValid = useMemo(
    () => isProductionValidAnalysisSet(results, catalogue),
    [results, catalogue],
  );

  // IA-3: Photos/Analysis currency → IA-2 resolver (no second next-action algorithm).
  const analysisWorkflow = useMemo(
    () =>
      buildPhotosAnalysisWorkflowState({
        photos: catalogue.map((p) => ({ id: p.id })),
        analyses: results.map((r) => ({ photoId: r.photo_id, source: r.source })),
        analysisOperationRunning: analysing || uiState === "loading",
      }),
    [catalogue, results, analysing, uiState],
  );
  const analysisNextAction = useMemo(
    () => resolveProjectNextAction({ projectId: id, workflow: analysisWorkflow }),
    [id, analysisWorkflow],
  );
  // IA-3-R1: shell Analysis status follows currency — not fallback/quality review.
  const analysisShellFlags = useMemo(
    () => analysisShellFlagsFromCurrency(analysisWorkflow.analysis.currency),
    [analysisWorkflow.analysis.currency],
  );

  const afterValidAnalysis = useCallback(
    (r: RoomAnalysis[]) => {
      // Durable success only: never set analysis_done from invalid authority.
      if (!isProductionValidAnalysisSet(r, catalogue)) {
        // Keep rows as non-current evidence for shell Needs attention + update_analysis
        // (IA-3-R1). UI still uses stale_mock presentation, not ready cards.
        setResults(catalogue.length === 0 ? [] : r);
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
      // IA-4: Redesign generation/selection lives on /projects/$id/redesign only.
    },
    [catalogue, id, setStage],
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

  useEffect(() => {
    let cancelled = false;

    if (!project || photosLoading) {
      return () => {
        cancelled = true;
      };
    }

    setResults([]);
    setUiState("loading");

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
          // Keep rows so adapter currency stays non_current (IA-3-R1 shell Needs attention).
          setResults(persisted);
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
        setResults(fresh);
        setUiState("stale_mock");
        return;
      }
      setResults(fresh);
      setUiState("ready");
      setStage.mutate({ id, stage: "analysis", value: true });

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
  const workflowRoute = { surface: "analysis" } as const;

  const shellProgress = {
    ...progressFromProjectFlags(project),
    photoCount,
    // IA-3-R1: Complete only when current; Needs attention only when non_current.
    // Fallback / low-confidence remain advisory in-page — never shell stage status.
    analysisDone: analysisShellFlags.analysisDone,
    analysisNeedsAttention: analysisShellFlags.analysisNeedsAttention,
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
              {analysing
                ? "Analysing…"
                : analysisNextAction.actionKind === "update_analysis" ||
                    analysisNextAction.actionKind === "analyse_photos"
                  ? analysisNextAction.label
                  : "Analyse uploaded photos"}
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
        {analysisIsValid &&
        (analysisNextAction.actionKind === "create_redesign" ||
          analysisNextAction.actionKind === "select_redesign" ||
          analysisNextAction.actionKind === "update_redesign") ? (
          <>
            {/*
                IA-4: primary continuation → first-class Redesign route.
                Never skip to Estimate as canonical Analysis continuation.
              */}
            <Button asChild>
              <Link to="/projects/$id/redesign" params={{ id }}>
                {analysisNextAction.label}
                <ArrowRight className="ml-1 h-4 w-4" />
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
          <Card className="mt-8 border-dashed">
            <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-semibold text-foreground">Continue to Redesign</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate and select a refurbishment concept on the Redesign stage before Estimate.
                </p>
              </div>
              <Button asChild size="lg">
                <Link to="/projects/$id/redesign" params={{ id }}>
                  Open Redesign <ArrowRight className="ml-1 h-4 w-4" />
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
