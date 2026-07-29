/**
 * Presentation-safe deal opportunity update mutation (AO-1M5).
 *
 * Owns:
 * - useMutation lifecycle
 * - repository delegation
 * - success-only invalidation of ["opportunities"]
 * - mapped DealOpportunity result propagation
 *
 * Persistence: dealOpportunityRepository.updateOpportunity (infrastructure).
 * No auth gate, optimistic cache, toast, logging, or navigation.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DealOpportunity } from "@repo/types";
import { dealOpportunityRepository } from "../../infrastructure/dealOpportunityRepository";

export interface UpdateOpportunityVariables {
  id: string;
  updates: Partial<Omit<DealOpportunity, "id" | "createdAt" | "updatedAt">>;
}

/**
 * Partial update of a deal opportunity.
 *
 * Single-key React Query authority: invalidates ["opportunities"] on success only.
 * Detail reads continue to derive from the list cache (useOpportunity).
 */
export function useUpdateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: UpdateOpportunityVariables) =>
      dealOpportunityRepository.updateOpportunity({
        id,
        updates,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
}
