// Multi-step AI orchestration (Phase 1 stub).
// Intended flows:
// - runVisionThenScope(input) → vision + scope (pass room context)
// - runScopeThenEstimate(scope, extra) → normalized estimate suggestions
// - runFullRefurbIntel({photos, property, mode}) → {analysis, scope, estimate, redesign}
//
// For now this is a non-breaking placeholder. Real chaining added incrementally
// after UI controls and normalizers are ready. Existing direct serverFns remain primary.

import type { ScopeAnalysisInput, ScopeAnalysisResult } from "../server/openAiScopeAnalysis.server";
import type { GenerateEstimateInput, AIGeneratedRoom } from "../server/openAiEstimate.server";

export type AIOrchestrationMode = "fast" | "balanced" | "high-quality";

export async function runVisionThenScope(
  _input: ScopeAnalysisInput,
  _mode: AIOrchestrationMode = "balanced",
): Promise<ScopeAnalysisResult> {
  // Placeholder: real impl will call vision internally (or reuse photo analyses)
  // then feed summaries into scope prompt for better context.
  // For now, callers should continue using runScopeAnalysisServerFn directly.
  throw new Error("orchestrator not wired yet — use runScopeAnalysisServerFn + existing vision");
}

export async function runScopeThenEstimate(
  _scope: ScopeAnalysisResult,
  _base: Omit<GenerateEstimateInput, "requirements">,
  _mode: AIOrchestrationMode = "balanced",
): Promise<AIGeneratedRoom[]> {
  // Placeholder: map scope rooms/issues to estimate seed, call enhanced estimate,
  // then normalize costs via pricing authority.
  throw new Error(
    "orchestrator not wired yet — use generateEstimateServerFn + AIEstimateBuilder normalizer",
  );
}

export type FullIntelResult = {
  scope?: ScopeAnalysisResult;
  estimate?: AIGeneratedRoom[];
  // redesign etc later
  warnings: string[];
  modelUsed?: string;
  cached?: boolean;
};

export async function runFullRefurbIntel(_input: {
  projectId: string;
  photos: unknown[];
  property: unknown;
  mode?: AIOrchestrationMode;
}): Promise<FullIntelResult> {
  // Heavy path stub. When wired: Railway primary or chained TS with cache.
  return { warnings: ["orchestrator stub — full intel not yet implemented"] };
}
