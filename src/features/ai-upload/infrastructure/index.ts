/**
 * AI-upload slice — infrastructure public surface (browser-safe).
 *
 * The Vision adapter (`adapters/ai-vision.adapter.server.ts`) is deliberately
 * NOT exported here: it is server-only and must be reached via dynamic
 * `import()` inside serverFn handlers.
 */
export {
  SupabaseRoomAnalysisRepository,
  supabaseRoomAnalysisRepository,
  analysisStore,
} from "./repositories/room-analysis.repository";
export {
  BrowserPhotoCatalogRepository,
  browserPhotoCatalogRepository,
} from "./repositories/photo-catalog.repository";
