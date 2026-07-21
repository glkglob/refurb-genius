/**
 * Scope-based enhanced refurb estimate — adapted from refurb-estimator
 * `enhanced-estimator-calculator.ts` (simplified: UKRegion direct, no commercial qty path).
 *
 * Complements the category-based `runPricingEngine` with £/m² scope rates and
 * optional feature add-ons (loft, extensions, rewire, etc.).
 */
import type { UKRegion } from "@/lib/projects";
import { DEFAULT_COST_LIBRARY, type TierAmounts } from "../cost-library";
import { postcodeToUkRegion } from "../uk-region";

export type RenovationScope = "cosmetic" | "standard" | "full" | "structural";
export type QualityTier = "budget" | "standard" | "premium";
export type PropertyCategory =
  | "flat"
  | "terraced"
  | "semi-detached"
  | "detached"
  | "bungalow"
  | "hmo"
  | "commercial";

export type AdditionalFeature =
  | "loft_conversion"
  | "extension_single_storey"
  | "extension_double_storey"
  | "basement_conversion"
  | "new_roof"
  | "full_rewire"
  | "new_boiler"
  | "underfloor_heating"
  | "solar_panels"
  | "new_windows_throughout"
  | "garden_landscaping"
  | "driveway";

export type EnhancedEstimateInput = {
  totalAreaM2: number;
  region: UKRegion;
  renovationScope: RenovationScope;
  qualityTier: QualityTier;
  propertyCategory: PropertyCategory;
  /** Optional; when set, overrides region via postcode inference. */
  postcode?: string;
  yearBuilt?: number;
  listedBuilding?: boolean;
  additionalFeatures?: AdditionalFeature[];
};

export type FeatureCostLine = {
  feature: AdditionalFeature;
  label: string;
  low: number;
  typical: number;
  high: number;
};

export type EnhancedEstimateResult = {
  totalLow: number;
  totalTypical: number;
  totalHigh: number;
  costPerM2: TierAmounts;
  baseRenovation: TierAmounts;
  additionalFeatureCosts: FeatureCostLine[];
  contingencyPercent: number;
  feesPercent: number;
  region: UKRegion;
  adjustments: Array<{ label: string; amount: number; reason: string }>;
  metadata: {
    renovationScope: RenovationScope;
    qualityTier: QualityTier;
    propertyCategory: PropertyCategory;
    yearBuilt?: number;
    listedBuilding: boolean;
    estimatedAt: string;
  };
};

const TIERS = ["low", "typical", "high"] as const;

const scopeBaseRates: Record<RenovationScope, TierAmounts> = {
  cosmetic: { low: 450, typical: 700, high: 1000 },
  standard: { low: 1200, typical: 1800, high: 2500 },
  full: { low: 1800, typical: 2600, high: 3500 },
  structural: { low: 2500, typical: 3500, high: 5000 },
};

const propertyComplexityMultipliers: Record<PropertyCategory, number> = {
  flat: 1.0,
  terraced: 1.0,
  "semi-detached": 1.02,
  detached: 1.05,
  bungalow: 1.03,
  hmo: 1.15,
  commercial: 1.2,
};

const featureCosts: Record<
  AdditionalFeature,
  { label: string; low: number; typical: number; high: number }
> = {
  loft_conversion: { label: "Loft conversion", low: 25000, typical: 45000, high: 70000 },
  extension_single_storey: {
    label: "Single-storey extension",
    low: 35000,
    typical: 60000,
    high: 100000,
  },
  extension_double_storey: {
    label: "Double-storey extension",
    low: 55000,
    typical: 90000,
    high: 150000,
  },
  basement_conversion: {
    label: "Basement conversion",
    low: 40000,
    typical: 75000,
    high: 120000,
  },
  new_roof: { label: "New roof", low: 5000, typical: 9000, high: 15000 },
  full_rewire: { label: "Full rewire", low: 3500, typical: 6000, high: 10000 },
  new_boiler: { label: "New boiler & heating", low: 2500, typical: 4500, high: 8000 },
  underfloor_heating: { label: "Underfloor heating", low: 3000, typical: 5500, high: 9000 },
  solar_panels: { label: "Solar panels", low: 5000, typical: 8000, high: 13000 },
  new_windows_throughout: {
    label: "New windows throughout",
    low: 4000,
    typical: 7500,
    high: 12000,
  },
  garden_landscaping: { label: "Garden landscaping", low: 3000, typical: 8000, high: 20000 },
  driveway: { label: "New driveway", low: 2000, typical: 5000, high: 12000 },
};

function getYearBuiltAdjustmentPercent(yearBuilt?: number): number {
  if (typeof yearBuilt !== "number") return 0;
  if (yearBuilt <= 1918) return 0.15;
  if (yearBuilt <= 1945) return 0.08;
  if (yearBuilt <= 1970) return 0.05;
  if (yearBuilt <= 1990) return 0.02;
  return 0;
}

function getContingencyPercent(scope: RenovationScope): number {
  if (scope === "full") return 10;
  if (scope === "structural") return 12;
  return 7;
}

function getFeesPercent(scope: RenovationScope): number {
  if (scope === "full" || scope === "structural") return 8;
  return 5;
}

