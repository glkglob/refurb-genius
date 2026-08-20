/**
 * AI-design slice — Presentation surface.
 */
export {
  generateRedesignConceptsServerFn,
  listRedesignConceptsServerFn,
  selectRedesignConceptServerFn,
  runScopeAnalysisServerFn,
} from "./serverFns";
export { listRedesignConceptsForClient } from "./listRedesignConceptsForClient";
export { runScopeAnalysisForClient } from "./runScopeAnalysisForClient";
export { generateRedesignConceptsForClient } from "./generateRedesignConceptsForClient";
export { selectRedesignConceptForClient } from "./selectRedesignConceptForClient";
export {
  redesignProvider,
  mockRedesignProvider,
  listRedesignConcepts,
  generateRedesignConcepts,
  clearRedesignConceptsCache,
  REDESIGN_CONCEPTS,
  REDESIGN_STYLES,
  type RedesignInput,
  type RedesignProvider,
} from "./redesign.provider";
export { useScopeAnalysis } from "./hooks/useScopeAnalysis";
export { useSavedScopeAnalysis, useSaveScopeAnalysis } from "./hooks/useScopeAnalysisPersistence";
export { RedesignCard } from "./components";
