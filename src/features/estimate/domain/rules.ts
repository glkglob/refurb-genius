/**
 * Estimate slice — Domain rules.
 *
 * Pure functions over domain types. Deliberately small: all cost, ROI, and
 * multiplier math is the shared kernel's job (`runPricingEngine` /
 * `roiEngine` in @repo/services, pinned by invariant tests). Rules here are
 * slice-specific judgements that the kernel does not own.
 */
import type { RefurbEstimate, RefurbLineItem } from "./types";

/** Sum of line-item totals — convenience for presentation, not authority. */
export function lineItemsTotal(items: RefurbLineItem[]): number {
  return items.reduce((sum, item) => sum + item.total, 0);
}

/** An estimate is actionable when it priced at least one category. */
export function isActionableEstimate(estimate: RefurbEstimate): boolean {
  return estimate.pricing.lineItems.length > 0 && estimate.pricing.mid_total > 0;
}
