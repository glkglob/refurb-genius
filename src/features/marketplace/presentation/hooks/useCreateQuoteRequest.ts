/**
 * Presentation-safe quote-request creation (AO-1B2).
 *
 * Owns mutation orchestration and exact project quote-request invalidation.
 * Delegates persistence to src/lib/marketplace-write.ts createQuoteRequest.
 * Does not own toasts, form state, or raw Supabase clients.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createQuoteRequest } from "@/lib/marketplace-write";
import { marketplaceKeys } from "@/lib/queries/marketplace";

export interface CreateQuoteRequestMutationInput {
  tradespersonId: string;
  title: string;
  message: string;
  /** When omitted or empty, project_id is persisted as "" (current product semantics). */
  projectId?: string;
  proposedPrice?: number;
}

/**
 * Mutation hook for creating a quote request for the signed-in user.
 * Pass the same userId from useAuth (hook-level identity is authoritative).
 */
export function useCreateQuoteRequest(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, CreateQuoteRequestMutationInput>({
    mutationFn: async (input) => {
      if (!userId?.trim()) {
        throw new Error("You must be signed in");
      }
      await createQuoteRequest({
        userId,
        tradespersonId: input.tradespersonId,
        projectId: input.projectId ?? "",
        title: input.title,
        message: input.message,
        proposedPrice: input.proposedPrice,
      });
    },
    retry: false,
    onSuccess: (_data, input) => {
      const projectId = input.projectId?.trim();
      if (projectId) {
        // Insert success is authoritative; invalidation must not become user-facing failure.
        void queryClient.invalidateQueries({
          queryKey: marketplaceKeys.quoteRequestsByProject(projectId),
        });
      }
    },
  });
}
