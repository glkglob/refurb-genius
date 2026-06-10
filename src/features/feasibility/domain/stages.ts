export enum FeasibilityStage {
  Upload = "upload",
  Analysis = "analysis",
  Scope = "scope",
  Redesign = "redesign",
  Estimate = "estimate",
  Roi = "roi",
  Export = "export",
}

export const FEASIBILITY_STAGE_ORDER: readonly FeasibilityStage[] = [
  FeasibilityStage.Upload,
  FeasibilityStage.Analysis,
  FeasibilityStage.Scope,
  FeasibilityStage.Redesign,
  FeasibilityStage.Estimate,
  FeasibilityStage.Roi,
  FeasibilityStage.Export,
];
