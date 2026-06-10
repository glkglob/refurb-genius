/**
 * Legacy shim — implementation moved to the estimate feature slice.
 * Import from `@/features/estimate` in new code.
 * TODO(feature-slice): delete once no importers remain.
 */
export {
  useGenerateEstimate,
  useSaveAIEstimate,
  useRoomEstimate,
} from "@/features/estimate/presentation/hooks/useEstimate";
