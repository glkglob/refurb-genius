/**
 * Estimate application wrapper for measured-BOQ authority pricing.
 *
 * Pure: no IO, React, hooks, or persistence.
 * Money calculation is entirely delegated to runMeasuredBoqEngine.
 * Library rates are resolved only via the caller-supplied trusted dependency.
 */
import {
  runMeasuredBoqEngine,
  type MeasuredBoqEngineDependencies,
  type MeasuredBoqEngineInput,
  type MeasuredBoqIssue,
  type MeasuredBoqPricingResult,
} from "@repo/services";

import type { EstimateSource } from "../domain";

export type RepriceMeasuredBoqDependencies = MeasuredBoqEngineDependencies;

export type RepriceMeasuredBoqResult =
  | {
      status: "authority-priced";
      source: Extract<EstimateSource, "engine">;
      pricing: MeasuredBoqPricingResult;
      issues: [];
    }
  | {
      status: "draft";
      source: Extract<EstimateSource, "ai-assisted" | "fallback">;
      pricing: null;
      issues: MeasuredBoqIssue[];
    };

/**
 * Reprice a measured BOQ input through the deterministic engine.
 * Does not accept caller totals. Does not persist.
 * Passes the trusted library dependency through unchanged.
 */
export function repriceMeasuredBoq(
  input: MeasuredBoqEngineInput,
  dependencies: RepriceMeasuredBoqDependencies,
): RepriceMeasuredBoqResult {
  const outcome = runMeasuredBoqEngine(input, dependencies);

  if (outcome.status === "authority-priced") {
    return {
      status: "authority-priced",
      source: "engine",
      pricing: outcome.pricing,
      issues: [],
    };
  }

  const hasAi = outcome.issues.some((i) => i.code === "INELIGIBLE_AI_RATE");
  return {
    status: "draft",
    source: hasAi ? "ai-assisted" : "fallback",
    pricing: null,
    issues: outcome.issues,
  };
}
