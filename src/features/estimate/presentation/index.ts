/**
 * Estimate slice — Presentation surface.
 */
export { generateEstimateServerFn } from "./serverFns";
export { useGenerateEstimate, useSaveAIEstimate, useRoomEstimate } from "./hooks/useEstimate";
export {
  useApplyPhotoAnalysesToEstimate,
  type ApplyPhotoAnalysesToEstimateResult,
} from "./hooks/useApplyPhotoAnalysesToEstimate";
export type { GenerateEstimateInput, AIGeneratedRoom, AIGeneratedItem } from "../domain";
