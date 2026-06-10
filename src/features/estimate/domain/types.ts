/**
 * Estimate slice — Domain entities and value types.
 *
 * Pure types only — no IO, no frameworks. Region/condition/finish/category
 * unions come from `@repo/types` (the canonical source) rather than being
 * re-declared here, so the slice can never drift from the kernel.
 */
import type { ConditionLevel, EstimateCategory, FinishLevel, UKRegion } from "@repo/types";
import type { PricingEngineInputs, PricingEngineResult, PricingLineItem } from "@repo/services";

/** The property being estimated, as the estimate capability sees it. */
export type Property = {
  id: string;
  address?: string;
  postcode?: string;
  /** Free-form in current data ("terraced house", "flat", …). */
  type: string;
  sizeSqm?: number;
  bedrooms: number;
  bathrooms?: number;
  condition: ConditionLevel;
  region: UKRegion;
};

/**
 * A priced refurbishment estimate. The cost breakdown is the deterministic
 * engine's result verbatim — the slice never recomputes or reshapes totals
 * (see the pricing invariant tests).
 */
export type RefurbEstimate = {
  id: string;
  projectId: string;
  pricing: PricingEngineResult;
  createdAt: Date;
};

/** One costed line of an estimate (kernel shape, aliased for slice code). */
export type RefurbLineItem = PricingLineItem;

/** The engine's input contract, aliased for slice code. */
export type RefurbEstimateInputs = PricingEngineInputs;

export type { ConditionLevel, EstimateCategory, FinishLevel, UKRegion };
