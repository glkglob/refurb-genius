/**
 * Estimate slice — Application ports.
 *
 * Every IO concern the use cases need is expressed as an interface here.
 * Implementations live in `../infrastructure`; tests pass fakes.
 */
import type { PricingEngineResult } from "../domain";

export type SavedEstimateRef = {
  estimateId: string;
};

export interface EstimateRepository {
  /** Persist a priced estimate (header + line items) for a project. */
  saveProjectEstimate(projectId: string, result: PricingEngineResult): Promise<SavedEstimateRef>;
}
