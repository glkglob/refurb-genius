/**
 * Estimate application wrapper for measured-BOQ authority pricing.
 *
 * Pure: no IO, React, hooks, or persistence.
 * Money calculation is entirely delegated to runMeasuredBoqEngine.
 */
import {
  runMeasuredBoqEngine,
  type MeasuredBoqEngineInput,
  type MeasuredBoqIssue,
  type MeasuredBoqPricingResult,
} from "@repo/services";

import type { EstimateSource } from "../domain";

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
 */
export function repriceMeasuredBoq(input: MeasuredBoqEngineInput): RepriceMeasuredBoqResult {
  const outcome = runMeasuredBoqEngine(input);

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
