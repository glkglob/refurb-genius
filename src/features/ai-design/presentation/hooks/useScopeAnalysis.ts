/**
 * AI-design slice — Scope analysis mutation hook.
 * Moved from `src/hooks/useScopeAnalysis.ts` (now a shim).
 */
import { useMutation } from "@tanstack/react-query";
import { runScopeAnalysisServerFn } from "../serverFns";
import type { ScopeAnalysisInput, ScopeAnalysisResult } from "../../domain";

export function useScopeAnalysis() {
  return useMutation<ScopeAnalysisResult, Error, ScopeAnalysisInput>({
    mutationFn: (input) => runScopeAnalysisServerFn({ data: input }),
  });
}
