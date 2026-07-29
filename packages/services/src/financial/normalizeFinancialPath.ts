/**
 * Canonical Financial Path Normalizer (P0-1).
 *
 * Converts product/application financial inputs into runRoiEngine inputs
 * under an explicit, testable Financials-path policy. Calculation authority
 * remains runRoiEngine — this module does not reimplement ROI formulas.
 *
 * Scope: Financials query path policy. Does not declare universal product defaults.
 */
import { CONDITION_LEVELS, UK_REGIONS, type ConditionLevel, type UKRegion } from "@repo/types";

import { runRoiEngine, type RoiEngineInputs, type RoiEngineResult } from "../roi";

/** Loose product/application input shape (camel + snake aliases). */
export type FinancialPathInput = {
  purchasePrice?: number | null;
  purchase_price?: number | null;
  estimatedGdv?: number | null;
  estimated_gdv?: number | null;
  /** Application camelCase refurb budget (alias). */
  refurbBudget?: number | null;
  /** Engine snake_case refurb budget (alias). */
  refurb_budget?: number | null;
  /** Estimate mid_total — Financials-path refurb authority when present. */
  mid_total?: number | null;
  propertyCondition?: ConditionLevel | string | null;
  property_condition?: ConditionLevel | string | null;
  holdingCosts?: number | null;
  holding_costs?: number | null;
  /** Pre-refurb annual rental (£). */
  rentalIncomeAnnual?: number | null;
  rental_income?: number | null;
  /** Post-refurb annual rental (£). */
  projected_rental_income?: number | null;
  /** Monthly rent — converts to projected annual only when annual projected is absent. */
  expectedMonthlyRent?: number | null;
  region?: UKRegion | string | null;
  /** Timeline weeks fallback for Financials view (not an ROI engine input). */
  timelineWeeks?: number | null;
};

/** Explicit Financials-path defaults (not universal product policy). */
export type FinancialPathPolicy = {
  defaultRegion: UKRegion;
  defaultPropertyCondition: ConditionLevel;
  defaultHoldingCosts: number;
  defaultRentalIncome: number;
  defaultTimelineWeeks: number;
};

export const FINANCIALS_PATH_DEFAULT_POLICY: FinancialPathPolicy = {
  defaultRegion: "London",
  defaultPropertyCondition: "Average",
  defaultHoldingCosts: 0,
  defaultRentalIncome: 0,
  defaultTimelineWeeks: 8,
};

export type FinancialPathMeta = {
  usedDefaults: string[];
  warnings: string[];
};

export type NormalizedFinancialPath = {
  roiInputs: RoiEngineInputs;
  /** Weeks for Financials DTO; default policy unless caller supplies. */
  timelineWeeks: number;
  meta: FinancialPathMeta;
};

/**
 * Financials view model aligned with src/lib/queries/projects.ts Financials.
 * Money fields in pounds; roiPercent preserves engine one-decimal precision.
 */
export type FinancialPathFinancials = {
  purchasePrice: number;
  estimatedGdv: number;
  refurbBudget: number;
  totalProjectCost: number;
  estimatedProfit: number;
  roiPercent: number;
  grossYield: number;
  investmentScore: number;
  riskLevel: string;
  timelineWeeks: number;
};

export type FinancialPathResult = {
  roiInputs: RoiEngineInputs;
  roiResult: RoiEngineResult;
  financials: FinancialPathFinancials;
  meta: FinancialPathMeta;
};

const REGION_SET = new Set<string>(UK_REGIONS);
const CONDITION_SET = new Set<string>(CONDITION_LEVELS);

/**
 * Coerce optional money-like values. null/undefined/NaN/±Infinity → absent.
 * Finite numbers (including 0 and negatives) are preserved.
 */
