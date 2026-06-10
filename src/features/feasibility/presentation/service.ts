import { makeFeasibilityService } from "../application";
import {
  emptyExportCapability,
  estimateCapability,
  photoAnalysisCapability,
  roiCapability,
  scopeCapability,
  supabaseFeasibilityRepository,
} from "../infrastructure";

export function createDefaultFeasibilityService() {
  return makeFeasibilityService({
    repository: supabaseFeasibilityRepository,
    analysisAgent: photoAnalysisCapability,
    scopeAgent: scopeCapability,
    estimateAgent: estimateCapability,
    roiAgent: roiCapability,
    exports: emptyExportCapability,
  });
}

export const defaultFeasibilityService = createDefaultFeasibilityService();
