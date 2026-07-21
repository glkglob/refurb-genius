/**
 * Server functions for Deal Copilot opportunity persistence.
 *
 * @file src/serverFns/dealCopilot.ts
 *
 * Provides `saveDealOpportunityServerFn` — the protected mutation for the
 * "Save opportunity" action in the Deal Intake form (Deal Copilot).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BUG THIS SOLVES
 * ─────────────────────────────────────────────────────────────────────────────
 * The previous implementation lived in:
 *   • `src/core/dealCopilot/opportunityStore.ts` → `opportunityStore.save()`
 *   • `src/hooks/useOpportunities.ts` → `useSaveOpportunity` (duplicate code)
 *
 * Both did:
 *   const { user } = await supabase.auth.getUser();  // client-only!
 *   await supabase.from("deal_opportunities").insert({ user_id: user.id, ... })
 *
 * After hard refresh or direct navigation to `/deal-copilot/new` (or
 * `/deal-copilot/$id`), the browser Supabase client's in-memory session is
 * empty → immediate "You must be signed in." on Save, even though the user
 * is legitimately logged in (cookies present, route guards may have passed).
 *
 * This serverFn guarantees the write path always sees a real user by using
 * the cookie-based server client + `requireUser()`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DESIGN NOTES
 * ─────────────────────────────────────────────────────────────────────────────
 * - The client-generated `id` (crypto.randomUUID from `createDealOpportunity`)
 *   is accepted and written as the PK. This matches the pre-existing contract
 *   so existing opportunity objects keep their ids when saved.
 * - `user_id` is *always* overwritten with the server-validated user. Client
 *   payload cannot impersonate another user.
 * - Return shape is the canonical `DealOpportunity` (camelCase domain type
 *   from @repo/types) so the call site in DealIntakeForm and the store cache
 *   layer continue to work unchanged.
 * - Zod validation is present (improved over the old no-validation inserts).
 * - The row→domain mapper is inlined here (tiny) to avoid pulling the whole
 *   opportunityStore module (which imports browser clients) into this file.
 *
 * Consumers:
 *   - Patched `opportunityStore.save` (the active "deal save path")
 *   - (Future) the currently-unused `useSaveOpportunity` hook can be updated
 *     the same way as `useCreateProject`.
 *
 * Rules (consistent with auth.ts + projects.ts):
 *   - No top-level imports of anything that transitively pulls browser
 *     Supabase clients (`@/platform/supabase/browser`, `@/lib/auth`, lib/projects
 *     for values, etc.).
 *   - All server-only work inside `.handler()`.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Type-only: safe, zero runtime cost, does not execute the source module.
import type { DealOpportunity } from "@repo/types";
import type { Tables } from "@repo/supabase";

/** Supabase row shape for the opportunities table. */
type DealOpportunityRow = Tables<"deal_opportunities">;

/**
 * Inlined mapper (duplicate of the private `rowToOpportunity` that lives in
 * opportunityStore.ts and useOpportunities.ts).
 *
 * We duplicate ~15 lines here rather than exporting it from the store module
 * because that module has top-level `import { supabase } from ...` and
 * `import { auth } from ...` — importing it would violate the "no browser
 * clients in serverFn modules" rule.
 *
 * Keeping it tiny and local is the minimal, safe change.
 */
function rowToDealOpportunity(r: DealOpportunityRow): DealOpportunity {
  return {
    id: r.id,
    title: r.title,
    listingUrl: r.listing_url ?? undefined,
    postcode: r.postcode ?? undefined,
    propertyType: (r.property_type ?? undefined) as DealOpportunity["propertyType"],
    bedrooms: r.bedrooms != null ? Number(r.bedrooms) : undefined,
    purchasePrice: r.purchase_price != null ? Number(r.purchase_price) : undefined,
    estimatedGdv: r.estimated_gdv != null ? Number(r.estimated_gdv) : undefined,
    expectedMonthlyRent:
      r.expected_monthly_rent != null ? Number(r.expected_monthly_rent) : undefined,
    refurbBudget: r.refurb_budget != null ? Number(r.refurb_budget) : undefined,
    targetExitStrategy: (r.target_exit_strategy ?? undefined) as
      | DealOpportunity["targetExitStrategy"]
      | undefined,
    status: r.status as DealOpportunity["status"],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Zod schema for the full DealOpportunity payload that the client sends on save.
 *
 * We are deliberately permissive on optionals (they are legitimately absent
 * for early-stage deals) and on the enum-like string fields (full validation
 * already happens in the form + `validateFormData` + `isDealReadyForUnderwriting`).
 * The important guarantees are:
 *   - `id` present (client-generated UUID)
 *   - `title` and `status` present
 *   - numeric fields, when supplied, are numbers
 */
const dealOpportunitySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  listingUrl: z.string().optional(),
  postcode: z.string().optional(),
  propertyType: z.string().optional(),
  bedrooms: z.number().int().optional(),
  purchasePrice: z.number().optional(),
  estimatedGdv: z.number().optional(),
  expectedMonthlyRent: z.number().optional(),
  refurbBudget: z.number().optional(),
  targetExitStrategy: z.string().optional(),
  status: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Persists (or upserts by id) a Deal Copilot opportunity for the current user.
 *
 * Replaces the direct browser Supabase insert that used to live in
 * `opportunityStore.save`.
 *
 * On success returns the saved `DealOpportunity` (domain shape) exactly as the
 * previous implementation did, so the cache update + UI in DealIntakeForm
 * require no behaviour changes.
 */
export const saveDealOpportunityServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => dealOpportunitySchema.parse(input))
  .handler(async ({ data: opportunity }) => {
    // Server execution context only. Cookie session is authoritative here.
    const { requireUser, createSupabaseServerClient } = await import("./auth.server");
    const user = await requireUser();

    const supabase = await createSupabaseServerClient();

    const { data: row, error } = await supabase
      .from("deal_opportunities")
      .upsert(
        {
          // The id is the client-generated one (preserves identity of the
          // in-memory opportunity object across save).
          id: opportunity.id,
          // SECURITY: server-validated user id. Overrides anything in payload.
          user_id: user.id,
          title: opportunity.title,
          listing_url: opportunity.listingUrl ?? null,
          postcode: opportunity.postcode ?? null,
          property_type: opportunity.propertyType ?? null,
          bedrooms: opportunity.bedrooms ?? null,
          purchase_price: opportunity.purchasePrice ?? null,
          estimated_gdv: opportunity.estimatedGdv ?? null,
          expected_monthly_rent: opportunity.expectedMonthlyRent ?? null,
          refurb_budget: opportunity.refurbBudget ?? null,
          target_exit_strategy: opportunity.targetExitStrategy ?? null,
          status: opportunity.status,
          // Always refresh updated_at on save (upsert); created_at uses DB default on insert.
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return rowToDealOpportunity(row);
  });

// ──────────────────────────────────────────────────────────────
// Delete
// ──────────────────────────────────────────────────────────────

const deleteOpportunityInputSchema = z.object({ id: z.string().min(1) });

export const deleteDealOpportunityServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deleteOpportunityInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireUser, createSupabaseServerClient } = await import("./auth.server");
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();

    // Defense-in-depth: scope delete to this user even if client sends wrong id.
    const { error } = await supabase
      .from("deal_opportunities")
      .delete()
      .eq("id", data.id)
      .eq("user_id", user.id);

    if (error) {
      throw new Error(error.message);
    }
  });
