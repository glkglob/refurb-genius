/**
 * AI-design slice — RunScopeAnalysis use case.
 */
import type { ScopeAnalysisInput, ScopeAnalysisResult } from "../domain";
import type { AiScopePort } from "./ports";

export type RunScopeAnalysisCommand = ScopeAnalysisInput;

export type RunScopeAnalysisDeps = {
  scope: AiScopePort;
};

export function makeRunScopeAnalysis({ scope }: RunScopeAnalysisDeps) {
  return async function runScopeAnalysis(
    command: RunScopeAnalysisCommand,
  ): Promise<ScopeAnalysisResult> {
    return scope.analyzeScope(command);
  };
}
