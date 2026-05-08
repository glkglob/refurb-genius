// Cross-module shared types. Re-exported from owning modules so consumers
// can import a single canonical name.
export type {
  Project,
  NewProjectInput,
  ProjectStage,
  ProjectStatus,
  PropertyType,
  UKRegion,
  ProjectPhoto,
} from "@/core/projects";
export type {
  FinishLevel,
  EstimateCategory,
  EstimateInputs,
  EstimateResult,
  LineItem,
} from "@/core/pricing";
export type { InvestorMetrics, RiskLevel } from "@/core/roi";
export type {
  RoomAnalysis,
  RoomType,
  ConditionLevel,
  RefurbLevel,
} from "@/core/ai";
