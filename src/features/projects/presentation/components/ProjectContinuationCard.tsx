/**
 * IA-6 — Dashboard project card driven by canonical five-stage workflow + resolver.
 *
 * Does not invent workflow authority. Status and CTA come from
 * useProjectFiveStageWorkflow → composeProjectWorkflowState → resolveProjectNextAction.
 */
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { ArrowRight, Building2, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Project } from "@/core/projects";
import { usePhotos, useProjectPhotoDisplayUrl } from "@/features/ai-upload";
import {
  buildProjectWorkflowStages,
  explainProjectNextActionReason,
  workflowAllStagesComplete,
  workflowHasNeedsAttention,
  type ProjectWorkflowStatusLabel,
} from "../../domain";
import { useProjectFiveStageWorkflow } from "../hooks/useProjectFiveStageWorkflow";
import { WorkflowStageProgress } from "./WorkflowStageProgress";

export type ProjectContinuationLayout = "card" | "featured" | "row";

export type ProjectContinuationCardProps = {
  project: Project;
  /** Presentation variant. State still comes from the five-stage workflow hook. */
  layout?: ProjectContinuationLayout;
};

function toneForHealth(
  loading: boolean,
  needsAttention: boolean,
  complete: boolean,
): "accent" | "muted" | "destructive" {
  if (loading) return "muted";
  if (needsAttention) return "destructive";
  if (complete) return "accent";
  return "muted";
}

function healthLabel(loading: boolean, needsAttention: boolean, complete: boolean): string {
  if (loading) return "Loading";
  if (needsAttention) return "Needs attention";
  if (complete) return "Complete";
  return "In progress";
}

function rowStatusClass(status: string): string {
  if (status === "Needs attention") return "text-destructive";
  if (status === "Complete" || status === "In progress" || status === "Ready") {
    return "text-primary";
  }
  return "text-muted-foreground";
}

function stageBarClass(status: string): string {
  switch (status) {
    case "Complete":
      return "bg-accent";
    case "Needs attention":
      return "bg-destructive";
    case "In progress":
      return "bg-accent/60";
    case "Ready":
      return "bg-accent/35";
    default:
      return "bg-muted";
  }
}

function WorkflowStageList({ stages }: { stages: ReturnType<typeof buildProjectWorkflowStages> }) {
  return (
    <ol
      className="flex flex-wrap gap-2"
      aria-label="Five-stage workflow progress"
      data-testid="workflow-stage-list"
    >
      {stages.map((stage) => (
        <li
          key={stage.id}
          className="min-w-0 rounded-full border border-border/60 px-2.5 py-1 text-xs leading-snug text-muted-foreground"
          data-testid={`workflow-stage-${stage.id}`}
        >
          <span className="font-medium text-foreground">{stage.label}</span>
          <span className="mx-1" aria-hidden>
            ·
          </span>
          {stage.status}
        </li>
      ))}
    </ol>
  );
}

const PORTFOLIO_THUMB_CLASS = "h-[6.25rem] w-[5.5rem] shrink-0 rounded-lg";

function projectLocationLabel(project: Project): string {
  return [project.address, project.postcode].filter(Boolean).join(", ") || project.region || "";
}

