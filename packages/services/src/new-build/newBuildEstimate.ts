/**
 * New-build cost estimate (£/m² by property type + spec) — adapted from
 * refurb-estimator `new-build-calculator.ts` (simplified: no supplier overrides).
 */
import type { UKRegion } from "@/lib/projects";
import { DEFAULT_COST_LIBRARY, type TierAmounts } from "../cost-library";
import { postcodeToUkRegion } from "../uk-region";

export type NewBuildSpec = "basic" | "standard" | "premium";

export type NewBuildPropertyType =
  | "Detached House"
  | "Semi-Detached House"
  | "Terraced House"
  | "Bungalow"
  | "Flat / Apartment"
  | "Townhouse"
  | "Office"
  | "Retail"
  | "Industrial";

export type NewBuildInput = {
  totalAreaM2: number;
  propertyType: NewBuildPropertyType;
  spec: NewBuildSpec;
  region: UKRegion;
  postcode?: string;
  storeys?: number;
  bedrooms?: number;
  includeGarage?: boolean;
  includeRenewables?: boolean;
};

export type NewBuildResult = {
  totalLow: number;
  totalTypical: number;
  totalHigh: number;
  costPerM2: TierAmounts;
  region: UKRegion;
  baseBuild: TierAmounts;
  extras: Array<{ label: string; low: number; typical: number; high: number }>;
  contingencyPercent: number;
  professionalFeesPercent: number;
  metadata: {
    propertyType: NewBuildPropertyType;
    spec: NewBuildSpec;
    totalAreaM2: number;
    storeys: number;
    estimatedAt: string;
  };
};

const TIERS = ["low", "typical", "high"] as const;

/** £/m² base build rates by property type and finish spec (refurb-estimator). */
const baseBuildRates: Record<NewBuildPropertyType, Record<NewBuildSpec, TierAmounts>> = {
  "Detached House": {
    basic: { low: 1750, typical: 2200, high: 2800 },
    standard: { low: 2200, typical: 2800, high: 3400 },
    premium: { low: 2800, typical: 3500, high: 4500 },
  },
  "Semi-Detached House": {
    basic: { low: 1650, typical: 2100, high: 2650 },
    standard: { low: 2100, typical: 2650, high: 3200 },
    premium: { low: 2650, typical: 3300, high: 4200 },
  },
  "Terraced House": {
    basic: { low: 1550, typical: 2000, high: 2500 },
    standard: { low: 2000, typical: 2500, high: 3100 },
    premium: { low: 2500, typical: 3200, high: 4000 },
  },
  Bungalow: {
    basic: { low: 1850, typical: 2350, high: 2900 },
    standard: { low: 2350, typical: 2900, high: 3500 },
    premium: { low: 2900, typical: 3600, high: 4600 },
  },
  "Flat / Apartment": {
    basic: { low: 1600, typical: 2100, high: 2600 },
    standard: { low: 2100, typical: 2600, high: 3200 },
    premium: { low: 2600, typical: 3300, high: 4200 },
  },
  Townhouse: {
    basic: { low: 1700, typical: 2150, high: 2750 },
    standard: { low: 2150, typical: 2750, high: 3350 },
    premium: { low: 2750, typical: 3450, high: 4400 },
  },
  Office: {
    basic: { low: 1200, typical: 1800, high: 2500 },
    standard: { low: 1800, typical: 2500, high: 3200 },
    premium: { low: 2500, typical: 3300, high: 4500 },
  },
  Retail: {
    basic: { low: 1300, typical: 1900, high: 2600 },
    standard: { low: 1900, typical: 2600, high: 3400 },
    premium: { low: 2600, typical: 3500, high: 4700 },
  },
  Industrial: {
    basic: { low: 1000, typical: 1450, high: 2100 },
    standard: { low: 1450, typical: 2100, high: 2850 },
    premium: { low: 2100, typical: 2900, high: 3900 },
  },
};

const garageCost: TierAmounts = { low: 15000, typical: 25000, high: 40000 };
const renewableCost: TierAmounts = { low: 8000, typical: 15000, high: 25000 };

const CONTINGENCY_PERCENT = 8;
const PROFESSIONAL_FEES_PERCENT = 10;

function getStoreyAdjustment(storeys: number): number {
  if (storeys <= 1) return 1;
  if (storeys === 2) return 1.03;
  if (storeys === 3) return 1.06;
  return 1.1;
}

function mulTier(amounts: TierAmounts, factor: number): TierAmounts {
  return {
    low: amounts.low * factor,
    typical: amounts.typical * factor,
    high: amounts.high * factor,
  };
}

function addTier(a: TierAmounts, b: TierAmounts): TierAmounts {
  return {
    low: a.low + b.low,
    typical: a.typical + b.typical,
    high: a.high + b.high,
  };
}

function roundTier(a: TierAmounts): TierAmounts {
  return {
    low: Math.round(a.low),
    typical: Math.round(a.typical),
    high: Math.round(a.high),
  };
}

export function runNewBuildEstimate(input: NewBuildInput): NewBuildResult {
  if (!Number.isFinite(input.totalAreaM2) || input.totalAreaM2 <= 0 || input.totalAreaM2 > 10000) {
    throw new Error("totalAreaM2 must be between 1 and 10,000");
  }

  const region = input.postcode ? postcodeToUkRegion(input.postcode) : input.region;
  const regionalMultiplier = DEFAULT_COST_LIBRARY.regionalMultipliers[region] ?? 1;
  const storeys = Math.max(1, Math.min(20, input.storeys ?? 2));
  const rates = baseBuildRates[input.propertyType][input.spec];
  const storeyAdj = getStoreyAdjustment(storeys);

  let baseBuild = mulTier(rates, input.totalAreaM2 * regionalMultiplier * storeyAdj);

  const extras: NewBuildResult["extras"] = [];
  if (input.includeGarage) {
    const g = mulTier(garageCost, regionalMultiplier);
    extras.push({ label: "Garage", ...roundTier(g) });
    baseBuild = addTier(baseBuild, g);
  }
  if (input.includeRenewables) {
    const r = mulTier(renewableCost, regionalMultiplier);
    extras.push({ label: "Renewables package", ...roundTier(r) });
    baseBuild = addTier(baseBuild, r);
  }

  const withFees: TierAmounts = { low: 0, typical: 0, high: 0 };
  for (const tier of TIERS) {
    const contingency = baseBuild[tier] * (CONTINGENCY_PERCENT / 100);
    const fees = baseBuild[tier] * (PROFESSIONAL_FEES_PERCENT / 100);
    withFees[tier] = Math.round(baseBuild[tier] + contingency + fees);
  }

  return {
    totalLow: withFees.low,
    totalTypical: withFees.typical,
    totalHigh: withFees.high,
    costPerM2: {
      low: withFees.low / input.totalAreaM2,
      typical: withFees.typical / input.totalAreaM2,
      high: withFees.high / input.totalAreaM2,
    },
    region,
    baseBuild: roundTier(baseBuild),
    extras,
    contingencyPercent: CONTINGENCY_PERCENT,
    professionalFeesPercent: PROFESSIONAL_FEES_PERCENT,
    metadata: {
      propertyType: input.propertyType,
      spec: input.spec,
      totalAreaM2: input.totalAreaM2,
      storeys,
      estimatedAt: new Date().toISOString(),
    },
  };
}
