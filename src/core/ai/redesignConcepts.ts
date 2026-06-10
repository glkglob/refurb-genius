/**
 * Legacy shim — moved to the ai-design feature slice presentation layer.
 * TODO(feature-slice): delete once no importers remain.
 */
export {
  redesignProvider,
  mockRedesignProvider,
  listRedesignConcepts,
  generateRedesignConcepts,
  REDESIGN_CONCEPTS,
  REDESIGN_STYLES,
  type RedesignInput,
  type RedesignProvider,
} from "@/features/ai-design/presentation/redesign.provider";

export type { RedesignConcept, RedesignStyle } from "@/features/ai-design/domain";
