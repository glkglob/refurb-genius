/**
 * Estimate slice — Domain layer.
 *
 * Pure business concepts only: no IO, no frameworks, no vendor SDKs.
 *
 * The deterministic pricing engine is a shared-kernel domain service that
 * lives in `@repo/services` by architectural mandate (pinned by the pricing
 * and ROI invariant tests). This layer defines the slice's domain surface by
 * re-exporting the canonical names; slice code imports them from here so the
 * kernel dependency stays in one place.
 */
export type {
  Property,
  RefurbEstimate,
  RefurbLineItem,
  RefurbEstimateInputs,
  ConditionLevel,
  EstimateCategory,
  FinishLevel,
  UKRegion,
} from "./types";
export type { GenerateEstimateInput, AIGeneratedRoom, AIGeneratedItem } from "./aiEstimate.types";
export { lineItemsTotal, isActionableEstimate } from "./rules";
export {
  isAuthoritativePricingAuthority,
  selectCurrentAuthorityEstimateRow,
  type EstimateAuthorityRowLike,
} from "./estimateAuthority";

export {
  runPricingEngine,
  calculateEstimateTotals,
  calculateLineItem,
  sizeMultiplier,
  getRegionalMultiplier,
  VAT_RATE,
  CONTINGENCY_RATE,
  REFERENCE_SIZE_SQM,
} from "@repo/services";
export type {
  PricingEngineInputs,
  PricingEngineResult,
  PricingLineItem,
  AILineItemInput,
  CalculatedLineItem,
} from "@repo/services";

/** Canonical estimate source classifications. */
export { ESTIMATE_SOURCES, type EstimateSource } from "./estimateSource";

/** Shared progressive chip helpers (L1 + L2). */
export {
  L1_CONDITION_OPTIONS,
  L1_INTENT_OPTIONS,
  conditionFromChip,
  categoriesFromIntent,
  normalizeCategories,
  hasUsableOutwardPostcode,
  isPostcodeConfidenceEligible,
  type L1ConditionChip,
  type L1IntentChip,
} from "./progressiveChips";

/** L1 progressive estimate policy (versioned defaults). */
export {
  L1_POLICY_VERSION,
  resolveL1Inputs,
  type L1UserInput,
  type L1ResolvedInputs,
} from "./l1Policy";

/** L2 progressive estimate policy (finish/size/categories + confidence). */
export {
  L2_POLICY_VERSION,
  L2_MIN_SIZE_SQM,
  L2_MAX_SIZE_SQM,
  L2_FINISH_OPTIONS,
  L2PolicyError,
  resolveL2Inputs,
  resolveL2DisplayConfidence,
  type L2UserInput,
  type L2ResolvedInputs,
  type L2UserProvided,
} from "./l2Policy";
