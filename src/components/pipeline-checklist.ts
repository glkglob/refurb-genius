/**
 * Pure helpers / types for the Upload → Analyse → Estimate checklist.
 * Kept out of the React component file so react-refresh stays happy.
 */

export type PipelineStepId = "upload" | "analyse" | "estimate";

export type PipelineStepState = "complete" | "current" | "pending" | "error";

export type PipelineStep = {
  id: PipelineStepId;
  label: string;
  description?: string;
  state: PipelineStepState;
};

/** Derive checklist steps from project stage flags + counts. */
export function buildProjectPipelineSteps(input: {
  photoCount: number;
  analysisComplete: boolean;
  analysisHasFallback?: boolean;
  estimateComplete: boolean;
  current: PipelineStepId;
}): PipelineStep[] {
  const uploadState: PipelineStepState =
    input.photoCount > 0 ? "complete" : input.current === "upload" ? "current" : "pending";

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
