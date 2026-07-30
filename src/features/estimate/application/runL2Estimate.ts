/**
 * L2 progressive estimate use-case.
 *
 * Pure orchestration: resolve L2 policy → runPricingEngine only.
 * Independent of runL1Estimate (shared helpers only; no public L1→L2 wrap).
 */
import {
  L2_POLICY_VERSION,
  resolveL2DisplayConfidence,
  resolveL2Inputs,
  runPricingEngine,
  type EstimateSource,
  type L2UserInput,
  type L2UserProvided,
  type PricingEngineResult,
} from "../domain";

export type L2EstimateResult = {
  pricing: PricingEngineResult;
  source: EstimateSource;
  /** Product confidence — low or medium only at L2 (never high). */
  displayConfidence: "low" | "medium";
  appliedDefaults: string[];
  policyVersion: string;
  assumptions: string[];
  keyDrivers: Array<{ label: string; value: string }>;
  userProvided: L2UserProvided;
};

/**
 * Run a non-persisting L2 estimate.
 * Money comes solely from runPricingEngine.
 */
export function runL2Estimate(user: L2UserInput): L2EstimateResult {
  const resolved = resolveL2Inputs(user);
  const pricing = runPricingEngine(resolved.engineInputs);
  const displayConfidence = resolveL2DisplayConfidence(resolved);

  const assumptions = [...resolved.appliedDefaults, ...pricing.assumptions];

  const sizeLabel = resolved.userProvided.size
    ? `${resolved.engineInputs.property_size_sqm} m²`
    : `${resolved.engineInputs.property_size_sqm} m² (assumed)`;

  const finishLabel = resolved.userProvided.finish
    ? resolved.engineInputs.finish_quality
    : `${resolved.engineInputs.finish_quality} (assumed)`;

  const categoriesJoined = resolved.engineInputs.selected_categories.join(", ");
  const categoriesLabel = resolved.userProvided.categories
    ? categoriesJoined
    : `${categoriesJoined} (from intent)`;

  const keyDrivers: Array<{ label: string; value: string }> = [
    { label: "Region", value: resolved.region },
    { label: "Condition", value: resolved.engineInputs.property_condition },
    { label: "Finish", value: finishLabel },
    { label: "Size", value: sizeLabel },
    { label: "Categories", value: categoriesLabel },
  ];

  return {
    pricing,
    source: "engine",
    displayConfidence,
    appliedDefaults: resolved.appliedDefaults,
    policyVersion: L2_POLICY_VERSION,
    assumptions,
    keyDrivers,
    userProvided: resolved.userProvided,
  };
}
