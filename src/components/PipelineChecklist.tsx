/**
 * Five-stage project workflow checklist presentation.
 *
 * Converged from the historical Upload → Analyse → Estimate checklist onto
 * Photos → Analysis → Redesign → Estimate → Export (IA-0 / IA-1).
 *
 * Prefer ProjectWorkflowShell + ProjectStageNav for full shell chrome.
 * This component remains for surfaces that only need the checklist block.
 */
import { Check, Circle, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@repo/ui";
import type { PipelineStep, PipelineStepState } from "./pipeline-checklist";

type PipelineChecklistProps = {
  steps: PipelineStep[];
  className?: string;
};

function stateLabel(step: PipelineStep): string {
  if (step.statusLabel) return step.statusLabel;
  switch (step.state) {
    case "complete":
      return "Complete";
    case "current":
      return "In progress";
    case "error":
      return "Needs attention";
    case "pending":
    default:
      return "Not started";
  }
}

function StepIcon({ state }: { state: PipelineStepState }) {
  if (state === "complete") {
    return (
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary"
        aria-hidden
      >
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary"
        aria-hidden
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }
  if (state === "error") {
    return (
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/15 text-destructive"
        aria-hidden
      >
        <AlertCircle className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span
      className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground"
      aria-hidden
    >
      <Circle className="h-3.5 w-3.5" />
    </span>
  );
}

export function PipelineChecklist({ steps, className }: PipelineChecklistProps) {
  return (
    <nav aria-label="Project workflow stages">
      <ol
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-stretch sm:gap-0 sm:divide-x sm:divide-border/60",
          className,
        )}
      >
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={cn(
              "flex flex-1 items-start gap-3 sm:px-3",
              index === 0 && "sm:pl-0",
              index === steps.length - 1 && "sm:pr-0",
            )}
            aria-current={step.isActive || step.state === "current" ? "step" : undefined}
          >
            <StepIcon state={step.state} />
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-medium",
                  step.state === "complete" && "text-foreground",
                  step.state === "current" && "text-foreground",
                  step.state === "pending" && "text-muted-foreground",
                  step.state === "error" && "text-destructive",
                )}
              >
                {index + 1}. {step.label}
                <span className="sr-only"> — {stateLabel(step)}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{stateLabel(step)}</p>
              {step.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground/80">{step.description}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
