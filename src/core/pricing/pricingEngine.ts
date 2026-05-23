// Backward compatibility shim. Pricing engine has been extracted to @repo/services.
// Use @repo/services directly for new code.

export {
  runPricingEngine,
  sizeMultiplier,
  getRegionalMultiplier,
  calculateLineItem,
  calculateEstimateTotals,
  VAT_RATE,
  CONTINGENCY_RATE,
  REFERENCE_SIZE_SQM,
} from "@repo/services";
export type {
  PricingEngineInputs,
  PricingEngineResult,
  PricingLineItem,
  PricingEstimateItem,
  AILineItemInput,
  CalculatedLineItem,
} from "@repo/services";
