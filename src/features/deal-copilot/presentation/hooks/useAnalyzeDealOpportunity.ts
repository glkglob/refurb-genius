/**
 * Presentation-safe deal analysis mutation (AO-1M6).
 *
 * Owns:
 * - useMutation lifecycle
 * - analyzeDealServerFn invocation
 * - success analytics (deal_analyzed)
 * - result / error / pending propagation
 *
 * Does not own QueryClient cache operations, browser Supabase, navigation,
 * toast, or AI/provider configuration (serverFn + adapter).
 */
import { useMutation } from "@tanstack/react-query";
import { analyzeDealServerFn } from "@/serverFns/dealAnalysis";
import { trackEvent } from "@/lib/analytics";

export interface AnalyzeDealOpportunityVariables {
  opportunityId: string;
  promptContext?: string;
}

/**
 * Run AI deal analysis for an opportunity via the existing server function.
 *
 * Mutation-cache only: no product query invalidation or optimistic writes.
 * Success analytics fire once per successful mutation lifecycle.
 */
export function useAnalyzeDealOpportunity() {
  return useMutation({
    mutationFn: (variables: AnalyzeDealOpportunityVariables) =>
      analyzeDealServerFn({
        data: variables,
      }),
    onSuccess: () => {
      trackEvent("deal_analyzed");
    },
  });
}