/** Map Refurb Genius property type strings into enhanced-estimate categories. */
export function inferPropertyCategory(propertyType: string): PropertyCategory {
  const n = propertyType.trim().toLowerCase();
  if (n.includes("hmo")) return "hmo";
  if (n.includes("commercial") || n.includes("office") || n.includes("retail")) return "commercial";
  if (n.includes("bungalow")) return "bungalow";
  if (n.includes("flat") || n.includes("apartment") || n.includes("maisonette")) return "flat";
  if (n.includes("semi")) return "semi-detached";
  if (n.includes("detached") && !n.includes("semi")) return "detached";
  if (n.includes("terrace") || n.includes("townhouse")) return "terraced";
  return "terraced";
}

/** Run enhanced £/m² scope estimate with optional feature add-ons. */
export function runEnhancedEstimate(input: EnhancedEstimateInput): EnhancedEstimateResult {
  if (!Number.isFinite(input.totalAreaM2) || input.totalAreaM2 <= 0 || input.totalAreaM2 > 10000) {
    throw new Error("totalAreaM2 must be between 1 and 10,000");
  }

  const region = input.postcode ? postcodeToUkRegion(input.postcode) : input.region;
  const regionalMultiplier = DEFAULT_COST_LIBRARY.regionalMultipliers[region] ?? 1;
  const qualityMultiplier = DEFAULT_COST_LIBRARY.finishMultipliers[input.qualityTier];
  const propertyComplexity = propertyComplexityMultipliers[input.propertyCategory];
  const scopeRates = scopeBaseRates[input.renovationScope];
  const yearBuiltPercent = getYearBuiltAdjustmentPercent(input.yearBuilt);
  const listedBuildingPercent = input.listedBuilding ? 0.25 : 0;

  const baseBefore: TierAmounts = { low: 0, typical: 0, high: 0 };
  const baseRenovation: TierAmounts = { low: 0, typical: 0, high: 0 };
  const featureTotals: TierAmounts = { low: 0, typical: 0, high: 0 };
  const additionalFeatureCosts: FeatureCostLine[] = [];

  for (const tier of TIERS) {
    baseBefore[tier] =
      input.totalAreaM2 *
      scopeRates[tier] *
      regionalMultiplier *
      qualityMultiplier *
      propertyComplexity;
    const withYear = baseBefore[tier] * (1 + yearBuiltPercent);
    baseRenovation[tier] = withYear + withYear * listedBuildingPercent;
  }

  const selected = Array.from(new Set(input.additionalFeatures ?? [])).filter(
    (f): f is AdditionalFeature => f in featureCosts,
  );

  for (const feature of selected) {
    const config = featureCosts[feature];
    const costs = {
      low: Math.round(config.low * regionalMultiplier),
      typical: Math.round(config.typical * regionalMultiplier),
      high: Math.round(config.high * regionalMultiplier),
    };
    additionalFeatureCosts.push({ feature, label: config.label, ...costs });
    for (const tier of TIERS) featureTotals[tier] += costs[tier];
  }

  const contingencyPercent = getContingencyPercent(input.renovationScope);
  const feesPercent = getFeesPercent(input.renovationScope);
  const totalRounded: TierAmounts = { low: 0, typical: 0, high: 0 };
  for (const tier of TIERS) {
    const subtotal = baseRenovation[tier] + featureTotals[tier];
    const contingency = subtotal * (contingencyPercent / 100);
    const fees = subtotal * (feesPercent / 100);
    totalRounded[tier] = Math.round(subtotal + contingency + fees);
  }

  const adjustments: EnhancedEstimateResult["adjustments"] = [];
  if (yearBuiltPercent > 0) {
    adjustments.push({
      label: `Property age adjustment (+${Math.round(yearBuiltPercent * 100)}%)`,
      amount: Math.round(baseBefore.typical * yearBuiltPercent),
      reason: "Older properties often require more specialist work.",
    });
  }
  if (listedBuildingPercent > 0) {
    adjustments.push({
      label: "Listed building surcharge (+25%)",
      amount: Math.round(baseBefore.typical * (1 + yearBuiltPercent) * listedBuildingPercent),
      reason: "Listed status requires heritage materials and methods.",
    });
  }

  return {
    totalLow: totalRounded.low,
    totalTypical: totalRounded.typical,
    totalHigh: totalRounded.high,
    costPerM2: {
      low: totalRounded.low / input.totalAreaM2,
      typical: totalRounded.typical / input.totalAreaM2,
      high: totalRounded.high / input.totalAreaM2,
    },
    baseRenovation: {
      low: Math.round(baseRenovation.low),
      typical: Math.round(baseRenovation.typical),
      high: Math.round(baseRenovation.high),
    },
    additionalFeatureCosts,
    contingencyPercent,
    feesPercent,
    region,
    adjustments,
    metadata: {
      renovationScope: input.renovationScope,
      qualityTier: input.qualityTier,
      propertyCategory: input.propertyCategory,
      yearBuilt: input.yearBuilt,
      listedBuilding: Boolean(input.listedBuilding),
      estimatedAt: new Date().toISOString(),
    },
  };
}
