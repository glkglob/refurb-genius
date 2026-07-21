/**
 * Server function for Deal Copilot AI analysis.
 *
 * @file src/serverFns/dealAnalysis.ts
 *
 * `analyzeDealServerFn` fetches the authenticated user's `deal_opportunities`
 * row (RLS-scoped via the cookie-based server client), then runs the server-only
 * OpenAI adapter to produce a structured, Zod-validated qualitative analysis.
 *
 * Rules (consistent with auth.ts / dealCopilot.ts):
 *   - `.inputValidator()` with Zod, `requireUser()` first, rate-limited.
 *   - No top-level imports of server-only AI code; reach the adapter via a
 *     dynamic `import()` inside the handler.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";
import type { DealAnalysis } from "@/core/dealCopilot/dealAnalysis";

const analyzeDealInputSchema = z.object({
  opportunityId: z.string().min(1),
  promptContext: z.string().max(2000).optional(),
});

export const analyzeDealServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => analyzeDealInputSchema.parse(input))
  .handler(async ({ data }): Promise<DealAnalysis> => {
    const { requireUser, createSupabaseServerClient } = await import("./auth.server");
    const user = await requireUser();

    const rl = checkRateLimit(rateLimitKeyForUser(user.id, "deal-analysis"));
    if (!rl.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
    }

    const supabase = await createSupabaseServerClient();
    const { data: row, error } = await supabase
      .from("deal_opportunities")
      .select("*")
      .eq("id", data.opportunityId)
      .single();

    if (error || !row) {
      throw new Error("Opportunity not found.");
    }

    const { runDealAnalysis } =
      await import("@/core/dealCopilot/server/dealAnalysis.adapter.server");

    return runDealAnalysis({
      title: row.title,
      status: row.status,
      postcode: row.postcode ?? undefined,
      propertyType: row.property_type ?? undefined,
      bedrooms: row.bedrooms ?? undefined,
      purchasePrice: row.purchase_price ?? undefined,
      estimatedGdv: row.estimated_gdv ?? undefined,
      refurbBudget: row.refurb_budget ?? undefined,
      expectedMonthlyRent: row.expected_monthly_rent ?? undefined,
      targetExitStrategy: row.target_exit_strategy ?? undefined,
      promptContext: data.promptContext,
    });
  });
