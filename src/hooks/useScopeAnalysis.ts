import { useMutation } from "@tanstack/react-query";
import { runScopeAnalysisServerFn } from "@/core/ai/serverFns";
import type {
  ScopeAnalysisInput,
  ScopeAnalysisResult,
} from "@/core/ai/server/openAiScopeAnalysis.server";

/**
 * Mutation: analyse property photos and generate a professional
 * condition report with costed scope of works.
 */
export function useScopeAnalysis() {
  return useMutation<ScopeAnalysisResult, Error, ScopeAnalysisInput>({
    mutationFn: (input) => runScopeAnalysisServerFn({ data: input }),
  });
}