function PortfolioThumbnail({
  projectId,
  name,
  className,
}: {
  projectId: string;
  name: string;
  className?: string;
}) {
  const photos = usePhotos(projectId);
  const first = photos.data?.[0];
  const display = useProjectPhotoDisplayUrl({
    projectId,
    photoId: first?.id ?? "",
    storagePath: first?.storagePath ?? "",
  });
  const signedUrl = display.data?.signedUrl;

  if (first && signedUrl) {
    return (
      <img
        src={signedUrl}
        alt=""
        className={cn(PORTFOLIO_THUMB_CLASS, "object-cover", className)}
        data-testid="project-card-media"
        data-media="photo"
        data-photo-id={first.id}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div
      className={cn(
        PORTFOLIO_THUMB_CLASS,
        "flex items-center justify-center bg-muted/40 text-muted-foreground/70",
        className,
      )}
      data-testid="project-card-media"
      data-media="placeholder"
      aria-hidden
      title={name}
    >
      <Building2 className="h-6 w-6" />
    </div>
  );
}

function ProjectContinuationCardComponent({
  project,
  layout = "card",
}: ProjectContinuationCardProps) {
  const fiveStage = useProjectFiveStageWorkflow(project.id);
  const progress = fiveStage.shellProgress
    ? { ...fiveStage.shellProgress }
    : {
        photosDone: false,
        analysisDone: false,
        estimateDone: false,
        reportDone: false,
      };
  const stages = buildProjectWorkflowStages({
    progress,
    route: { surface: "overview" },
  });
  const needsAttention = workflowHasNeedsAttention(stages);
  const complete =
    fiveStage.nextAction?.actionKind === "view_completed_project" ||
    workflowAllStagesComplete(stages);
  const next = fiveStage.nextAction;
  const explanation = next ? explainProjectNextActionReason(next.reason) : "";
  const isRow = layout === "row";
  const isFeatured = layout === "featured";
  const rowStatus = fiveStage.loading
    ? "Loading"
    : (next?.status ??
      (healthLabel(false, needsAttention, complete) as ProjectWorkflowStatusLabel));

  if (isRow) {
    const location = projectLocationLabel(project);
    return (
      <article
        className="w-full min-w-0 max-w-full rounded-2xl border border-border/70 bg-card"
        data-testid="project-continuation-card"
        data-layout={layout}
        data-project-id={project.id}
      >
        <div className="flex w-full min-w-0 max-w-full flex-col gap-3 p-4 lg:grid lg:grid-cols-[5.5rem_minmax(0,1fr)_auto_auto] lg:items-center lg:gap-x-3 lg:gap-y-2">
          <div className="flex min-w-0 items-center gap-3 lg:contents">
            <PortfolioThumbnail
              projectId={project.id}
              name={project.name}
              className="lg:row-span-2 lg:self-center"
            />
            <div className="min-w-0 lg:col-start-2 lg:row-start-1">
              <h3 className="truncate text-sm font-semibold leading-snug tracking-tight text-foreground">
                {project.name}
              </h3>
              {location ? (
                <p className="mt-0.5 truncate text-xs leading-snug text-muted-foreground">
                  {location}
                </p>
              ) : null}
            </div>
          </div>
          <p
            className={cn(
              "min-w-0 truncate text-xs font-medium lg:col-start-3 lg:row-start-1",
              rowStatusClass(rowStatus),
            )}
            data-testid="project-row-status"
          >
            {rowStatus}
          </p>
          <div
            className="min-w-0 w-full max-w-full lg:col-span-3 lg:col-start-2 lg:row-start-2"
            data-testid="project-row-workflow"
          >
            <WorkflowStageProgress stages={stages} variant="labeled-track" />
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="min-h-11 w-fit shrink-0 px-4 lg:col-start-4 lg:row-start-1 lg:min-h-9 lg:justify-self-end"
          >
            <Link
              to="/projects/$id"
              params={{ id: project.id }}
              search={{ tab: "overview" }}
              data-testid="open-overview"
            >
              Open project
            </Link>
          </Button>
        </div>
      </article>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden border border-border/60 bg-card transition-all hover:border-accent/30 hover:shadow-lg",
        layout === "card" && "h-full",
      )}
      data-testid="project-continuation-card"
      data-layout={layout}
      data-project-id={project.id}
    >
      {/*
        IA-8-VR-R2: Dashboard data contract has no project cover/photo URL.
        Do not render a large empty primary/teal block (reads as broken image).
        Compact neutral branded strip keeps cards intentional without inventing media.
      */}
      <div
        className={cn(
          "flex items-center justify-center border-b border-border/50 bg-muted/40",
          isFeatured ? "min-h-24 py-6" : "min-h-12 py-3",
        )}
        data-testid="project-card-media"
        data-media="placeholder"
        aria-hidden
      >
        <Building2 className="h-5 w-5 text-muted-foreground/70" />
      </div>
      <CardContent className="min-w-0 flex-1 space-y-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                "break-words font-semibold tracking-tight text-foreground [overflow-wrap:anywhere]",
                isFeatured && "text-xl sm:text-2xl",
              )}
            >
              {project.name}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {[project.address, project.postcode].filter(Boolean).join(", ") ||
                  project.region ||
                  "Address not set"}
              </span>
            </p>
          </div>
          <StatusBadge tone={toneForHealth(fiveStage.loading, needsAttention, complete)}>
            {healthLabel(fiveStage.loading, needsAttention, complete)}
          </StatusBadge>
        </div>

        {/* Compact five-stage health (canonical statuses only) */}
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Workflow
          </p>
          {isFeatured ? (
            <WorkflowStageList stages={stages} />
          ) : (
            <ol
              className="flex gap-1"
              aria-label="Five-stage workflow progress"
              data-testid="workflow-stage-bars"
            >
              {stages.map((stage) => (
                <li
                  key={stage.id}
                  className={cn("h-1.5 flex-1 rounded-full", stageBarClass(stage.status))}
                  title={`${stage.label}: ${stage.status}`}
                  aria-label={`${stage.label}: ${stage.status}`}
                />
              ))}
            </ol>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">
            {fiveStage.loading
              ? "Loading workflow status…"
              : complete
                ? "All stages current"
                : needsAttention
                  ? "Earliest stage needs attention"
                  : next
                    ? `Next: ${next.stage.charAt(0).toUpperCase()}${next.stage.slice(1)}`
                    : "Continue workflow"}
          </p>
        </div>

        {explanation && !fiveStage.loading ? (
          <p
            className="text-xs leading-relaxed text-muted-foreground"
            data-testid="next-action-reason"
          >
            {explanation}
          </p>
        ) : null}

        {/*
          PUBLIC-BETA-R1-R2: Do not render an unsupported refurb amount or
          "No estimate yet" status. Cards have no Estimate authority total;
          canonical workflow bars + resolver CTA already communicate state.
        */}
        <div className="flex flex-col gap-3 border-t border-border/50 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            {fiveStage.loading || !next ? (
              <Button
                size="sm"
                disabled
                aria-busy="true"
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Loading
              </Button>
            ) : next.actionKind === "view_stage_progress" ? (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              >
                <a
                  href={next.route}
                  data-testid="workflow-continue-cta"
                  data-action-kind={next.actionKind}
                >
                  {next.label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </Button>
            ) : next.actionKind === "view_completed_project" ? (
              <Button asChild size="sm" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
                <a
                  href={next.route}
                  data-testid="workflow-continue-cta"
                  data-action-kind={next.actionKind}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  {next.label}
                </a>
              </Button>
            ) : (
              <Button asChild size="sm" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
                <a
                  href={next.route}
                  data-testid="workflow-continue-cta"
                  data-action-kind={next.actionKind}
                >
                  {next.label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const ProjectContinuationCard = memo(ProjectContinuationCardComponent);
