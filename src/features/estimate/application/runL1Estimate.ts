/**
 * L1 progressive estimate use-case.
 *
 * Pure orchestration: resolve L1 policy defaults → runPricingEngine only.
 * No React, no persistence, no AI. Presentation displays the result;
 * it never recomputes money.
 */
import {
  L1_POLICY_VERSION,
  resolveL1Inputs,
  runPricingEngine,
  type EstimateSource,
  type L1UserInput,
  type PricingEngineResult,
} from "../domain";

export type L1EstimateResult = {
  pricing: PricingEngineResult;
  /** Canonical source classification — always "engine" for pure L1. */
  source: EstimateSource;
  /**
   * Product confidence for L1 UX. Forced to "low" because defaults were
   * applied. Engine confidence is left intact on `pricing.confidence`
   * for diagnostics only.
   */
  displayConfidence: "low";
  appliedDefaults: string[];
  policyVersion: string;
  /** Merged assumptions: engine assumptions + L1 policy defaults. */
  assumptions: string[];
  keyDrivers: Array<{ label: string; value: string }>;
};

/**
 * Run a non-persisting L1 estimate from three user inputs.
 * Money comes solely from runPricingEngine.
 */
export function runL1Estimate(user: L1UserInput): L1EstimateResult {
  const resolved = resolveL1Inputs(user);
  const pricing = runPricingEngine(resolved.engineInputs);

  const assumptions = [...resolved.appliedDefaults, ...pricing.assumptions];

  const keyDrivers: Array<{ label: string; value: string }> = [
    { label: "Region", value: resolved.region },
    { label: "Condition", value: resolved.engineInputs.property_condition },
    { label: "Finish", value: resolved.engineInputs.finish_quality },
    {
      label: "Size",
      value: `${resolved.engineInputs.property_size_sqm} m² (assumed)`,
    },
    {
      label: "Categories",
      value: resolved.engineInputs.selected_categories.join(", "),
    },
  ];

  return {
    pricing,
    source: "engine",
    displayConfidence: "low",
    appliedDefaults: resolved.appliedDefaults,
    policyVersion: L1_POLICY_VERSION,
    assumptions,
    keyDrivers,
  };
}
