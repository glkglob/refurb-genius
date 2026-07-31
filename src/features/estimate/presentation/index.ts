/**
 * Estimate slice — Presentation surface.
 */
export { generateEstimateServerFn, saveAuthorityCategoryEstimateServerFn } from "./serverFns";
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

/** L1 progressive estimate UI */
export {
  CostSummary,
  type CostSummaryProps,
  type CostSummaryConfidence,
} from "./components/CostSummary";
export { L1EstimateForm, type L1EstimateFormProps } from "./components/L1EstimateForm";
