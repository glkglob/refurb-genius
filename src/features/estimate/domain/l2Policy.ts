/**
 * L2 progressive estimate — versioned policy for optional finish, size and
 * category refinement on top of L1 chips.
 *
 * Pure domain: no React, no IO. Money still comes solely from runPricingEngine
 * via the application use-case.
 */
import {
  REFERENCE_SIZE_SQM,
  UNMAPPED_POSTCODE_REGION_MESSAGE,
  resolvePostcodeRegion,
  sizeMultiplier,
  type PricingEngineInputs,
} from "@repo/services";
import { FINISH_LEVELS, type EstimateCategory, type FinishLevel, type UKRegion } from "@repo/types";
import {
  categoriesFromIntent,
  conditionFromChip,
  isPostcodeConfidenceEligible,
  normalizeCategories,
  type L1ConditionChip,
  type L1IntentChip,
} from "./progressiveChips";

/** Bump when maps, bounds or confidence rules change. */
export const L2_POLICY_VERSION = "2026-08-17.1";

export const L2_MIN_SIZE_SQM = 20;
export const L2_MAX_SIZE_SQM = 500;

export const L2_FINISH_OPTIONS: Array<{ value: FinishLevel; label: string }> = FINISH_LEVELS.map(
  (value) => ({ value, label: value }),
);

export type L2UserInput = {
  postcode: string;
  condition: L1ConditionChip;
  intent: L1IntentChip;
  /** When null/undefined, Standard is assumed. */
  finish?: FinishLevel | null;
  /** When null/undefined, REFERENCE_SIZE_SQM is assumed. Explicit invalid numbers throw. */
  property_size_sqm?: number | null;
  /**
   * Category override:
   * - undefined/null → intent-derived categories
   * - non-empty array → explicit override (normalized)
   * - empty array → validation error
   */
  categories?: EstimateCategory[] | null;
};

export type L2UserProvided = {
  finish: boolean;
  size: boolean;
  categories: boolean;
  regionMapped: boolean;
  postcodeConfidenceEligible: boolean;
};

export type L2ResolvedInputs = {
  engineInputs: PricingEngineInputs;
  /**
   * Defaults and fallbacks still applied only.
   * Explicit user-provided values are tracked via userProvided + key drivers —
   * they must not appear here as "provided" notes.
   */
  appliedDefaults: string[];
  userProvided: L2UserProvided;
  region: UKRegion;
  regionMapped: boolean;
  postcodeConfidenceEligible: boolean;
  /** True when size mult hits engine extreme/cap band (forces displayConfidence low). */
  sizeExtremeWarning: boolean;
  policyVersion: string;
};

export class L2PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "L2PolicyError";
  }
}

function isFinishLevel(value: unknown): value is FinishLevel {
  return typeof value === "string" && (FINISH_LEVELS as readonly string[]).includes(value);
}

/**
 * Resolve L2 user inputs into full engine inputs using the versioned policy.
 * Records every default still applied and provenance flags for confidence.
 */
export function resolveL2Inputs(user: L2UserInput): L2ResolvedInputs {
  const appliedDefaults: string[] = [];

  const postcodeResolution = resolvePostcodeRegion(user.postcode);
  const region = postcodeResolution.region;
  const regionMapped = postcodeResolution.matched;
  const postcodeConfidenceEligible = isPostcodeConfidenceEligible(user.postcode, regionMapped);

  if (!regionMapped || !region) {
    throw new L2PolicyError(UNMAPPED_POSTCODE_REGION_MESSAGE);
  }

  const property_condition = conditionFromChip(user.condition);

  // Finish
  let finish_quality: FinishLevel;
  let finishProvided = false;
  if (user.finish == null) {
    finish_quality = "Standard";
    appliedDefaults.push(`Finish assumed: ${finish_quality}`);
  } else if (!isFinishLevel(user.finish)) {
    throw new L2PolicyError("Select a valid finish level (Budget, Standard or Premium).");
  } else {
    finish_quality = user.finish;
    finishProvided = true;
  }

  // Size
  let property_size_sqm: number;
  let sizeProvided = false;
  if (user.property_size_sqm == null) {
    property_size_sqm = REFERENCE_SIZE_SQM;
    appliedDefaults.push(`Property size assumed: ${REFERENCE_SIZE_SQM} m² (reference size)`);
  } else {
    const size = user.property_size_sqm;
    if (!Number.isFinite(size) || size === 0) {
      throw new L2PolicyError("Enter a valid property size in square metres.");
    }
    if (size < L2_MIN_SIZE_SQM || size > L2_MAX_SIZE_SQM) {
      throw new L2PolicyError(
        `Property size must be between ${L2_MIN_SIZE_SQM} and ${L2_MAX_SIZE_SQM} m².`,
      );
    }
    property_size_sqm = size;
    sizeProvided = true;
    // Explicit size: no appliedDefaults entry (provenance via userProvided + drivers)
  }

  // Categories
  let selected_categories: EstimateCategory[];
  let categoriesProvided = false;
  if (user.categories == null) {
    selected_categories = categoriesFromIntent(user.intent);
    appliedDefaults.push(
      `Categories from intent "${user.intent}": ${selected_categories.join(", ")}`,
    );
  } else if (user.categories.length === 0) {
    throw new L2PolicyError("Select at least one work category, or leave category refinement off.");
  } else {
    selected_categories = normalizeCategories(user.categories);
    if (selected_categories.length === 0) {
      throw new L2PolicyError("Select at least one recognised work category.");
    }
    categoriesProvided = true;
    // Explicit categories: no appliedDefaults entry
  }

  const sizeMult = sizeMultiplier(property_size_sqm);
  const sizeExtremeWarning = sizeMult >= 1.75 || sizeMult <= 0.72;

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
    userProvided: {
      finish: finishProvided,
      size: sizeProvided,
      categories: categoriesProvided,
      regionMapped,
      postcodeConfidenceEligible,
    },
    region,
    regionMapped,
    postcodeConfidenceEligible,
    sizeExtremeWarning,
    policyVersion: L2_POLICY_VERSION,
  };
}

/**
 * Product display confidence for L2.
 * high is never returned at L2.
 */
export function resolveL2DisplayConfidence(resolved: L2ResolvedInputs): "low" | "medium" {
  const { userProvided, postcodeConfidenceEligible, sizeExtremeWarning } = resolved;

  if (!userProvided.finish || !userProvided.size) return "low";
  if (!postcodeConfidenceEligible) return "low";
  if (sizeExtremeWarning) return "low";
  return "medium";
}
