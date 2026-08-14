/**
 * IA-4 — First-class Redesign stage route: `/projects/$id/redesign`.
 *
 * Canonical generation + explicit selection authority. Does not embed
 * competing Redesign UI under Analysis.
 */
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { RedesignCard } from "@/components/RedesignCard";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, ArrowRight, Palette, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  getPhotoAnalysis,
  isProductionValidAnalysisSet,
  loadPhotoAnalysis,
  usePhotos,
  type RoomAnalysis,
} from "@/features/ai-upload";
import {
  generateRedesignConceptsForClient,
  listRedesignConceptsForClient,
  selectRedesignConceptForClient,
  type DurableRedesignConcept,
} from "@/features/ai-design";
import { DISCLAIMER } from "@/core/reports";
import { useProject } from "@/hooks/useProjects";
import {
  ProjectWorkflowShell,
  analysisShellFlagsFromCurrency,
  buildPhotosAnalysisWorkflowState,
  progressFromProjectFlags,
  redesignCurrencyFromEvidence,
  redesignShellFlagsFromCurrency,
  resolveProjectNextAction,
  withProjectWorkflowOperationRunning,
} from "@/features/projects";

export const Route = createFileRoute("/_authed/projects/$id/redesign")({
  head: () => ({ meta: [{ title: "Redesign — Refurb Genius" }] }),
  component: RedesignPage,
});

