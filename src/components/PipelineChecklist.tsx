/**
 * Upload → Analyse → Estimate pipeline checklist for project workflow pages.
 */
import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineStep, PipelineStepState } from "./pipeline-checklist";

type PipelineChecklistProps = {
  steps: PipelineStep[];
  className?: string;
};

function StepIcon({ state }: { state: PipelineStepState }) {
  if (state === "complete") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <Circle className="h-3.5 w-3.5 fill-current" />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Circle className="h-3.5 w-3.5" />
    </span>
  );
}

export function PipelineChecklist({ steps, className }: PipelineChecklistProps) {
  return (
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
            "flex flex-1 items-start gap-3 sm:px-4",
            index === 0 && "sm:pl-0",
            index === steps.length - 1 && "sm:pr-0",
          )}
        >
          <StepIcon state={step.state} />
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-medium",
                step.state === "complete" && "text-emerald-700 dark:text-emerald-400",
                step.state === "current" && "text-foreground",
                step.state === "pending" && "text-muted-foreground",
                step.state === "error" && "text-destructive",
              )}
            >
              {index + 1}. {step.label}
            </p>
            {step.description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