function coerceFiniteMoney(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function pickAliasMoney(
  canonical: unknown,
  alias: unknown,
  field: string,
  meta: FinancialPathMeta,
): number | undefined {
  const c = coerceFiniteMoney(canonical);
  const a = coerceFiniteMoney(alias);
  if (c !== undefined && a !== undefined && c !== a) {
    meta.warnings.push(
      `conflicting ${field}: canonical and alias differ; using canonical (${c}) over alias (${a})`,
    );
    return c;
  }
  if (c !== undefined) return c;
  return a;
}

function resolveRegion(
  raw: unknown,
  policy: FinancialPathPolicy,
  meta: FinancialPathMeta,
): UKRegion {
  if (typeof raw === "string" && REGION_SET.has(raw)) {
    return raw as UKRegion;
  }
  if (raw != null && raw !== "") {
    meta.warnings.push(`invalid region ${String(raw)}; using default ${policy.defaultRegion}`);
  }
  meta.usedDefaults.push("region");
  return policy.defaultRegion;
}

function resolveCondition(
  canonical: unknown,
  alias: unknown,
  policy: FinancialPathPolicy,
  meta: FinancialPathMeta,
): ConditionLevel {
  const c = typeof canonical === "string" && CONDITION_SET.has(canonical) ? canonical : undefined;
  const a = typeof alias === "string" && CONDITION_SET.has(alias) ? alias : undefined;
  if (c && a && c !== a) {
    meta.warnings.push(`conflicting property_condition: using canonical (${c}) over alias (${a})`);
  }
  if (c) return c as ConditionLevel;
  if (a) return a as ConditionLevel;
  if (canonical != null && canonical !== "") {
    meta.warnings.push(
      `invalid property_condition ${String(canonical)}; using default ${policy.defaultPropertyCondition}`,
    );
  } else if (alias != null && alias !== "") {
    meta.warnings.push(
      `invalid propertyCondition ${String(alias)}; using default ${policy.defaultPropertyCondition}`,
    );
  }
  meta.usedDefaults.push("property_condition");
  return policy.defaultPropertyCondition;
}

/**
 * Resolve refurbishment cost for Financials path.
 * mid_total (estimate) is authority when present; otherwise refurb_budget / refurbBudget.
 */
function resolveRefurbBudget(input: FinancialPathInput, meta: FinancialPathMeta): number {
  const mid = coerceFiniteMoney(input.mid_total);
  if (mid !== undefined) {
    const snake = coerceFiniteMoney(input.refurb_budget);
    const camel = coerceFiniteMoney(input.refurbBudget);
    if (snake !== undefined && snake !== mid) {
      meta.warnings.push(
        `mid_total (${mid}) is Financials refurb authority; ignoring conflicting refurb_budget (${snake})`,
      );
    } else if (camel !== undefined && camel !== mid) {
      meta.warnings.push(
        `mid_total (${mid}) is Financials refurb authority; ignoring conflicting refurbBudget (${camel})`,
      );
    }
    return mid;
  }
  return pickAliasMoney(input.refurb_budget, input.refurbBudget, "refurb_budget", meta) ?? 0;
}

/**
 * Convert product inputs into canonical RoiEngineInputs under Financials policy.
 */
export function normalizeFinancialPath(
  input: FinancialPathInput,
  policy: FinancialPathPolicy = FINANCIALS_PATH_DEFAULT_POLICY,
): NormalizedFinancialPath {
  const meta: FinancialPathMeta = { usedDefaults: [], warnings: [] };

  const purchase =
    pickAliasMoney(input.purchase_price, input.purchasePrice, "purchase_price", meta) ?? 0;
  if (
    coerceFiniteMoney(input.purchase_price) === undefined &&
    coerceFiniteMoney(input.purchasePrice) === undefined
  ) {
    // missing purchase → 0 (incomplete-project tolerance); not a named default
  }

  const estimatedGdv =
    pickAliasMoney(input.estimated_gdv, input.estimatedGdv, "estimated_gdv", meta) ?? 0;

  const refurbBudget = resolveRefurbBudget(input, meta);
  if (
    coerceFiniteMoney(input.mid_total) === undefined &&
    coerceFiniteMoney(input.refurb_budget) === undefined &&
    coerceFiniteMoney(input.refurbBudget) === undefined
  ) {
    // 0 when no estimate — preserves current financialsQueryOptions semantics
  }

  const holding = pickAliasMoney(input.holding_costs, input.holdingCosts, "holding_costs", meta);
  let holding_costs: number;
  if (holding === undefined) {
    holding_costs = policy.defaultHoldingCosts;
    meta.usedDefaults.push("holding_costs");
  } else {
    holding_costs = holding;
  }

  const rentalExplicit = pickAliasMoney(
    input.rental_income,
    input.rentalIncomeAnnual,
    "rental_income",
    meta,
  );
  let rental_income: number;
  if (rentalExplicit === undefined) {
    rental_income = policy.defaultRentalIncome;
    meta.usedDefaults.push("rental_income");
  } else {
    rental_income = rentalExplicit;
  }

  // projected annual: explicit projected_rental_income beats monthly conversion
  const projectedExplicit = coerceFiniteMoney(input.projected_rental_income);
  const monthly = coerceFiniteMoney(input.expectedMonthlyRent);
  let projected_rental_income: number | undefined;
  if (projectedExplicit !== undefined) {
    if (monthly !== undefined && Math.abs(projectedExplicit - monthly * 12) > 0.0001) {
      meta.warnings.push(
        `projected_rental_income (${projectedExplicit}) beats expectedMonthlyRent conversion (${monthly * 12})`,
      );
    }
    projected_rental_income = projectedExplicit;
  } else if (monthly !== undefined) {
    projected_rental_income = monthly * 12;
  }

  const region = resolveRegion(input.region, policy, meta);
  const property_condition = resolveCondition(
    input.property_condition,
    input.propertyCondition,
    policy,
    meta,
  );

  const timelineRaw = coerceFiniteMoney(input.timelineWeeks);
  let timelineWeeks: number;
  if (timelineRaw === undefined) {
    timelineWeeks = policy.defaultTimelineWeeks;
    meta.usedDefaults.push("timelineWeeks");
  } else {
    timelineWeeks = Math.round(timelineRaw);
  }

  const roiInputs: RoiEngineInputs = {
    purchase_price: purchase,
    refurb_budget: refurbBudget,
    estimated_gdv: estimatedGdv,
    rental_income,
    holding_costs,
    region,
    property_condition,
  };
  if (projected_rental_income !== undefined) {
    roiInputs.projected_rental_income = projected_rental_income;
  }

  return { roiInputs, timelineWeeks, meta };
}

/**
 * Normalize → runRoiEngine once → Financials DTO (no Math.round on roi).
 */
export function calculateFinancialPath(
  input: FinancialPathInput,
  policy: FinancialPathPolicy = FINANCIALS_PATH_DEFAULT_POLICY,
): FinancialPathResult {
  const { roiInputs, timelineWeeks, meta } = normalizeFinancialPath(input, policy);
  const roiResult = runRoiEngine(roiInputs);

  const financials: FinancialPathFinancials = {
    purchasePrice: roiInputs.purchase_price,
    estimatedGdv: roiInputs.estimated_gdv,
    refurbBudget: roiInputs.refurb_budget,
    totalProjectCost: roiResult.total_project_cost,
    estimatedProfit: roiResult.estimated_profit,
    // Preserve engine one-decimal ROI — do not Math.round.
    roiPercent: roiResult.roi,
    grossYield: roiResult.gross_yield,
    investmentScore: roiResult.investment_score,
    riskLevel: roiResult.risk_level.toLowerCase(),
    timelineWeeks,
  };

  return { roiInputs, roiResult, financials, meta };
}
