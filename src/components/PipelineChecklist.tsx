/**
 * Upload → Analyse → Estimate pipeline checklist for project workflow pages.
 */
import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PipelineStepId = "upload" | "analyse" | "estimate";

export type PipelineStepState = "complete" | "current" | "pending" | "error";

export type PipelineStep = {
  id: PipelineStepId;
  label: string;
  description?: string;
  state: PipelineStepState;
};

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

/** Derive checklist steps from project stage flags + counts. */
export function buildProjectPipelineSteps(input: {
  photoCount: number;
  analysisComplete: boolean;
  analysisHasFallback?: boolean;
  estimateComplete: boolean;
  current: PipelineStepId;
}): PipelineStep[] {
  const uploadState: PipelineStepState =
    input.photoCount > 0
      ? "complete"
      : input.current === "upload"
        ? "current"
        : "pending";

  let analyseState: PipelineStepState = "pending";
  if (input.analysisComplete) {
    analyseState = input.analysisHasFallback ? "error" : "complete";
  } else if (input.current === "analyse") {
    analyseState = "current";
  } else if (input.photoCount > 0 && input.current === "estimate") {
    analyseState = "pending";
  }

  let estimateState: PipelineStepState = "pending";
  if (input.estimateComplete) {
    estimateState = "complete";
  } else if (input.current === "estimate") {
    estimateState = "current";
  }

  return [
    {
      id: "upload",
      label: "Upload",
      description:
        input.photoCount > 0
          ? `${input.photoCount} photo${input.photoCount === 1 ? "" : "s"}`
          : "Add room photos",
      state: uploadState,
    },
    {
      id: "analyse",
      label: "Analyse",
      description: input.analysisHasFallback
        ? "Some photos need re-analysis"
        : input.analysisComplete
          ? "Room assessment ready"
          : "AI condition review",
      state: analyseState,
    },
    {
      id: "estimate",
      label: "Estimate",
      description: input.estimateComplete ? "Cost estimate ready" : "Generate costs",
      state: estimateState,
    },
  ];
}
