/**
 * Formatting helpers for display layer.
 * Pure functions; no calculations or business logic.
 */

import { formatGBP } from "@/lib/utils";

export function formatCurrency(value: number | undefined): string {
  return formatGBP(value ?? null);
}

export function formatPercent(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  return `${value.toFixed(1)}%`;
}

export function formatWeeks(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  const weeks = Math.round(value);
  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}

export function formatRecommendation(recommendation: string): {
  label: string;
  color: "success" | "warning" | "info" | "error";
} {
  switch (recommendation) {
    case "Strong":
      return { label: "Strong opportunity", color: "success" };
    case "Consider":
      return { label: "Worth considering", color: "info" };
    case "Watch":
      return { label: "Watch list", color: "warning" };
    case "Reject":
      return { label: "Not recommended", color: "error" };
    case "Incomplete":
      return { label: "Incomplete analysis", color: "info" };
    default:
      return { label: recommendation, color: "info" };
  }
}

export function formatRiskLevel(riskLevel: string | undefined): {
  label: string;
  color: "success" | "warning" | "error";
  icon: "check" | "alert" | "x";
} {
  switch (riskLevel) {
    case "Low":
      return { label: "Low risk", color: "success", icon: "check" };
    case "Moderate":
      return { label: "Moderate risk", color: "warning", icon: "alert" };
    case "High":
      return { label: "High risk", color: "error", icon: "x" };
    default:
      return { label: "Unknown", color: "warning", icon: "alert" };
  }
}

export function formatInvestmentScore(score: number | undefined): string {
  if (score === undefined || score === null) return "—";
  return `${score.toFixed(1)}/10`;
}

export function formatROI(roi: number | undefined): string {
  if (roi === undefined || roi === null) return "—";
  return formatPercent(roi);
}

export function formatProfit(profit: number | undefined): string {
  if (profit === undefined || profit === null) return "—";
  if (profit < 0) {
    return `−${formatCurrency(Math.abs(profit))}`;
  }
  return formatCurrency(profit);
}

export function formatYield(yield_pct: number | undefined): string {
  if (yield_pct === undefined || yield_pct === null) return "—";
  return formatPercent(yield_pct);
}

export function formatArea(sqm: number | undefined): string {
  if (sqm === undefined || sqm === null) return "—";
  return `${sqm.toLocaleString("en-GB")} m²`;
}

export function formatMonthly(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  return `${formatCurrency(value)}/month`;
}

export function formatAnnual(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  return `${formatCurrency(value)}/year`;
}
