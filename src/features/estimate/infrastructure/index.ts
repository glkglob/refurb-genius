/**
 * Estimate slice — infrastructure public surface (browser-safe).
 *
 * The AI adapter (`adapters/ai-estimate.adapter.server.ts`) and catalogue
 * loader (`catalogue/measuredBoqCatalogue.repository.server.ts`) are
 * deliberately NOT exported here: they are server-only and must be reached
 * via dynamic `import()` inside server handlers only.
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
