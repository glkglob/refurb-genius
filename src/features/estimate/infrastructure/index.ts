/**
 * Estimate slice — infrastructure public surface (browser-safe).
 *
 * The AI adapter (`adapters/ai-estimate.adapter.server.ts`) is deliberately
 * NOT exported here: it is server-only and must be reached via dynamic
 * `import()` inside serverFn handlers.
 */
export {
  SupabaseEstimateRepository,
  supabaseEstimateRepository,
  saveProjectEstimate,
  getLatestProjectEstimate,
  persistedEstimateInput,
  saveAIEstimate,
  getLatestRoomEstimate,
  type PersistedProjectEstimate,
  type PersistedRoomEstimate,
  type SaveAIEstimateInput,
} from "./repositories/estimate.repository";
