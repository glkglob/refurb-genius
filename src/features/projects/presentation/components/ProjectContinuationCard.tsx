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
import {
  buildProjectWorkflowStages,
  explainProjectNextActionReason,
  workflowAllStagesComplete,
  workflowHasNeedsAttention,
} from "../../domain";
import { useProjectFiveStageWorkflow } from "../hooks/useProjectFiveStageWorkflow";

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

  return (
    <Card
      className={cn(
        "overflow-hidden border border-border/60 bg-card transition-all hover:border-accent/30 hover:shadow-lg",
        layout === "card" && "h-full",
        isRow && "lg:flex lg:flex-row",
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
          isRow && "lg:w-44 lg:shrink-0 lg:border-b-0 lg:border-r",
        )}
        data-testid="project-card-media"
        data-media="placeholder"
        aria-hidden
      >
        <Building2 className="h-5 w-5 text-muted-foreground/70" />
      </div>
      <CardContent
        className={cn(
          "min-w-0 flex-1 space-y-4 p-5",
          isRow && "lg:flex lg:flex-col lg:justify-center",
        )}
      >
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
          {isFeatured || isRow ? (
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
            {isRow ? (
              <Button asChild size="sm" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
                <Link
                  to="/projects/$id"
                  params={{ id: project.id }}
                  search={{ tab: "overview" }}
                  data-testid="open-overview"
                >
                  Open project
                </Link>
              </Button>
            ) : fiveStage.loading || !next ? (
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
