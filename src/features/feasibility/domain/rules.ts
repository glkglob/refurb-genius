import type { FeasibilityStudy } from "./feasibility";

export function isFeasibilityStudyComplete(study: FeasibilityStudy): boolean {
  return (
    study.roomAnalyses.length > 0 &&
    study.scope.rooms.length > 0 &&
    study.estimate.lineItems.length > 0 &&
    study.roi.baseMetrics.investment_score > 0
  );
}

export function nextFeasibilityVersion(study: FeasibilityStudy): number {
  return study.metadata.version + 1;
}
