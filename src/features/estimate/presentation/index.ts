/**
 * Estimate slice — Presentation surface.
 */
export { generateEstimateServerFn } from "./serverFns";
export { useGenerateEstimate, useSaveAIEstimate, useRoomEstimate } from "./hooks/useEstimate";
export type {
  GenerateEstimateInput,
  AIGeneratedRoom,
  AIGeneratedItem,
} from "../infrastructure/adapters/ai-estimate.adapter.server";
