/**
 * AI-design slice — infrastructure public surface (browser-safe).
 *
 * OpenAI adapters are server-only — reach them via dynamic `import()` in serverFns.
 */
export {
  SupabaseScopeAnalysisRepository,
  supabaseScopeAnalysisRepository,
  saveScopeAnalysis,
  getLatestScopeAnalysis,
  type PersistedScopeAnalysis,
  type SaveScopeAnalysisInput,
} from "./repositories/scope-analysis.repository";
