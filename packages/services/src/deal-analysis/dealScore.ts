import { runRoiEngine, type RoiEngineResult } from "../roi";
import type { ConditionLevel } from "@/features/ai-upload/domain";
import type { UKRegion } from "@/lib/projects";
import type { DealOpportunityInput } from "@repo/types";

export type DealScoreInput = DealOpportunityInput & {
  region: UKRegion;
  propertyCondition: ConditionLevel;
  holdingCosts?: number;
};

export type DealScoreResult = {
  ready: boolean;
  /** Convenience accessor for roiResult.investment_score; null when not ready. */
  score: number | null;
  missingFields: string[];
  roiResult: RoiEngineResult | null;
  recommendation: "Incomplete" | "Reject" | "Watch" | "Consider" | "Strong";
  /** Human-readable explanation of the recommendation band. Empty for Incomplete. */
  reasons: string[];
};

export function scoreDealOpportunity(input: DealScoreInput): DealScoreResult {
  const missingFields = getMissingDealFields(input);

  if (missingFields.length > 0) {
    return {
      ready: false,
      score: null,
      missingFields,
      roiResult: null,
      recommendation: "Incomplete",
      reasons: [],
    };
  }

  const expectedAnnualRent =
    input.expectedMonthlyRent === undefined ? undefined : input.expectedMonthlyRent * 12;

  const roiResult = runRoiEngine({
    purchase_price: input.purchasePrice!,
    refurb_budget: input.refurbBudget!,
    estimated_gdv: input.estimatedGdv!,
    rental_income: 0,
    projected_rental_income: expectedAnnualRent,
    holding_costs: input.holdingCosts ?? 0,
    region: input.region,
    property_condition: input.propertyCondition,
  });

  const recommendation = getDealRecommendation(roiResult);

  return {
    ready: true,
    score: roiResult.investment_score,
    missingFields: [],
    roiResult,
    recommendation,
    reasons: getDealReasons(recommendation, roiResult),
  };
}

export function getMissingDealFields(input: DealScoreInput): string[] {
  const missing: string[] = [];

  if (!input.title?.trim()) missing.push("Title");
  if (!input.purchasePrice || input.purchasePrice <= 0) missing.push("Purchase price");
  if (!input.estimatedGdv || input.estimatedGdv <= 0) missing.push("Estimated GDV");
  if (!input.refurbBudget || input.refurbBudget <= 0) missing.push("Refurb budget");
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

function getDealReasons(
  recommendation: DealScoreResult["recommendation"],
  roiResult: RoiEngineResult | null,
): string[] {
  if (recommendation === "Incomplete" || roiResult === null) return [];
  const s = roiResult.investment_score.toFixed(1);
  const r = roiResult.roi.toFixed(1);
  switch (recommendation) {
    case "Strong":
      return [`Investment score ${s}/10, ROI ${r}% — above Strong thresholds`];
    case "Consider":
      return [`Investment score ${s}/10, ROI ${r}% — meets Consider thresholds`];
    case "Watch":
      return [`Investment score ${s}/10, ROI ${r}% — marginal, watch closely`];
    case "Reject":
      return [`Investment score ${s}/10, ROI ${r}% — below minimum thresholds`];
  }
}
