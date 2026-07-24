/**
 * Pure Projects estimators (no IO).
 * Algorithms preserved from the former src/lib/projects.ts definitions (C4a).
 */
import type { Project } from "./types";

// Derived helpers used across dashboards/reports. Estimate ~= 15% of GDV
// until AI estimate runs; profit = GDV - purchase - estimated refurb.
export function estimatedRefurbCost(p: Project): number {
  return Math.round(p.estimated_gdv * 0.15);
}

export function estimatedProfit(p: Project): number {
  return p.estimated_gdv - p.purchase_price - estimatedRefurbCost(p);
}
