/**
 * IA-1 — Shared five-stage project workflow navigation.
 *
 * Presentation chrome only. Does not resolve next actions (IA-2), mutate
 * workflow state, or create a first-class Redesign route (IA-4).
 */
import { Link } from "@tanstack/react-router";
import { Check, Circle, AlertCircle } from "lucide-react";
import { cn } from "@repo/ui";
import type {
  ProjectWorkflowStagePresentation,
  ProjectWorkflowStatusLabel,
} from "../../domain/workflowStages";

type ProjectStageNavProps = {
  projectId: string;
  stages: ProjectWorkflowStagePresentation[];
  className?: string;
};

function statusIcon(status: ProjectWorkflowStatusLabel, isActive: boolean) {
  if (status === "Complete") {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
        aria-hidden
      >
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "Needs attention") {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive"
        aria-hidden
      >
        <AlertCircle className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (isActive || status === "In progress") {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-2 ring-primary/30"
        aria-hidden
      >
        <Circle className="h-3 w-3 fill-current" />
      </span>
    );
  }
  if (status === "Ready") {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-background text-primary"
        aria-hidden
      >
        <Circle className="h-3 w-3" />
      </span>
    );
  }
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      aria-hidden
    >
      <Circle className="h-3 w-3" />
    </span>
  );
}

function stageLinkProps(projectId: string, stage: ProjectWorkflowStagePresentation) {
  if (stage.destination.kind === "embedded") {
    return {
      to: "/projects/$id/analysis" as const,
      params: { id: projectId },
      search: { focus: "redesign" as const },
    };
  }
  return {
    to: stage.destination.to,
    params: { id: projectId },
    search: stage.destination.to === "/projects/$id/estimate" ? { from: undefined } : undefined,
  };
}

export function ProjectStageNav({ projectId, stages, className }: ProjectStageNavProps) {
  return (
    <nav
      aria-label="Project workflow stages"
      className={cn(
        "overflow-x-auto rounded-xl border border-border/60 bg-card/40 p-3 sm:p-4",
        className,
      )}
    >
      <ol className="flex min-w-min flex-row items-stretch gap-0 sm:w-full">
        {stages.map((stage, index) => {
          const link = stageLinkProps(projectId, stage);
          return (
            <li
              key={stage.id}
              className={cn(
                "relative flex min-w-[7.5rem] flex-1 sm:min-w-0",
                index < stages.length - 1 &&
                  "after:absolute after:right-0 after:top-3 after:hidden after:h-px after:w-3 after:bg-border sm:after:block",
              )}
            >
              <Link
                to={link.to}
                params={link.params}
                search={link.search}
                className={cn(
                  "flex w-full min-h-11 flex-col gap-1 rounded-lg px-2 py-1.5 transition-colors",
                  "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  stage.isActive && "bg-primary/10 ring-1 ring-primary/30",
                )}
                aria-current={stage.isActive ? "step" : undefined}
                aria-label={`${stage.order}. ${stage.label}, ${stage.status}`}
              >
                <div className="flex items-center gap-2">
                  {statusIcon(stage.status, stage.isActive)}
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      stage.isActive && "text-foreground",
                      !stage.isActive && stage.status === "Complete" && "text-foreground",
                      !stage.isActive &&
                        stage.status !== "Complete" &&
                        stage.status !== "Needs attention" &&
                        "text-muted-foreground",
                      stage.status === "Needs attention" && "text-destructive",
                    )}
                  >
                    <span className="tabular-nums text-muted-foreground">{stage.order}.</span>{" "}
                    {stage.label}
                  </span>
                </div>
                {/* Status as text — colour is not the sole signal */}
                <span className="pl-8 text-xs text-muted-foreground">{stage.status}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
