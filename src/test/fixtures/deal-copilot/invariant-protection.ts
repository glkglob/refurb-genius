/**
 * Invariant Protection Tests for Deal Copilot Lite
 *
 * Automated checks that the pricing → ROI invariant cannot be regressed.
 * DC-R1: empty / zero pricing must not become ready authority; when ready,
 * ROI refurb_budget is always pricing.mid_total with no user-budget fallback.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ParsedDealFormData, DealAnalysisResult } from "@repo/types";
import { PRICING_AUTHORITY_CATEGORIES } from "./standard-flip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// fixtures live at src/test/fixtures/deal-copilot → project root is 4 levels up
const DEAL_ANALYSIS_SOURCE = path.join(
  __dirname,
  "../../../../src/lib/deal-copilot/dealAnalysis.ts",
);

function readDealAnalysisSource(): string {
  return readFileSync(DEAL_ANALYSIS_SOURCE, "utf8");
}

/**
 * TEST 1: ROI BLOCKED IF PRICING SCOPE EMPTY / FAILS
 */
export function testRoiBlockedIfPricingFails(
  analyzeDeal: (data: ParsedDealFormData) => DealAnalysisResult,
  _mockPricingEngine: (shouldFail: boolean) => void,
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const emptyScope: ParsedDealFormData = {
    title: "Test property",
    purchasePrice: 300000,
    refurbBudget: 50000,
    estimatedGdv: 400000,
    rentalIncome: 1500,
    holdingCosts: 8000,
    region: "London",
    propertyCondition: "Average",
    selectedCategories: [],
  };

  const result = analyzeDeal(emptyScope);
  if (result.ready) {
    errors.push("Empty pricing scope must not produce ready=true analysis");
  }
  if (result.roi != null) {
    errors.push("Empty pricing scope must not emit ROI");
  }
  if (result.pricing != null) {
    errors.push("Empty pricing scope must not expose authoritative pricing");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * TEST 2: ROI BLOCKED IF pricing.mid_total IS NOT MEANINGFUL
 */
export function testRoiBlockedIfPricingMidTotalIsNull(
  analyzeDeal: (data: ParsedDealFormData) => DealAnalysisResult,
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const source = readDealAnalysisSource();

  if (!source.includes("isPricingAuthoritative") && !/mid_total\s*>\s*0/.test(source)) {
    errors.push(
      "dealAnalysis.ts must gate on meaningful mid_total (> 0) or isPricingAuthoritative",
    );
  }

  // Empty categories → non-ready (covers zero mid_total promotion path)
  const empty: ParsedDealFormData = {
    title: "mid-total gate",
    purchasePrice: 180000,
    refurbBudget: 40000,
    estimatedGdv: 250000,
    rentalIncome: 1200,
    holdingCosts: 6000,
    region: "Yorkshire and the Humber",
    propertyCondition: "Average",
    selectedCategories: [],
  };
  const analysis = analyzeDeal(empty);
  if (analysis.ready || analysis.roi != null) {
    errors.push("Non-meaningful pricing must block ROI (ready=false, roi=null)");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * TEST 3: ROI CONSUMES pricing.mid_total ONLY (ready path)
 */
export function testRoiConsumesOnlyPricingMidTotal(
  analyzeDeal?: (data: ParsedDealFormData) => DealAnalysisResult,
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const source = readDealAnalysisSource();

  if (!/refurb_budget:\s*pricing\.mid_total\b/.test(source)) {
    errors.push("dealAnalysis.ts must map refurb_budget directly from pricing.mid_total");
  }

  for (const forbidden of [
    "pricing.mid_total ?? formData.refurbBudget",
    "pricing.mid_total || formData.refurbBudget",
    "formData.refurbBudget ?? pricing.mid_total",
    "formData.refurbBudget || pricing.mid_total",
  ]) {
    if (source.includes(forbidden)) {
      errors.push(`FORBIDDEN FALLBACK: ${forbidden}`);
    }
  }

  if (analyzeDeal) {
    const input: ParsedDealFormData = {
      title: "Authority map",
      purchasePrice: 350000,
      refurbBudget: 55000,
      estimatedGdv: 475000,
      rentalIncome: 1500,
      holdingCosts: 8000,
      region: "London",
      propertyCondition: "Average",
      selectedCategories: PRICING_AUTHORITY_CATEGORIES,
      propertySize: 100,
    };
    const result = analyzeDeal(input);
    if (!result.ready || !result.roi || !result.pricing) {
      errors.push("Meaningful categories must produce ready pricing-authoritative analysis");
    } else if (result.roi.inputs.refurb_budget !== result.pricing.mid_total) {
      errors.push(
        `ROI refurb ${result.roi.inputs.refurb_budget} !== mid_total ${result.pricing.mid_total}`,
      );
    } else if (result.roi.inputs.refurb_budget === input.refurbBudget) {
      errors.push("ROI must not consume user-entered refurbBudget when pricing is authoritative");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * TEST 4: NO FALLBACK LOGIC ALLOWED
 */
export function testNoFallbackLogicAllowed(patterns: string[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const source = readDealAnalysisSource();
  const forbiddenPatterns = [
    "pricing.mid_total ?? formData.refurbBudget",
    "pricing.mid_total || formData.refurbBudget",
    "formData.refurbBudget ?? pricing.mid_total",
    "formData.refurbBudget || pricing.mid_total",
    "pricing?.mid_total ?? formData.refurbBudget",
    "pricing?.mid_total || formData.refurbBudget",
    ...patterns,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern && source.includes(pattern)) {
      errors.push(`FORBIDDEN PATTERN DETECTED: ${pattern}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * TEST 5: AI PROVIDER ISOLATION (source-level)
 * Deal Copilot orchestration must not import AI adapters into the money path.
 */
export function testAiProviderIsolation(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const source = readDealAnalysisSource();

  const banned = ["openai", "generateText", "useGenerateEstimate", "aiOpinion", "@ai-sdk"];
  for (const token of banned) {
    if (source.toLowerCase().includes(token.toLowerCase())) {
      errors.push(`AI token found in dealAnalysis.ts: ${token}`);
    }
  }

  if (!source.includes("runPricingEngine") || !source.includes("runRoiEngine")) {
    errors.push("dealAnalysis must compose runPricingEngine + runRoiEngine only");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Run all 5 invariant protection tests
 */
export function runAllInvariantTests(
  analyzeDeal: (data: ParsedDealFormData) => DealAnalysisResult,
): {
  tests: Array<{
    name: string;
    valid: boolean;
    errors: string[];
  }>;
  allPassed: boolean;
} {
  const tests = [
    {
      name: "TEST 1: ROI Blocked If Pricing Fails",
      ...testRoiBlockedIfPricingFails(analyzeDeal, () => {}),
    },
    {
      name: "TEST 2: ROI Blocked If pricing.mid_total Is Null",
      ...testRoiBlockedIfPricingMidTotalIsNull(analyzeDeal),
    },
    {
      name: "TEST 3: ROI Consumes pricing.mid_total ONLY",
      ...testRoiConsumesOnlyPricingMidTotal(analyzeDeal),
    },
    {
      name: "TEST 4: No Fallback Logic Allowed",
      ...testNoFallbackLogicAllowed([]),
    },
    {
      name: "TEST 5: AI Provider Isolation",
      ...testAiProviderIsolation(),
    },
  ];

  const allPassed = tests.every((t) => t.valid);

  return {
    tests,
    allPassed,
  };
}
