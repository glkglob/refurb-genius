/**
 * Shared progressive-estimate chip helpers (L1 + L2).
 *
 * Pure domain: no React, no IO. Prefer functions that return fresh values
 * over exposing mutable map records.
 */
import { ESTIMATE_CATEGORIES, type ConditionLevel, type EstimateCategory } from "@repo/types";

export type L1ConditionChip = "good" | "dated" | "poor" | "full-gut";
export type L1IntentChip = "cosmetic" | "kitchen-bath" | "full-refurb" | "not-sure";

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

/** Map a condition chip to the engine condition level. */
export function conditionFromChip(chip: L1ConditionChip): ConditionLevel {
  switch (chip) {
    case "good":
      return "Modern";
    case "dated":
      return "Dated";
    case "poor":
      return "Poor";
    case "full-gut":
      return "Full Renovation Needed";
    default: {
      const _exhaustive: never = chip;
      return _exhaustive;
    }
  }
}

/**
 * Categories derived from an intent chip.
 * Always returns a fresh array (never the shared map reference).
 */
export function categoriesFromIntent(intent: L1IntentChip): EstimateCategory[] {
  switch (intent) {
    case "cosmetic":
      return ["Painting", "Flooring"];
    case "kitchen-bath":
      return ["Kitchen", "Bathroom"];
    case "full-refurb":
      return ["Kitchen", "Bathroom", "Flooring", "Painting", "Electrical", "Plumbing"];
    case "not-sure":
      return ["Kitchen", "Bathroom", "Flooring", "Painting"];
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}

/**
 * Deduplicate categories and return them in canonical ESTIMATE_CATEGORIES order.
 * Invalid / unknown values are dropped.
 */
export function normalizeCategories(categories: EstimateCategory[]): EstimateCategory[] {
  const set = new Set(categories);
  return ESTIMATE_CATEGORIES.filter((c) => set.has(c));
}

/**
 * True when the postcode string has at least a usable outward district
 * (area letters + digit), not merely a known area prefix such as "SW".
 *
 * Does not itself check region membership — callers combine with regionMapped.
 */
export function hasUsableOutwardPostcode(postcode: string): boolean {
  const compact = postcode.trim().toUpperCase().replace(/\s+/g, "");
  // Outward: A9, A99, AA9, AA99, A9A, AA9A — optional full inward digit+2 letters
  return /^[A-Z]{1,2}\d{1,2}[A-Z]?(?:\d[A-Z]{2})?$/.test(compact);
}

/**
 * L2 confidence eligibility for postcode.
 * Requires both a known region match and a structurally usable district/full postcode.
 */
export function isPostcodeConfidenceEligible(postcode: string, regionMapped: boolean): boolean {
  if (!regionMapped) return false;
  return hasUsableOutwardPostcode(postcode);
}
