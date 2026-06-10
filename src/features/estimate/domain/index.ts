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
