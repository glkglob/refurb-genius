/**
 * L1 progressive estimate — versioned default-input policy.
 *
 * Pure domain: no React, no IO. Maps the three L1 user inputs
 * (postcode, condition chip, intent chip) onto full PricingEngineInputs
 * by applying documented defaults for finish, size and categories.
 *
 * Defaults live here (not in presentation). Every applied default must
 * surface in the assumptions list returned to the UI.
 */
import {
  REFERENCE_SIZE_SQM,
  resolvePostcodeRegion,
  type PricingEngineInputs,
} from "@repo/services";
import type { FinishLevel, UKRegion } from "@repo/types";
import {
  L1_CONDITION_OPTIONS,
  L1_INTENT_OPTIONS,
  categoriesFromIntent,
  conditionFromChip,
  type L1ConditionChip,
  type L1IntentChip,
} from "./progressiveChips";

/** Bump when maps or default values change so diagnostics stay auditable. */
export const L1_POLICY_VERSION = "2026-07-30.1";

export type { L1ConditionChip, L1IntentChip };
export { L1_CONDITION_OPTIONS, L1_INTENT_OPTIONS };

export type L1UserInput = {
  postcode: string;
  condition: L1ConditionChip;
  intent: L1IntentChip;
};

export type L1ResolvedInputs = {
  engineInputs: PricingEngineInputs;
  appliedDefaults: string[];
  region: UKRegion;
  regionMapped: boolean;
  policyVersion: string;
};

const DEFAULT_FINISH: FinishLevel = "Standard";

/**
 * Resolve L1 user chips into full engine inputs using the versioned policy.
 * Always records every default that was applied.
 */
export function resolveL1Inputs(user: L1UserInput): L1ResolvedInputs {
  const appliedDefaults: string[] = [];

  const postcodeResolution = resolvePostcodeRegion(user.postcode);
  const region = postcodeResolution.region;
  const regionMapped = postcodeResolution.matched;

  if (!regionMapped) {
    appliedDefaults.push(
      "Region defaulted to London because the postcode area was missing or unrecognised",
    );
  }

  const property_condition = conditionFromChip(user.condition);
  const selected_categories = categoriesFromIntent(user.intent);
  const finish_quality = DEFAULT_FINISH;
  const property_size_sqm = REFERENCE_SIZE_SQM;

  appliedDefaults.push(`Finish assumed: ${finish_quality}`);
  appliedDefaults.push(`Property size assumed: ${REFERENCE_SIZE_SQM} m² (reference size)`);
  appliedDefaults.push(
    `Categories from intent "${user.intent}": ${selected_categories.join(", ")}`,
  );

  const engineInputs: PricingEngineInputs = {
    region,
    property_condition,
    finish_quality,
    selected_categories,
    property_size_sqm,
  };

  return {
    engineInputs,
    appliedDefaults,
    region,
    regionMapped,
    policyVersion: L1_POLICY_VERSION,
  };
}
