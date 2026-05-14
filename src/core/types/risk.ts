import type { ProductId } from "../platform/products";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type RiskCategory =
  | "planning"
  | "construction"
  | "financial"
  | "legal"
  | "market"
  | "programme"
  | "unknown";

export type RiskSourceProductId = Extract<
  ProductId,
  "deal-copilot" | "refurb-iq" | "trades-marketplace"
>;

export type RiskItem = {
  id: string;
  title: string;
  description?: string;
  category: RiskCategory;
  level: RiskLevel;
  sourceProductId: RiskSourceProductId;
  createdAt?: string;
  updatedAt?: string;
};

export type RiskSummary = {
  total: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
};

export function createEmptyRiskSummary(): RiskSummary {
  return {
    total: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
}

export function summariseRisks(risks: RiskItem[]): RiskSummary {
  return risks.reduce<RiskSummary>((summary, risk) => {
    summary.total += 1;
    summary[risk.level] += 1;
    return summary;
  }, createEmptyRiskSummary());
}
