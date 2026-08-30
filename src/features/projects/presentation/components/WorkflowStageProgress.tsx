/**
 * Presentation-only five-stage markers.
 *
 * Callers pass already-derived ProjectWorkflowStagePresentation[].
 * This component does not fetch, compose, resolve, or classify workflow state.
 */
import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectWorkflowStagePresentation, ProjectWorkflowStatusLabel } from "../../domain";

export type WorkflowStageProgressVariant = "dots" | "labeled-track";

export type WorkflowStageProgressProps = {
  stages: readonly ProjectWorkflowStagePresentation[];
  variant: WorkflowStageProgressVariant;
  className?: string;
};

function markerClass(status: ProjectWorkflowStatusLabel, labeled: boolean): string {
  if (status === "Needs attention") {
    return labeled
      ? "border-destructive bg-destructive text-destructive-foreground"
      : "border-destructive bg-destructive";
  }
  if (status === "Complete" || status === "In progress") {
    return labeled
      ? "border-primary bg-primary text-primary-foreground"
      : "border-primary bg-primary";
  }
  if (status === "Ready") {
    return labeled ? "border-primary bg-primary/15 text-primary" : "border-primary bg-primary";
  }
  return labeled
    ? "border-border bg-background text-muted-foreground"
    : "border-border bg-transparent";
}

function StageMarker({
  stage,
  labeled,
}: {
  stage: ProjectWorkflowStagePresentation;
  labeled: boolean;
}) {
  const label = `${stage.label}: ${stage.status}`;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border",
        labeled ? "h-4 w-4" : "h-2 w-2",
        markerClass(stage.status, labeled),
      )}
      title={label}
      aria-label={label}
      data-testid={`workflow-stage-marker-${stage.id}`}
      data-status={stage.status}
    >
      {labeled && stage.status === "Complete" ? (
        <Check className="h-2.5 w-2.5" aria-hidden />
      ) : null}
      {labeled && stage.status === "Needs attention" ? (
        <span className="text-[9px] leading-none font-bold" aria-hidden>
          !
        </span>
      ) : null}
    </span>
  );
}

export function WorkflowStageProgress({ stages, variant, className }: WorkflowStageProgressProps) {
  const labeled = variant === "labeled-track";

  if (!labeled) {
    return (
      <ol
        className={cn("flex min-w-0 items-center gap-1.5", className)}
        aria-label="Five-stage workflow progress"
        data-testid="workflow-stage-progress"
        data-variant={variant}
      >
        {stages.map((stage) => (
          <li key={stage.id} className="min-w-0">
            <StageMarker stage={stage} labeled={false} />
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol
      className={cn("flex w-full min-w-0 max-w-full items-start", className)}
      aria-label="Five-stage workflow progress"
      data-testid="workflow-stage-progress"
      data-variant={variant}
    >
      {stages.map((stage, index) => (
        <Fragment key={stage.id}>
          {index > 0 ? (
            <li
              className="flex h-4 min-w-3 flex-1 items-center self-start"
              aria-hidden
              data-testid={`workflow-stage-connector-${stage.id}`}
            >
              <span className="block h-px w-full bg-border" />
            </li>
          ) : null}
          <li
            className="flex min-w-0 shrink-0 flex-col items-center gap-1"
            data-testid={`workflow-stage-cell-${stage.id}`}
          >
            <StageMarker stage={stage} labeled />
            <span
              className="px-0.5 text-center text-xs leading-none whitespace-nowrap text-muted-foreground"
              data-testid={`workflow-stage-label-${stage.id}`}
            >
              {stage.label}
            </span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
