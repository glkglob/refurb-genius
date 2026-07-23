/**
 * Default UK cost library — adapted from refurb-estimator `lib/cost-library.ts`.
 * Pure data; no framework deps. Used by enhanced / new-build estimators.
 */
import type { UKRegion } from "@repo/types";

export type CostTier = "low" | "typical" | "high";
export type TierAmounts = Record<CostTier, number>;

export type CostLibraryCategory =
  | "kitchen"
  | "bathroom"
  | "electrics"
  | "plumbing"
  | "heating"
  | "windows"
  | "doors"
  | "plastering"
  | "decoration"
  | "flooring"
  | "contingency"
  | "fees";

export type CostLibrary = {
  baseRefurbPerM2: TierAmounts;
  /** Multipliers keyed by Refurb Genius UKRegion labels. */
  regionalMultipliers: Record<UKRegion, number>;
  conditionMultipliers: Record<"poor" | "fair" | "good", number>;
  finishMultipliers: Record<"budget" | "standard" | "premium", number>;
  categoryPercents: Record<CostLibraryCategory, number>;
};

/** Source: glkglob/refurb-estimator defaultCostLibrary (West Midlands = 1.0). */
export const DEFAULT_COST_LIBRARY: CostLibrary = {
  baseRefurbPerM2: {
    low: 1200,
    typical: 1800,
    high: 2800,
  },
  regionalMultipliers: {
    London: 1.35,
    "South East England": 1.2,
    "East of England": 1.12,
    "East Midlands": 0.98,
    "West Midlands": 1.0,
    "South West England": 1.05,
    "North West England": 0.92,
    "North East England": 0.87,
    "Yorkshire and the Humber": 0.9,
    Scotland: 0.94,
    Wales: 0.9,
    "Northern Ireland": 0.82,
  },
  conditionMultipliers: {
    poor: 1.3,
    fair: 1.0,
    good: 0.8,
  },
  finishMultipliers: {
    budget: 0.7,
    standard: 1.0,
    premium: 1.55,
  },
  categoryPercents: {
    kitchen: 0.18,
    bathroom: 0.15,
    electrics: 0.1,
    plumbing: 0.08,
    heating: 0.08,
    windows: 0.06,
    doors: 0.03,
    plastering: 0.05,
    decoration: 0.07,
    flooring: 0.08,
    contingency: 0.07,
    fees: 0.05,
  },
};

export function getRegionalCostMultiplier(region: UKRegion): number {
  return DEFAULT_COST_LIBRARY.regionalMultipliers[region] ?? 1;
}
