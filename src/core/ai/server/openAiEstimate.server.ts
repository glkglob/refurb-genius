/**
 * Legacy shim — implementation moved to the estimate feature slice.
 * New code: dynamic-import
 * `@/features/estimate/infrastructure/adapters/ai-estimate.adapter.server`.
 * TODO(feature-slice): delete once no importers remain.
 */
export {
  runSecureEstimateGeneration,
  type GenerateEstimateInput,
  type AIGeneratedRoom,
  type AIGeneratedItem,
} from "@/features/estimate/infrastructure/adapters/ai-estimate.adapter.server";
