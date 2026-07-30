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
  postcodeToUkRegion,
  type PricingEngineInputs,
} from "@repo/services";
import type { EstimateCategory, FinishLevel } from "@repo/core/utilities/pricingData";
import type { ConditionLevel, UKRegion } from "@repo/types";

/** Bump when maps or default values change so diagnostics stay auditable. */
export const L1_POLICY_VERSION = "2026-07-30.1";

export type L1ConditionChip = "good" | "dated" | "poor" | "full-gut";
export type L1IntentChip = "cosmetic" | "kitchen-bath" | "full-refurb" | "not-sure";

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

const CONDITION_CHIP_MAP: Record<L1ConditionChip, ConditionLevel> = {
  good: "Modern",
  dated: "Dated",
  poor: "Poor",
  "full-gut": "Full Renovation Needed",
};

const INTENT_CATEGORY_MAP: Record<L1IntentChip, EstimateCategory[]> = {
  cosmetic: ["Painting", "Flooring"],
  "kitchen-bath": ["Kitchen", "Bathroom"],
  "full-refurb": [
    "Kitchen",
    "Bathroom",
    "Flooring",
    "Painting",
    "Electrical",
    "Plumbing",
  ],
  "not-sure": ["Kitchen", "Bathroom", "Flooring", "Painting"],
};

const DEFAULT_FINISH: FinishLevel = "Standard";

export const L1_CONDITION_OPTIONS: Array<{ value: L1ConditionChip; label: string }> = [
  { value: "good", label: "Good" },
  { value: "dated", label: "Dated" },
  { value: "poor", label: "Poor" },
  { value: "full-gut", label: "Full gut" },
];

export const L1_INTENT_OPTIONS: Array<{ value: L1IntentChip; label: string }> = [
  { value: "cosmetic", label: "Cosmetic" },
  { value: "kitchen-bath", label: "Kitchen & bath" },
  { value: "full-refurb", label: "Full refurb" },
  { value: "not-sure", label: "Not sure" },
];

/**
 * Resolve L1 user chips into full engine inputs using the versioned policy.
 * Always records every default that was applied.
 */
export function resolveL1Inputs(user: L1UserInput): L1ResolvedInputs {
  const appliedDefaults: string[] = [];

  const trimmedPostcode = user.postcode.trim();
  const region = postcodeToUkRegion(trimmedPostcode || "");
  const area = extractPostcodeArea(trimmedPostcode);
  const effectivelyMapped = Boolean(trimmedPostcode) && area.length > 0;
  if (!effectivelyMapped) {
    appliedDefaults.push(
      `Region defaulted to ${region} (postcode area not mapped or missing)`,
    );
  }

  const property_condition = CONDITION_CHIP_MAP[user.condition];
  const selected_categories = INTENT_CATEGORY_MAP[user.intent];
  const finish_quality = DEFAULT_FINISH;
  const property_size_sqm = REFERENCE_SIZE_SQM;

  appliedDefaults.push(`Finish assumed: ${finish_quality}`);
  appliedDefaults.push(
    `Property size assumed: ${REFERENCE_SIZE_SQM} m² (reference size)`,
  );
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
    regionMapped: effectivelyMapped,
    policyVersion: L1_POLICY_VERSION,
  };
}

function extractPostcodeArea(postcode: string): string {
  const normalized = postcode.trim().toUpperCase().replace(/\s+/g, "");
  const match = normalized.match(/^[A-Z]{1,2}/);
  return match ? match[0] : "";
}
