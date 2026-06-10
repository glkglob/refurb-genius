/**
 * Estimate slice — CreateEstimate use case.
 *
 * Orchestrates one business operation: price the inputs with the
 * deterministic engine, persist the result. No vendor code, no React —
 * dependencies arrive through ports, so this is unit-testable with fakes.
 */
import { runPricingEngine, type PricingEngineInputs, type PricingEngineResult } from "../domain";
import type { EstimateRepository, SavedEstimateRef } from "./ports";

export type CreateEstimateCommand = {
  projectId: string;
  inputs: PricingEngineInputs;
};

export type CreateEstimateResult = {
  pricing: PricingEngineResult;
  saved: SavedEstimateRef;
};

export type CreateEstimateDeps = {
  estimates: EstimateRepository;
};

export function makeCreateEstimate({ estimates }: CreateEstimateDeps) {
  return async function createEstimate(
    command: CreateEstimateCommand,
  ): Promise<CreateEstimateResult> {
    const pricing = runPricingEngine(command.inputs);
    const saved = await estimates.saveProjectEstimate(command.projectId, pricing);
    return { pricing, saved };
  };
}
