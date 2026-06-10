import type { ExportCapability, CreateFeasibilityStudyCommand } from "./ports";
import type { FeasibilityStudySnapshot } from "../domain";
import {
  makeOrchestrateFeasibility,
  type OrchestrateFeasibilityDeps,
} from "./orchestrateFeasibility";

export type CreateFeasibilityStudyDeps = OrchestrateFeasibilityDeps & {
  exports?: ExportCapability;
};

export function makeCreateFeasibilityStudy({
  analysisAgent,
  scopeAgent,
  estimateAgent,
  roiAgent,
  repository,
  exports,
}: CreateFeasibilityStudyDeps) {
  const orchestrateFeasibility = makeOrchestrateFeasibility({
    analysisAgent,
    scopeAgent,
    estimateAgent,
    roiAgent,
    repository,
    exportService: exports,
  });

  return async function createFeasibilityStudy(
    command: CreateFeasibilityStudyCommand,
  ): Promise<FeasibilityStudySnapshot> {
    const result = await orchestrateFeasibility(command);
    return result.studySnapshot;
  };
}
