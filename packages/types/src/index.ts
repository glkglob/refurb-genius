// Shared cross-product type registry. Pages and components import from here
// instead of defining inline interfaces.

// Domain types
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
export type { AnalysisResult, RoomType, ConditionLevel, RefurbLevel } from "./analysis";
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

// Deal types
export type {
  DealAddress,
  DealFinancials,
  DealId,
  DealInput,
  DealMetadata,
  DealSource,
  DealStatus,
  DealSummary,
} from "./deal";
export { createDealMetadata } from "./deal";

export type {
  DealOpportunity,
  DealOpportunityInput,
  DealOpportunityStatus,
  DealExitStrategy,
} from "./opportunity";
export { createDealOpportunity, isDealReadyForUnderwriting } from "./opportunity";

// Risk types
export type { RiskCategory, RiskItem, RiskSourceProductId, RiskSummary } from "./risk";
export { createEmptyRiskSummary, summariseRisks } from "./risk";

// Scenario types
export type {
  Scenario,
  ScenarioFinancials,
  ScenarioId,
  ScenarioProgramme,
  ScenarioSet,
  ScenarioSourceProductId,
  ScenarioType,
} from "./scenario";
export { getBaseScenario, getScenarioByType } from "./scenario";

// Platform types
export const PRODUCT_IDS = [
  "refurb-genius",
  "deal-copilot",
  "refurb-iq",
  "trades-marketplace",
] as const;
export type { ProductId, ProductStatus, ProductConfig } from "./products";
export { PRODUCTS, getProductConfig, isProductId, getLiveProducts } from "./products";

// Trade types
export type { TradeProfile, UpsertTradeProfileInput, InsuranceStatus } from "./tradeProfile.types";
export type {
  TradesJob,
  TradesJobStatus,
  TradesJobCategory,
  CreateTradesJobInput,
  UpdateTradesJobInput,
} from "./tradesJob.types";
export type {
  TradesJobInterest,
  TradesJobInterestStatus,
  CreateTradesJobInterestInput,
} from "./tradesJobInterest.types";

// Deal Copilot orchestration types
export type { ParsedDealFormData, DealAnalysisResult } from "./deal-copilot";
