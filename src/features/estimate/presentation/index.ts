/**
 * Estimate slice — Presentation surface.
 */
export { generateEstimateServerFn } from "./serverFns";
export { useGenerateEstimate, useSaveAIEstimate, useRoomEstimate } from "./hooks/useEstimate";
export {
  useApplyPhotoAnalysesToEstimate,
  type ApplyPhotoAnalysesToEstimateResult,
} from "./hooks/useApplyPhotoAnalysesToEstimate";
export {
  useSaveEstimateBuilder,
  type SaveEstimateBuilderVariables,
  type UseSaveEstimateBuilderOptions,
  type UseSaveEstimateBuilderResult,
  type EstimateBuilderOptimisticRoom,
  type EstimateBuilderOptimisticItem,
} from "./hooks/useSaveEstimateBuilder";
export {
  useAIEstimateBuilderSave,
  type UseAIEstimateBuilderSaveOptions,
  type SaveAIEstimateBuilderSnapshot,
  type UseAIEstimateBuilderSaveResult,
} from "./hooks/useAIEstimateBuilderSave";
export type { GenerateEstimateInput, AIGeneratedRoom, AIGeneratedItem } from "../domain";