function RedesignPage() {
  const { id } = Route.useParams();
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(id);
  const { data: projectPhotos, isLoading: photosLoading } = usePhotos(id);

  const [analyses, setAnalyses] = useState<RoomAnalysis[]>([]);
  const [candidates, setCandidates] = useState<DurableRedesignConcept[]>([]);
  const [loadingAuthority, setLoadingAuthority] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catalogue = useMemo(
    () => (projectPhotos ?? []).map((p) => ({ id: p.id, url: p.url, name: p.name })),
    [projectPhotos],
  );
  const analysisIsValid = useMemo(
    () => isProductionValidAnalysisSet(analyses, catalogue),
    [analyses, catalogue],
  );
  const currentAnalysisIdentity = useMemo(
    () =>
      [...analyses]
        .map((a) => a.photo_id)
        .filter((pid): pid is string => Boolean(pid))
        .sort()
        .join("\u0001"),
    [analyses],
  );

  const photosAnalysisWorkflow = useMemo(
    () =>
      buildPhotosAnalysisWorkflowState({
        photos: catalogue.map((p) => ({ id: p.id })),
        analyses: analyses.map((a) => ({ photoId: a.photo_id, source: a.source })),
      }),
    [catalogue, analyses],
  );

  const redesignState = useMemo(
    () =>
      redesignCurrencyFromEvidence({
        analysisCurrency: photosAnalysisWorkflow.analysis.currency,
        currentAnalysisIdentity,
        candidates: candidates.map((c) => ({
          id: c.id,
          style: c.style,
          analysisIdentity: c.analysisIdentity,
          isSelected: c.isSelected,
        })),
        redesignOperationRunning: generating,
      }),
    [photosAnalysisWorkflow.analysis.currency, currentAnalysisIdentity, candidates, generating],
  );

  const workflow = useMemo(
    () => ({
      ...photosAnalysisWorkflow,
      redesign: redesignState,
    }),
    [photosAnalysisWorkflow, redesignState],
  );

  const nextAction = useMemo(
    () => resolveProjectNextAction({ projectId: id, workflow }),
    [id, workflow],
  );

  const analysisFlags = analysisShellFlagsFromCurrency(photosAnalysisWorkflow.analysis.currency);
  const redesignFlags = redesignShellFlagsFromCurrency(redesignState.currency);

  const heroUrl = analyses[0]?.photo_url ?? catalogue[0]?.url;

  const reload = useCallback(async () => {
    setLoadingAuthority(true);
    setError(null);
    try {
      // Prefer client cache from Analysis page, then durable load.
      const cached = getPhotoAnalysis(id);
      const [persisted, durable] = await Promise.all([
        loadPhotoAnalysis(id).catch(() => [] as RoomAnalysis[]),
        listRedesignConceptsForClient(id),
      ]);
      const preferred =
        cached && cached.length > 0 ? cached : persisted && persisted.length > 0 ? persisted : [];
      setAnalyses(preferred);
      setCandidates(durable);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Redesign.");
    } finally {
      setLoadingAuthority(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Re-evaluate once photos settle (catalogue needed for Analysis currentness).
  useEffect(() => {
    if (photosLoading || loadingAuthority) return;
    if (analyses.length === 0 && catalogue.length > 0) {
      void reload();
    }
  }, [photosLoading, catalogue.length, analyses.length, loadingAuthority, reload]);

  const handleGenerate = async () => {
    if (!analysisIsValid) {
      toast.error("Current Analysis is required before generating Redesign.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      // IA-6-R1: publish cross-route running for Dashboard/Overview view_stage_progress.
      const next = await withProjectWorkflowOperationRunning(id, "redesign", () =>
        generateRedesignConceptsForClient({ projectId: id }),
      );
      setCandidates(next);
      toast.success("Redesign concepts ready — select one to continue.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Redesign generation failed.";
      setError(msg);
      toast.error(msg);
      // Preserve prior selection by reloading durable rows
      try {
        const durable = await listRedesignConceptsForClient(id);
        setCandidates(durable);
      } catch {
        /* keep prior state */
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSelect = async (conceptId: string) => {
    setSelectingId(conceptId);
    try {
      const selected = await selectRedesignConceptForClient({
        projectId: id,
        conceptId,
      });
      setCandidates((prev) =>
        prev.map((c) => ({
          ...c,
          isSelected: c.id === selected.id,
        })),
      );
      toast.success(`${selected.style} selected as project Redesign.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save selection.");
    } finally {
      setSelectingId(null);
    }
  };

  if (projectError) {
    return (
      <AppLayout title="Redesign" subtitle="Failed to load project">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load project"
          description="We couldn't load this project. Please try again."
        />
      </AppLayout>
    );
  }

  if ((projectLoading || photosLoading) && !project) {
    return (
      <AppLayout title="Redesign" subtitle="Loading…">
        <LoadingState label="Loading project…" />
      </AppLayout>
    );
  }

  if (!project) return <Navigate to="/dashboard" />;

  const shellProgress = {
    ...progressFromProjectFlags(project),
    photoCount: catalogue.length,
    analysisDone: analysisFlags.analysisDone,
    analysisNeedsAttention: analysisFlags.analysisNeedsAttention,
    redesignDone: redesignFlags.redesignDone,
    redesignNeedsAttention: redesignFlags.redesignNeedsAttention,
  };

  const shell = (opts: {
    pageSubtitle: string;
    actions?: ReactNode;
    stickyNextAction?: {
      label: string;
      href?: string;
      onClick?: () => void;
      actionKind?: string;
      disabled?: boolean;
      loading?: boolean;
      variant?: "default" | "outline";
      testId?: string;
    } | null;
    children: ReactNode;
  }) => (
    <ProjectWorkflowShell
      project={project}
      route={{ surface: "redesign" }}
      progress={shellProgress}
      pageTitle={project.name?.trim() || "Redesign"}
      pageSubtitle={opts.pageSubtitle}
      actions={opts.actions}
      stickyNextAction={opts.stickyNextAction}
    >
      {opts.children}
    </ProjectWorkflowShell>
  );

  if (loadingAuthority || projectLoading || photosLoading) {
    return shell({
      pageSubtitle: "Loading redesign…",
      children: <LoadingState label="Loading redesign authority…" />,
    });
  }

  // A. Analysis unavailable / non-current
  if (!analysisIsValid || photosAnalysisWorkflow.analysis.currency !== "current") {
    const analysisLabel =
      photosAnalysisWorkflow.analysis.currency === "non_current"
        ? "Update Analysis"
        : "Go to Analysis";
    return shell({
      pageSubtitle: "Analysis required before Redesign",
      stickyNextAction: {
        label: analysisLabel,
        href: `/projects/${id}/analysis`,
        actionKind: "update_analysis",
        testId: "redesign-primary-cta-sticky",
      },
      children: (
        <EmptyState
          icon={AlertCircle}
          title="Current Analysis is required"
          description="Redesign only uses the current durable Analysis for this project's photos. Complete or update Analysis first."
          action={
            <Button asChild>
              <Link to="/projects/$id/analysis" params={{ id }} search={{ focus: undefined }}>
                {analysisLabel}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          }
        />
      ),
    });
  }

  const primaryLabel = nextAction.label;
  const primaryIsSelect = nextAction.actionKind === "select_redesign";
  const primaryIsCreate =
    nextAction.actionKind === "create_redesign" || nextAction.actionKind === "update_redesign";
  const primaryIsProgress = nextAction.actionKind === "view_stage_progress";

  const redesignSticky =
    primaryIsProgress || generating
      ? {
          label: generating ? "Generating concepts…" : primaryLabel,
          onClick: () => undefined,
          actionKind: nextAction.actionKind,
          disabled: true,
          loading: true,
          testId: "redesign-primary-cta-sticky",
        }
      : primaryIsCreate
        ? {
            label: primaryLabel,
            onClick: () => void handleGenerate(),
            actionKind: nextAction.actionKind,
            disabled: generating,
            loading: generating,
            testId: "redesign-primary-cta-sticky",
          }
        : primaryIsSelect
          ? {
              label: primaryLabel,
              // Selection is performed on-page; sticky points users to the rail.
              onClick: () => {
                document
                  .querySelector("[data-testid='project-stage-nav']")
                  ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              },
              actionKind: nextAction.actionKind,
              variant: "outline" as const,
              testId: "redesign-primary-cta-sticky",
            }
          : nextAction.route
            ? {
                label: primaryLabel,
                href: nextAction.route,
                actionKind: nextAction.actionKind,
                testId: "redesign-primary-cta-sticky",
              }
            : null;

  return shell({
    pageSubtitle:
      "Choose a refurbishment concept. Generated ideas are proposals until you select one.",
    stickyNextAction: redesignSticky,
    actions: (
      <div className="flex flex-wrap gap-2">
        {primaryIsProgress || generating ? (
          <Button disabled data-testid="redesign-generate" aria-busy="true">
            <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
            {generating ? "Generating concepts…" : primaryLabel}
          </Button>
        ) : primaryIsCreate ? (
          <Button
            onClick={() => void handleGenerate()}
            disabled={generating}
            data-testid="redesign-generate"
            aria-label={`${primaryLabel} — generate concepts from current Analysis`}
          >
            <Sparkles className="mr-1 h-4 w-4" />
            {primaryLabel}
          </Button>
        ) : null}
        {redesignState.currency === "current" ? (
          <Button asChild variant="outline">
            <Link to="/projects/$id/estimate" params={{ id }} search={{ from: undefined }}>
              Continue to Estimate
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    ),
    children: (
      <>
        {error ? (
          <div
            role="alert"
            className="mb-5 rounded-md border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100"
          >
            {error}
          </div>
        ) : null}

        {redesignState.currency === "non_current" ? (
          <div
            role="status"
            className="mb-5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
          >
            <p className="font-medium text-foreground">Redesign needs updating</p>
            <p className="mt-0.5 text-muted-foreground">
              Your selected concept was based on a previous Analysis. Generate or re-select against
              the current Analysis.
            </p>
          </div>
        ) : null}

        {primaryIsSelect && candidates.length > 0 ? (
          <div
            role="status"
            className="mb-5 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
          >
            Concepts are ready. Select one explicitly to mark Redesign complete — generation alone
            does not advance the workflow.
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Palette className="h-3 w-3" />
            Stage: Redesign
          </Badge>
          <Badge variant="secondary">{redesignState.currency}</Badge>
          <p className="text-xs text-muted-foreground">
            AI proposes concepts · you confirm before authority advances. Concepts are not
            guaranteed construction drawings.
          </p>
        </div>

        {candidates.length === 0 && !generating ? (
          <EmptyState
            icon={Sparkles}
            title="No redesign concepts yet"
            description="Generate style concepts from your current Analysis. You will choose one before Redesign is complete."
            action={
              <Button
                onClick={() => void handleGenerate()}
                disabled={generating}
                data-testid="redesign-generate"
                aria-label={`${primaryLabel} — generate concepts from current Analysis`}
              >
                <Sparkles className="mr-1 h-4 w-4" />
                {primaryLabel}
              </Button>
            }
          />
        ) : (
          <div
            className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
            data-testid="redesign-candidates"
          >
            {candidates.map((c) => (
              <RedesignCard
                key={c.id}
                concept={c}
                beforePhotoUrl={heroUrl}
                selected={c.isSelected}
                selectDisabled={selectingId !== null || generating}
                onSelect={() => void handleSelect(c.id)}
                selectLabel="Select Redesign"
              />
            ))}
          </div>
        )}

        {generating ? (
          <div className="mt-6">
            <LoadingState label="Generating redesign concepts from current Analysis…" />
          </div>
        ) : null}

        <p className="mt-8 text-xs text-muted-foreground">{DISCLAIMER}</p>
      </>
    ),
  });
}
