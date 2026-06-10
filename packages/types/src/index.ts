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
export { PROPERTY_TYPES, UK_REGIONS } from "./project";
export type { Photo } from "./photo";
// Note: Analysis / Redesign types now consolidated under ./ai (Phase 1 AI platform contracts).
// The old per-domain files still exist for compat but we avoid duplicate export names here.
export type {
  Estimate,
  EstimateItem,
  EstimateInputs,
  EstimateCategory,
  FinishLevel,
} from "./estimate";
export type { InvestmentMetrics, RiskLevel } from "./metrics";
export type { Report } from "./report";
export type { ReportMetadata } from "./report";
export type {
  RoiReport,
  SensitivityScenario,
  SensitivityScenarioAssumptions,
  GdvBreakdown,
  CashFlowModel,
} from "./roi";
export type { FeasibilityStudy, FeasibilityStatus, ExportReference } from "./feasibility";
export type { ShareLink, ShareVisibility, ShareAccessRole } from "./sharing";

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

// Feature foundation types (3D Floorplan, Marketplace, Photo Analysis, Pitch Deck, Gallery)
export type {
  FloorplanModel,
  FloorplanAnnotation,
  FloorplanMeasurement,
  FloorplanModelWithAnnotations,
  FloorplanStatus,
} from "./floorplan";
export type {
  Tradeperson,
  TradeSpecialty,
  TradeFavorite,
  QuoteRequest,
  TradeMessage,
  TradepersonWithSpecialties,
  QuoteRequestWithMessages,
  QuoteStatus,
} from "./marketplace";
export type { PhotoAnalysisResult } from "./photo-analysis";
export type { PitchDeckExport } from "./pitch-deck";
export type {
  PublicGalleryProject,
  InvestorLead,
  GalleryProjectWithLeads,
  GalleryOwnerContext,
  GalleryPublishInput,
} from "./gallery";
export type {
  CheckoutSession as PaymentCheckoutSession,
  PaymentIntent,
  PaymentIntentStatus,
  PaymentWebhookVerification,
} from "./payment";

// Deal Copilot orchestration types
export type { ParsedDealFormData, DealAnalysisResult } from "./deal-copilot";

// AI platform contracts (Phase 1+)
export type {
  RoomAnalysis,
  RoomType,
  ConditionLevel,
  RefurbLevel,
  AnalysisSource,
  ScopeAnalysisInput,
  ScopeAnalysisResult,
  ScopeRoom,
  ScopeIssue,
  ScopeRecommendedItem,
  AIGeneratedRoom,
  AIGeneratedItem,
  GenerateEstimateInput,
  RedesignConcept,
  RedesignStyle,
} from "./ai";
