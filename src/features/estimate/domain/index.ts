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

/** L1 progressive estimate policy (versioned defaults + chip maps). */
export {
  L1_POLICY_VERSION,
  L1_CONDITION_OPTIONS,
  L1_INTENT_OPTIONS,
  resolveL1Inputs,
  type L1ConditionChip,
  type L1IntentChip,
  type L1UserInput,
  type L1ResolvedInputs,
} from "./l1Policy";
