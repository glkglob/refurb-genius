import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { supabase } from "@/platform/supabase/browser";
import type { DealOpportunity, DealOpportunityStatus, DealExitStrategy } from "@repo/types";
import type { PropertyType } from "@/core/projects/domain";
import type { Tables } from "@repo/supabase";

// Use the protected serverFn for writes (consistent with projects save and auth migration).
import { saveDealOpportunityServerFn } from "@/serverFns/dealCopilot";
import { deleteDealOpportunity } from "@/core/dealCopilot";

function rowToOpportunity(r: Tables<"deal_opportunities">): DealOpportunity {
  return {
    id: r.id,
    title: r.title,
    listingUrl: r.listing_url ?? undefined,
    postcode: r.postcode ?? undefined,
    propertyType: (r.property_type ?? undefined) as PropertyType | undefined,
    bedrooms: r.bedrooms != null ? Number(r.bedrooms) : undefined,
    purchasePrice: r.purchase_price != null ? Number(r.purchase_price) : undefined,
    estimatedGdv: r.estimated_gdv != null ? Number(r.estimated_gdv) : undefined,
    expectedMonthlyRent:
      r.expected_monthly_rent != null ? Number(r.expected_monthly_rent) : undefined,
    refurbBudget: r.refurb_budget != null ? Number(r.refurb_budget) : undefined,
    targetExitStrategy: (r.target_exit_strategy ?? undefined) as DealExitStrategy | undefined,
    status: r.status as DealOpportunityStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function fetchOpportunities(): Promise<DealOpportunity[]> {
  const { data, error } = await supabase
    .from("deal_opportunities")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOpportunity);
}

export function useOpportunities() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["opportunities"],
    queryFn: fetchOpportunities,
    enabled: !!user,
  });
}

export function useOpportunity(id: string) {
  const { data: opportunities, ...rest } = useOpportunities();
  return {
    ...rest,
    data: opportunities?.find((o) => o.id === id),
  };
}

export function useSaveOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    /**
     * Use serverFn (requireUser + cookie auth) for the write.
     * This survives hard refresh / direct nav to deal-copilot routes under _authed.
     * Matches the pattern used by the intake form's store.save and by projects create.
     */
    mutationFn: (opportunity: DealOpportunity) =>
      saveDealOpportunityServerFn({ data: opportunity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
}

export function useDeleteOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // ServerFn path for consistency + hard-refresh safety (RLS still enforces).
      await deleteDealOpportunity(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
}
