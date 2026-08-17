/**
 * Advisory ConditionLevel comparison — Quick estimate only.
 *
 * Holds every PricingEngineInputs field constant and varies only
 * property_condition across the canonical ConditionLevel list.
 * Money comes solely from runPricingEngine. No persistence, no vision
 * mapping, no other engines, no new pricing constants.
 */
import { CONDITION_LEVELS, type ConditionLevel } from "@repo/types";
import { runPricingEngine, type PricingEngineInputs, type PricingEngineResult } from "../domain";

export type ConditionLevelCompareRow = {
  condition: ConditionLevel;
  selected: boolean;
  pricing: PricingEngineResult;
};

/**
 * Compare canonical refurb costs across every ConditionLevel.
 * Pure and read-only: does not save, recommend, or mutate inputs.
 */
export function compareConditionLevels(inputs: PricingEngineInputs): ConditionLevelCompareRow[] {
  return CONDITION_LEVELS.map((property_condition) => ({
    condition: property_condition,
    selected: property_condition === inputs.property_condition,
    pricing: runPricingEngine({
      ...inputs,
      property_condition,
    }),
  }));
}
