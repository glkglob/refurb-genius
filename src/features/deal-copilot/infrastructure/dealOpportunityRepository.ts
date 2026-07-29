/**
 * Deal opportunity update persistence (AO-1M5).
 *
 * Browser Supabase partial UPDATE of deal_opportunities.
 * Ownership enforced by RLS. Returns mapped domain row via select().single().
 */
import { supabase } from "@/platform/supabase/browser";
import type { DealOpportunity, DealOpportunityStatus, DealExitStrategy } from "@repo/types";
import type { PropertyType } from "@/core/projects/domain";
import type { Tables, TablesUpdate } from "@repo/supabase";

export interface UpdateOpportunityInput {
  id: string;
  updates: Partial<Omit<DealOpportunity, "id" | "createdAt" | "updatedAt">>;
}

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

/**
 * Partial update of a deal opportunity for the authenticated owner (RLS).
 * Preserves pre-extraction field map, updated_at, filter, select().single(), and errors.
 */
export async function updateOpportunity(input: UpdateOpportunityInput): Promise<DealOpportunity> {
  const { id, updates } = input;
  const patch: TablesUpdate<"deal_opportunities"> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.listingUrl !== undefined) patch.listing_url = updates.listingUrl;
  if (updates.postcode !== undefined) patch.postcode = updates.postcode;
  if (updates.propertyType !== undefined) patch.property_type = updates.propertyType;
  if (updates.bedrooms !== undefined) patch.bedrooms = updates.bedrooms;
  if (updates.purchasePrice !== undefined) patch.purchase_price = updates.purchasePrice;
  if (updates.estimatedGdv !== undefined) patch.estimated_gdv = updates.estimatedGdv;
  if (updates.expectedMonthlyRent !== undefined)
    patch.expected_monthly_rent = updates.expectedMonthlyRent;
  if (updates.refurbBudget !== undefined) patch.refurb_budget = updates.refurbBudget;
  if (updates.targetExitStrategy !== undefined)
    patch.target_exit_strategy = updates.targetExitStrategy;
  if (updates.status !== undefined) patch.status = updates.status;

  const { data, error } = await supabase
    .from("deal_opportunities")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToOpportunity(data);
}

export const dealOpportunityRepository = {
  updateOpportunity,
};
