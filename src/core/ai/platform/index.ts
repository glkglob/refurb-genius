// AI Platform facade (Phase 1 foundation).
// Goal: single place to orchestrate analysis → scope → estimate → design with
// model selection, validation, caching, retries, and telemetry.
// Current: thin exports + stubs. Callers continue using existing providers/serverFns
// until full migration in later increments.

export { withRetry, classifyError } from "./retry";
export { getCached, setCached, clearProjectCache, getCacheStats } from "./cache";

// Future: model router + prompt registry would live here.
// export { selectModel, getPrompt } from "./modelRouter";
export { runVisionThenScope, runScopeThenEstimate, runFullRefurbIntel } from "./orchestrator";
export type { AIOrchestrationMode, FullIntelResult } from "./orchestrator";
