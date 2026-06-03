// AI domain contracts (analysis, scope, estimates, redesign).
// These are the canonical shapes consumed across the platform (UI, services, reports).
// Source of truth for structured outputs lives in src/core/ai/validation.ts + server modules.
// Re-exported here so @repo/* packages and external consumers have a stable import without
// pulling root app code. (During migration some shapes still originate from root lib/analysis.)

// Re-export the core analysis types (shapes + enums) from the app surface.
// In a stricter future these would be defined here with zero deps and mirrored.
export type {
  RoomAnalysis,
  RoomType,
  ConditionLevel,
  RefurbLevel,
  AnalysisSource,
} from "@/lib/analysis";

// Scope / Estimate / Redesign shapes are still defined in the server modules for now
// (to avoid duplicating complex Zod-backed interfaces during incremental Phase 1-2).
// Consumers should import the *Result types via the app re-exports until fully migrated.
export type {
  ScopeAnalysisResult,
  ScopeRoom,
  ScopeIssue,
  ScopeRecommendedItem,
} from "@/core/ai/server/openAiScopeAnalysis.server";

export type {
  AIGeneratedRoom,
  AIGeneratedItem,
  GenerateEstimateInput,
} from "@/core/ai/server/openAiEstimate.server";

export type { RedesignConcept, RedesignStyle } from "@/lib/redesign";

// Validation helpers (safe parsers) are app-internal for serverFns but the schemas
// can be referenced for docs/tests.
export {
  roomAnalysisSchema,
  scopeAnalysisResultSchema,
  aiEstimateResponseSchema,
  redesignConceptTextSchema,
} from "@/core/ai/validation";
