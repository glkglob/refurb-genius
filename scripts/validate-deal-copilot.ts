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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

// Dynamic import to avoid circular dependencies
async function loadModules() {
  const { analyzeDeal } = await import(
    path.join(projectRoot, "src/lib/deal-copilot/dealAnalysis.ts")
  );
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

    // Exit status
    const allPassed = results.every((r) => r.status === "PASS");
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("❌ Validation runner error:", error);
    process.exit(1);
  }
}

main();
