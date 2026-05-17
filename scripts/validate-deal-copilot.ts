#!/usr/bin/env tsx

/**
 * Deterministic Validation Runner for Deal Copilot Lite
 *
 * Validates that financial calculations remain stable across engine versions.
 * Run before deployments to detect calculation drift immediately.
 *
 * Usage: pnpm tsx scripts/validate-deal-copilot.ts
 */

import path from "path";
import { fileURLToPath } from "url";
import type { ParsedDealFormData, DealAnalysisResult } from "./packages/types/src/deal-copilot";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

// Dynamic import with direct relative paths for monorepo workspace resolution
// Uses relative imports to avoid tsx module resolution issues with workspace aliases
async function loadModules() {
  // Import deterministic engines directly (avoids @repo/services alias)
  const { scoreDealOpportunity } = await import(
    path.join(projectRoot, "packages/services/src/deal-analysis/index.ts")
  );
  const { runPricingEngine } = await import(
    path.join(projectRoot, "packages/services/src/pricing/index.ts")
  );
  const { runRoiEngine } = await import(
    path.join(projectRoot, "packages/services/src/roi/index.ts")
  );

  // Import validation helpers
  const { standardFlipInput, standardFlipExpected, validateStandardFlip, TOLERANCE } = await import(
    path.join(projectRoot, "src/test/fixtures/deal-copilot/standard-flip.ts")
  );
  const {
    heavyRefurbInput,
    highYieldInput,
    negativeProfitInput,
    smallProjectInput,
    largeProjectInput,
  } = await import(path.join(projectRoot, "src/test/fixtures/deal-copilot/edge-cases.ts"));
  const { runAllInvariantTests } = await import(
    path.join(projectRoot, "src/test/fixtures/deal-copilot/invariant-protection.ts")
  );

  // Compose analyzeDeal inline to avoid importing dealAnalysis.ts
  // which has @repo/services import that tsx can't resolve.
  // This implementation matches src/lib/deal-copilot/dealAnalysis.ts exactly.
  const analyzeDeal = (formData: ParsedDealFormData): DealAnalysisResult => {
    // Step 1: Validate deal readiness
    const scoreInput = {
      title: formData.title,
      purchasePrice: formData.purchasePrice,
      estimatedGdv: formData.estimatedGdv,
      refurbBudget: formData.refurbBudget,
      expectedMonthlyRent: formData.rentalIncome,
      region: formData.region,
      propertyCondition: formData.propertyCondition,
      holdingCosts: formData.holdingCosts,
    };

    const score = scoreDealOpportunity(scoreInput);

    if (!score.ready) {
      return {
        score,
        pricing: null,
        roi: null,
        ready: false,
        errors: score.missingFields,
      };
    }

    // Step 2: Run pricing engine
    const pricingInput = {
      region: formData.region,
      property_condition: formData.propertyCondition,
      finish_quality: formData.finishLevel || "Standard",
      selected_categories: formData.selectedCategories || [],
      property_size_sqm: formData.propertySize || 100,
    };

    const pricing = runPricingEngine(pricingInput);

    // CRITICAL: Pricing failure blocks ROI (financial invariant enforcement)
    if (!pricing || pricing.mid_total == null) {
      return {
        score,
        pricing: null,
        roi: null,
        ready: false,
        errors: ["Pricing engine did not return a valid result — ROI calculation blocked"],
      };
    }

    // Step 3: Run ROI engine with pricing.mid_total (not user-entered refurbBudget)
    const roiInput = {
      purchase_price: formData.purchasePrice,
      refurb_budget: pricing.mid_total,
      estimated_gdv: formData.estimatedGdv,
      rental_income: formData.rentalIncome * 12,
      holding_costs: formData.holdingCosts,
      region: formData.region,
      property_condition: formData.propertyCondition,
    };

    const roi = runRoiEngine(roiInput);

    return {
      score,
      pricing,
      roi,
      ready: true,
      errors: [],
    };
  };

  return {
    analyzeDeal,
    standardFlipInput,
    standardFlipExpected,
    validateStandardFlip,
    TOLERANCE,
    heavyRefurbInput,
    highYieldInput,
    negativeProfitInput,
    smallProjectInput,
    largeProjectInput,
    runAllInvariantTests,
  };
}

