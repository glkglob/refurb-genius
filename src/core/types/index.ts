// Shared cross-product type registry. Pages and components import from here
// instead of defining inline interfaces.
export type { Profile } from "./profile";
export type {
  Project,
  ProjectStatus,
  NewProjectInput,
  ProjectStage,
  PropertyType,
  UKRegion,
} from "./project";
export type { Photo } from "./photo";
export type {
  AnalysisResult,
  RoomType,
  ConditionLevel,
  RefurbLevel,
} from "./analysis";
export type { RedesignConcept, RedesignStyle } from "./redesign";
export type {
  Estimate,
  EstimateItem,
  EstimateInputs,
  EstimateCategory,
  FinishLevel,
} from "./estimate";
export type { InvestmentMetrics, RiskLevel } from "./metrics";
export type { Report } from "./report";
