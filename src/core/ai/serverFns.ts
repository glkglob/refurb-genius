/**
 * Legacy AI serverFns barrel — RPC surfaces moved to feature slices.
 * TODO(feature-slice): delete once no importers remain.
 */

export { runPhotoAnalysisServerFn } from "@/features/ai-upload/presentation/serverFns";

export {
  generateRedesignConceptsServerFn,
  runScopeAnalysisServerFn,
} from "@/features/ai-design/presentation/serverFns";

export { generateEstimateServerFn } from "@/features/estimate/presentation/serverFns";

export { roomAnalysisOutputSchema } from "@/features/ai-upload/presentation/serverFns";
