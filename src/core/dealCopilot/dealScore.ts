import { runRoiEngine, type RoiEngineResult } from "@/core/roi";
import type { ConditionLevel } from "@/lib/analysis";
import type { UKRegion } from "@/lib/projects";

import type { DealOpportunityInput } from "./opportunity";

export type DealScoreInput = DealOpportunityInput & {
  region: UKRegion;
  propertyCondition: ConditionLevel;
  holdingCosts?: number;
};

export type DealScoreResult = {
  ready: boolean;
  missingFields: string[];
  roiResult: RoiEngineResult | null;
  recommendation: "Incomplete" | "Reject" | "Watch" | "Consider" | "Strong";
};

export function scoreDealOpportunity(input: DealScoreInput): DealScoreResult {
  const missingFields = getMissingDealFields(input);

  if (missingFields.length > 0) {
    return {
      ready: false,
      missingFields,
      roiResult: null,
      recommendation: "Incomplete",
    };
  }

  const roiResult = runRoiEngine({
    purchase_price: input.purchasePrice!,
    refurb_budget: input.refurbBudget!,
    estimated_gdv: input.estimatedGdv!,
    rental_income: (input.expectedMonthlyRent ?? 0) * 12,
    holding_costs: input.holdingCosts ?? 0,
    region: input.region,
    property_condition: input.propertyCondition,
  });

  return {
    ready: true,
    missingFields: [],
    roiResult,
    recommendation: getDealRecommendation(roiResult),
  };
}

export function getMissingDealFields(input: DealScoreInput): string[] {
  const missing: string[] = [];

  if (!input.title) missing.push("Title");
  if (!input.purchasePrice) missing.push("Purchase price");
  if (!input.estimatedGdv) missing.push("Estimated GDV");
  if (!input.refurbBudget) missing.push("Refurb budget");
  if (!input.region) missing.push("Region");
  if (!input.propertyCondition) missing.push("Property condition");

  return missing;
}

function getDealRecommendation(roiResult: RoiEngineResult): DealScoreResult["recommendation"] {
  if (roiResult.investment_score >= 8 && roiResult.roi >= 20) {
    return "Strong";
  }

  if (roiResult.investment_score >= 6.5 && roiResult.roi >= 12) {
    return "Consider";
  }

  if (roiResult.investment_score >= 5 && roiResult.roi >= 5) {
    return "Watch";
  }

  return "Reject";
}
