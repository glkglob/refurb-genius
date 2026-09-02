/**
 * AI-design slice — Scope analysis mutation hook.
 * Moved from `src/hooks/useScopeAnalysis.ts` (now a shim).
 */
import { useMutation } from "@tanstack/react-query";
import type { ScopeAnalysisInput, ScopeAnalysisResult } from "../../domain";
import { runScopeAnalysisForClient } from "../runScopeAnalysisForClient";

export function useScopeAnalysis() {
  return useMutation<ScopeAnalysisResult, Error, ScopeAnalysisInput>({
    mutationFn: (input) => runScopeAnalysisForClient(input),
  });
}
