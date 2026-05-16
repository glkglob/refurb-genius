// Deterministic refurbishment pricing engine.
//
// Single source of truth for all refurb cost math. No AI, no randomness —
// given the same inputs, returns the same outputs. Pages and components
// must call `runPricingEngine` instead of recomputing totals locally.
import {
  CATEGORY_BASE,
  REGION_MULTIPLIERS,
  CONDITION_MULTIPLIERS,
  FINISH_MULTIPLIERS,
  type EstimateCategory,
  type FinishLevel,
} from "./pricingData";
import type { UKRegion } from "@/lib/projects";
import type { ConditionLevel } from "@/lib/analysis";

export const VAT_RATE = 0.2;
export const CONTINGENCY_RATE = 0.1;

/** Floor area at which CATEGORY_BASE costs are calibrated (m²). */
export const REFERENCE_SIZE_SQM = 90;
/** Clamp the size multiplier so very small / very large jobs stay sane. */
const MIN_SIZE_MULT = 0.7;
const MAX_SIZE_MULT = 1.8;

export type PricingEngineInputs = {
  region: UKRegion;
  property_condition: ConditionLevel;
  finish_quality: FinishLevel;
  selected_categories: EstimateCategory[];
  property_size_sqm: number;
};

export type PricingEstimateItem = {
  category: EstimateCategory;
  labour: number;
  materials: number;
  total: number;
  weeks: number;
};

export type PricingEngineResult = {
  inputs: PricingEngineInputs;
  multiplier: number;
  size_multiplier: number;
  estimate_items: PricingEstimateItem[];
  labour_total: number;
  materials_total: number;
  subtotal: number;
  contingency: number;
  vat: number;
  low_total: number;
  mid_total: number;
  high_total: number;
  timeline_weeks: number;
};

const round10 = (n: number) => Math.round(n / 10) * 10;

function baseMultiplier(inputs: PricingEngineInputs): number {
  return (
    REGION_MULTIPLIERS[inputs.region] *
    CONDITION_MULTIPLIERS[inputs.property_condition] *
    FINISH_MULTIPLIERS[inputs.finish_quality]
  );
}

function baseEstimateItems(inputs: PricingEngineInputs, multiplier: number): PricingEstimateItem[] {
  const condition = CONDITION_MULTIPLIERS[inputs.property_condition];
  return inputs.selected_categories.map((category) => {
    const base = CATEGORY_BASE[category];
    const labour = round10(base.labour * multiplier);
    const materials = round10(base.materials * multiplier);
    return {
      category,
      labour,
      materials,
      total: labour + materials,
      weeks: +(base.weeks * Math.max(0.8, condition)).toFixed(1),
    };
  });
}

/** Linear scaling around the reference size, clamped to a sensible band. */
export function sizeMultiplier(sqm: number): number {
  if (!Number.isFinite(sqm) || sqm <= 0) return 1;
  const raw = sqm / REFERENCE_SIZE_SQM;
  return Math.min(MAX_SIZE_MULT, Math.max(MIN_SIZE_MULT, raw));
}

/**
 * Run the deterministic pricing engine.
 *
 * Pipeline: regional × condition × finish × size scaling applied to each
 * selected category's base labour/materials, then VAT and contingency are
 * layered on top of the subtotal. Low/high bands bracket the mid total.
 */
export function runPricingEngine(inputs: PricingEngineInputs): PricingEngineResult {
  const sizeMult = sizeMultiplier(inputs.property_size_sqm);
  const multiplier = baseMultiplier(inputs);
  const baseItems = baseEstimateItems(inputs, multiplier);

  const estimate_items: PricingEstimateItem[] = baseItems.map((i) => {
    const labour = round10(i.labour * sizeMult);
    const materials = round10(i.materials * sizeMult);
    return {
      category: i.category,
      labour,
      materials,
      total: labour + materials,
      weeks: +(i.weeks * Math.max(0.85, Math.min(1.4, sizeMult))).toFixed(1),
    };
  });

  const labour_total = estimate_items.reduce((s, i) => s + i.labour, 0);
  const materials_total = estimate_items.reduce((s, i) => s + i.materials, 0);
  const subtotal = labour_total + materials_total;
  const contingency = Math.round(subtotal * CONTINGENCY_RATE);
  const vat = Math.round((subtotal + contingency) * VAT_RATE);
  const mid_total = subtotal + contingency + vat;
  const low_total = Math.round(mid_total * 0.85);
  const high_total = Math.round(mid_total * 1.15);

  const sumWeeks = estimate_items.reduce((s, i) => s + i.weeks, 0);
  const timeline_weeks = Math.max(
    estimate_items.length ? Math.ceil(Math.max(...estimate_items.map((i) => i.weeks))) : 0,
    Math.ceil(sumWeeks * 0.6),
  );

  return {
    inputs,
    multiplier: +(multiplier * sizeMult).toFixed(3),
    size_multiplier: +sizeMult.toFixed(3),
    estimate_items,
    labour_total,
    materials_total,
    subtotal,
    contingency,
    vat,
    low_total,
    mid_total,
    high_total,
    timeline_weeks,
  };
}

// Re-export shared lookup tables and types so callers have a single import.
export { CATEGORY_BASE, REGION_MULTIPLIERS, CONDITION_MULTIPLIERS, FINISH_MULTIPLIERS };
export type { EstimateCategory, FinishLevel };
