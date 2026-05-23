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

export type PricingLineItem = {
  category: EstimateCategory;
  labour: number;
  materials: number;
  total: number;
  weeks: number;
};

/** @deprecated use PricingLineItem */
export type PricingEstimateItem = PricingLineItem;

export type PricingEngineResult = {
  inputs: PricingEngineInputs;
  multiplier: number;
  size_multiplier: number;
  lineItems: PricingLineItem[];
  labour_total: number;
  materials_total: number;
  subtotal: number;
  contingency: number;
  vat: number;
  low_total: number;
  mid_total: number;
  high_total: number;
  timeline_weeks: number;
  confidence: "low" | "medium" | "high";
  assumptions: string[];
  warnings: string[];
};

const round10 = (n: number) => Math.round(n / 10) * 10;

function baseMultiplier(inputs: PricingEngineInputs): number {
  return (
    REGION_MULTIPLIERS[inputs.region] *
    CONDITION_MULTIPLIERS[inputs.property_condition] *
    FINISH_MULTIPLIERS[inputs.finish_quality]
  );
}

function baseEstimateItems(inputs: PricingEngineInputs, multiplier: number): PricingLineItem[] {
  const condition = CONDITION_MULTIPLIERS[inputs.property_condition];
  return inputs.selected_categories.map((category) => {
    const base = CATEGORY_BASE[category];
    const labour = base.labour * multiplier;
    const materials = base.materials * multiplier;
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

  const lineItems: PricingLineItem[] = baseItems.map((i) => {
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

  const labour_total = lineItems.reduce((s, i) => s + i.labour, 0);
  const materials_total = lineItems.reduce((s, i) => s + i.materials, 0);
  const subtotal = labour_total + materials_total;
  const contingency = Math.round(subtotal * CONTINGENCY_RATE);
  const vat = Math.round((subtotal + contingency) * VAT_RATE);
  const mid_total = subtotal + contingency + vat;
  const low_total = Math.round(mid_total * 0.85);
  const high_total = Math.round(mid_total * 1.15);

  const sumWeeks = lineItems.reduce((s, i) => s + i.weeks, 0);
  const timeline_weeks = Math.max(
    lineItems.length ? Math.ceil(Math.max(...lineItems.map((i) => i.weeks))) : 0,
    Math.ceil(sumWeeks * 0.6),
  );

  return {
    inputs,
    multiplier: +(multiplier * sizeMult).toFixed(3),
    size_multiplier: +sizeMult.toFixed(3),
    lineItems,
    labour_total,
    materials_total,
    subtotal,
    contingency,
    vat,
    low_total,
    mid_total,
    high_total,
    timeline_weeks,
    confidence: computeConfidence(inputs),
    assumptions: buildAssumptions(inputs, sizeMult),
    warnings: buildWarnings(inputs, sizeMult),
  };
}

function computeConfidence(inputs: PricingEngineInputs): PricingEngineResult["confidence"] {
  const n = inputs.selected_categories.length;
  if (n === 0) return "low";
  if (n >= 3) return "high";
  return "medium";
}

function buildAssumptions(inputs: PricingEngineInputs, sizeMult: number): string[] {
  const assumptions: string[] = [];
  assumptions.push(`Region: ${inputs.region}`);
  assumptions.push(`Property condition: ${inputs.property_condition}`);
  assumptions.push(`Finish quality: ${inputs.finish_quality}`);
  if (inputs.selected_categories.length === 0) {
    assumptions.push(
      "No refurbishment categories selected — estimate based on regional averages only",
    );
  }
  if (sizeMult === 1) {
    assumptions.push(
      `Property size not provided — using reference size of ${REFERENCE_SIZE_SQM}m²`,
    );
  } else {
    assumptions.push(
      `Property size: ${inputs.property_size_sqm}m² (reference ${REFERENCE_SIZE_SQM}m²)`,
    );
  }
  return assumptions;
}

function buildWarnings(inputs: PricingEngineInputs, sizeMult: number): string[] {
  const warnings: string[] = [];
  if (inputs.selected_categories.length === 0) {
    warnings.push("Select refurbishment categories to generate a detailed line-item estimate");
  }
  if (sizeMult >= 1.75) {
    warnings.push("Very large property — size multiplier capped; actual costs may be higher");
  }
  if (sizeMult <= 0.72) {
    warnings.push("Very small property — minimum cost band applied");
  }
  if (inputs.property_condition === "Full Renovation Needed") {
    warnings.push("Full renovation condition applied — higher contingency is strongly recommended");
  }
  return warnings;
}

// ──────────────────────────────────────────────────────────────
// AI estimate helpers — per-item calculation for AI-generated rooms.
// These use the same REGION_MULTIPLIERS as the deterministic engine
// so all pricing flows stay consistent.
// ──────────────────────────────────────────────────────────────

/** Look up the regional multiplier for a UK region. Returns 1.0 for unknown. */
export function getRegionalMultiplier(region: string): number {
  return REGION_MULTIPLIERS[region as UKRegion] ?? 1.0;
}

/** A single AI-generated line item before regional adjustment. */
export type AILineItemInput = {
  name: string;
  category?: string;
  quantity: number;
  unit?: string;
  base_unit_cost: number;
  notes?: string;
};

/** A line item after regional adjustment. */
export type CalculatedLineItem = AILineItemInput & {
  unit_cost: number;
  total_cost: number;
  is_ai_suggested?: boolean;
};

/** Apply a regional multiplier to a base-cost line item. */
export function calculateLineItem(
  item: AILineItemInput,
  multiplier: number,
): CalculatedLineItem {
  const unit_cost = Math.round(item.base_unit_cost * multiplier * 100) / 100;
  const total_cost = Math.round(item.quantity * unit_cost * 100) / 100;
  return { ...item, unit_cost, total_cost };
}

/** Subtotal + VAT for a flat list of already-calculated items. */
export function calculateEstimateTotals(
  items: CalculatedLineItem[],
  vatRate = 20,
) {
  const subtotal = items.reduce((s, i) => s + i.total_cost, 0);
  const vat_amount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
  const total = Math.round((subtotal + vat_amount) * 100) / 100;
  return { subtotal, vat_amount, total };
}

// Re-export shared lookup tables and types so callers have a single import.
export { CATEGORY_BASE, REGION_MULTIPLIERS, CONDITION_MULTIPLIERS, FINISH_MULTIPLIERS };
export type { EstimateCategory, FinishLevel };
