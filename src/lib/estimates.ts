/**
 * Legacy shim — implementation moved to the estimate feature slice.
 * Import from `@/features/estimate/infrastructure` in new code.
 * TODO(feature-slice): delete once no importers remain.
 */
export {
  saveProjectEstimate,
  getLatestProjectEstimate,
  persistedEstimateInput,
  saveAIEstimate,
  getLatestRoomEstimate,
  type PersistedProjectEstimate,
  type PersistedRoomEstimate,
  type SaveAIEstimateInput,
} from "@/features/estimate/infrastructure/repositories/estimate.repository";
