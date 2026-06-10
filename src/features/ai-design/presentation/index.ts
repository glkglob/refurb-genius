/**
 * AI-design slice — Presentation surface.
 */
export { generateRedesignConceptsServerFn, runScopeAnalysisServerFn } from "./serverFns";
export {
  redesignProvider,
  mockRedesignProvider,
  listRedesignConcepts,
  generateRedesignConcepts,
  REDESIGN_CONCEPTS,
  REDESIGN_STYLES,
  type RedesignInput,
  type RedesignProvider,
} from "./redesign.provider";
export { useScopeAnalysis } from "./hooks/useScopeAnalysis";
export { useSavedScopeAnalysis, useSaveScopeAnalysis } from "./hooks/useScopeAnalysisPersistence";
export { RedesignCard } from "./components";