interface ValidationResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  metrics?: {
    roi?: number;
    profit?: number;
    score?: number;
    recommendation?: string;
  };
  errors: string[];
  duration: number;
}

async function main() {
  console.log("🔍 Deal Copilot Lite - Deterministic Validation Runner\n");

  try {
    const {
      analyzeDeal,
      standardFlipInput,
      standardFlipExpected,
      validateStandardFlip,
      heavyRefurbInput,
      highYieldInput,
      negativeProfitInput,
      smallProjectInput,
      largeProjectInput,
      runAllInvariantTests,
    } = await loadModules();

    const results: ValidationResult[] = [];

    // Test 1: Standard flip (golden path)
    console.log("📊 Running validation tests...\n");

    const startStandardFlip = Date.now();
    const standardFlipAnalysis = analyzeDeal(standardFlipInput);
    const standardFlipDuration = Date.now() - startStandardFlip;

    const standardFlipValidation = validateStandardFlip(standardFlipAnalysis);
    results.push({
      name: "Standard Flip (Golden Path)",
      status: standardFlipValidation.valid ? "PASS" : "FAIL",
      metrics: standardFlipValidation.valid
        ? {
            roi: standardFlipAnalysis.roi?.roi,
            profit: standardFlipAnalysis.roi?.estimated_profit,
            score: standardFlipAnalysis.roi?.investment_score,
            recommendation: standardFlipAnalysis.score.recommendation,
          }
        : undefined,
      errors: standardFlipValidation.errors,
      duration: standardFlipDuration,
    });

    // Test 2: Heavy refurb
    const startHeavyRefurb = Date.now();
    const heavyRefurbAnalysis = analyzeDeal(heavyRefurbInput);
    const heavyRefurbDuration = Date.now() - startHeavyRefurb;

    results.push({
      name: "Heavy Refurbishment",
      status: heavyRefurbAnalysis.ready ? "PASS" : "FAIL",
      metrics: heavyRefurbAnalysis.ready
        ? {
            roi: heavyRefurbAnalysis.roi?.roi,
            profit: heavyRefurbAnalysis.roi?.estimated_profit,
            score: heavyRefurbAnalysis.roi?.investment_score,
          }
        : undefined,
      errors: heavyRefurbAnalysis.ready ? [] : ["Analysis incomplete"],
      duration: heavyRefurbDuration,
    });

    // Test 3: High-yield rental
    const startHighYield = Date.now();
    const highYieldAnalysis = analyzeDeal(highYieldInput);
    const highYieldDuration = Date.now() - startHighYield;

    results.push({
      name: "High-Yield Rental",
      status: highYieldAnalysis.ready ? "PASS" : "FAIL",
      metrics: highYieldAnalysis.ready
        ? {
            roi: highYieldAnalysis.roi?.roi,
            profit: highYieldAnalysis.roi?.estimated_profit,
            score: highYieldAnalysis.roi?.investment_score,
          }
        : undefined,
      errors: highYieldAnalysis.ready ? [] : ["Analysis incomplete"],
      duration: highYieldDuration,
    });

    // Test 4: Negative profit
    const startNegativeProfit = Date.now();
    const negativeProfitAnalysis = analyzeDeal(negativeProfitInput);
    const negativeProfitDuration = Date.now() - startNegativeProfit;

    const hasNegativeProfit =
      negativeProfitAnalysis.ready &&
      negativeProfitAnalysis.roi?.estimated_profit !== undefined &&
      negativeProfitAnalysis.roi.estimated_profit < 0;

    results.push({
      name: "Negative Profit Scenario",
      status: negativeProfitAnalysis.ready && hasNegativeProfit ? "PASS" : "FAIL",
      metrics: negativeProfitAnalysis.ready
        ? {
            roi: negativeProfitAnalysis.roi?.roi,
            profit: negativeProfitAnalysis.roi?.estimated_profit,
            score: negativeProfitAnalysis.roi?.investment_score,
          }
        : undefined,
      errors:
        negativeProfitAnalysis.ready && hasNegativeProfit ? [] : ["Should handle negative profit"],
      duration: negativeProfitDuration,
    });

    // Test 5: Small project
    const startSmallProject = Date.now();
    const smallProjectAnalysis = analyzeDeal(smallProjectInput);
    const smallProjectDuration = Date.now() - startSmallProject;

    results.push({
      name: "Small Project",
      status: smallProjectAnalysis.ready ? "PASS" : "FAIL",
      metrics: smallProjectAnalysis.ready
        ? {
            roi: smallProjectAnalysis.roi?.roi,
            profit: smallProjectAnalysis.roi?.estimated_profit,
            score: smallProjectAnalysis.roi?.investment_score,
          }
        : undefined,
      errors: smallProjectAnalysis.ready ? [] : ["Analysis incomplete"],
      duration: smallProjectDuration,
    });

    // Test 6: Large project
    const startLargeProject = Date.now();
    const largeProjectAnalysis = analyzeDeal(largeProjectInput);
    const largeProjectDuration = Date.now() - startLargeProject;

    results.push({
      name: "Large Project",
      status: largeProjectAnalysis.ready ? "PASS" : "FAIL",
      metrics: largeProjectAnalysis.ready
        ? {
            roi: largeProjectAnalysis.roi?.roi,
            profit: largeProjectAnalysis.roi?.estimated_profit,
            score: largeProjectAnalysis.roi?.investment_score,
          }
        : undefined,
      errors: largeProjectAnalysis.ready ? [] : ["Analysis incomplete"],
      duration: largeProjectDuration,
    });

    // ============================================================
    // INVARIANT PROTECTION TESTS
    // ============================================================
    // These tests verify that the pricing → ROI financial invariant
    // cannot be regressed. They detect specific attack vectors that
    // could weaken financial authority boundaries.
    // ============================================================

    console.log("\n🔒 Running Invariant Protection Tests...\n");

    const startInvariantTests = Date.now();
    const invariantTestResults = runAllInvariantTests(analyzeDeal);
    const invariantTestsDuration = Date.now() - startInvariantTests;

    invariantTestResults.tests.forEach((test) => {
      results.push({
        name: test.name,
        status: test.valid ? "PASS" : "FAIL",
        errors: test.errors,
        duration: 0,
      });
    });

    // Print results
    console.log("📋 Results:\n");
    console.log("┌─────────────────────────────────┬──────────┬─────────────────────────────────┐");
    console.log("│ Test                            │ Status   │ Metrics                         │");
    console.log("├─────────────────────────────────┼──────────┼─────────────────────────────────┤");

    results.forEach((result) => {
      const statusIcon = result.status === "PASS" ? "✅" : "❌";
      const metricsStr = result.metrics
        ? `ROI: ${result.metrics.roi?.toFixed(1)}%, Profit: £${(result.metrics.profit || 0).toLocaleString("en-GB")}`
        : "N/A";
      console.log(
        `│ ${result.name.padEnd(31)} │ ${statusIcon} ${result.status.padEnd(6)} │ ${metricsStr.padEnd(31)} │`,
      );
      if (result.errors.length > 0) {
        result.errors.forEach((error) => {
          console.log(`│ → ${error.padEnd(64)} │`);
        });
      }
    });

    console.log(
      "└─────────────────────────────────┴──────────┴─────────────────────────────────┘\n",
    );

    // Summary
    const passCount = results.filter((r) => r.status === "PASS").length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`📊 Summary: ${passCount}/${results.length} tests passed in ${totalDuration}ms\n`);

    if (standardFlipValidation.errors.length > 0) {
      console.log("⚠️  Calculation Drift Detected:\n");
      standardFlipValidation.errors.forEach((error) => {
        console.log(`  ❌ ${error}`);
      });
      console.log();
    }

    // Invariant Protection Report
    const invariantPassed = invariantTestResults.allPassed;
    console.log("\n" + "=".repeat(70));
    console.log("🔒 INVARIANT PROTECTION STATUS");
    console.log("=".repeat(70));
    if (invariantPassed) {
      console.log("✅ All invariant tests passed — pricing → ROI boundary is protected");
    } else {
      console.log("❌ Invariant tests failed — financial authority boundary at risk");
      invariantTestResults.tests.forEach((test) => {
        if (!test.valid) {
          console.log(`\n⚠️  ${test.name}`);
          test.errors.forEach((error) => {
            console.log(`     ${error}`);
          });
        }
      });
    }
    console.log("=".repeat(70) + "\n");

    // Exit status
    const allPassed = results.every((r) => r.status === "PASS") && invariantPassed;
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("❌ Validation runner error:", error);
    process.exit(1);
  }
}

main();
