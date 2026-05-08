// Investor metrics derived from a project + an estimate. Pure functions so the
// report page can reuse them.
import type { Project } from "./projects";
import type { EstimateResult } from "./estimate";

export type RiskLevel = "Low" | "Moderate" | "High";

export type InvestorMetrics = {
  refurb_budget: number;       // mid_total
  total_cost: number;          // purchase + refurb
  estimated_profit: number;    // gdv - total_cost
  roi: number;                 // %
  rental_uplift_monthly: number;
  rental_uplift_annual: number;
  yield_pct: number;           // gross yield on total cost
  investment_score: number;    // 1..10
  risk_level: RiskLevel;
};

export function calculateInvestorMetrics(
  project: Project,
  estimate: EstimateResult,
): InvestorMetrics {
  const refurb_budget = estimate.mid_total;
  const total_cost = project.purchase_price + refurb_budget;
  const estimated_profit = project.estimated_gdv - total_cost;
  const roi = total_cost > 0 ? (estimated_profit / total_cost) * 100 : 0;

  // Rental uplift: ~£12/sqm/month base, scaled by finish multiplier and bedrooms.
  const finishBoost =
    estimate.inputs.finish === "Premium" ? 1.25
    : estimate.inputs.finish === "Standard" ? 1.0
    : 0.85;
  const baseMonthly = project.size_sqm * 12 * finishBoost;
  const bedroomBoost = 1 + (project.bedrooms - 1) * 0.05;
  const rental_uplift_monthly = Math.round(baseMonthly * bedroomBoost * 0.18); // ~18% uplift vs current
  const rental_uplift_annual = rental_uplift_monthly * 12;

  const annualGross = Math.round(rental_uplift_monthly * 12 / 0.18); // implied full rent
  const yield_pct = total_cost > 0 ? (annualGross / total_cost) * 100 : 0;

  // Score: ROI weighted 70%, yield 30%, capped 1..10.
  const roiScore = Math.max(0, Math.min(10, roi / 3));        // 30% ROI ≈ 10
  const yieldScore = Math.max(0, Math.min(10, yield_pct));    // 10% yield ≈ 10
  const raw = roiScore * 0.7 + yieldScore * 0.3;
  const investment_score = Math.max(1, Math.min(10, +raw.toFixed(1)));

  const risk_level: RiskLevel =
    investment_score >= 7.5 ? "Low"
    : investment_score >= 5 ? "Moderate"
    : "High";

  return {
    refurb_budget,
    total_cost,
    estimated_profit,
    roi: +roi.toFixed(1),
    rental_uplift_monthly,
    rental_uplift_annual,
    yield_pct: +yield_pct.toFixed(1),
    investment_score,
    risk_level,
  };
}
