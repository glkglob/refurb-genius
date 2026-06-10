/**
 * Estimate slice — Application service.
 *
 * Groups the slice's use cases behind one interface (the `IEstimateService`
 * pattern). Handlers/serverFns depend on this interface; tests pass a fake.
 */
import {
  makeCreateEstimate,
  type CreateEstimateCommand,
  type CreateEstimateResult,
} from "./createEstimate";
import type { EstimateRepository } from "./ports";

export interface EstimateService {
  createEstimate(command: CreateEstimateCommand): Promise<CreateEstimateResult>;
}

export type EstimateServiceDeps = {
  estimates: EstimateRepository;
};

export function makeEstimateService(deps: EstimateServiceDeps): EstimateService {
  return {
    createEstimate: makeCreateEstimate(deps),
  };
}
