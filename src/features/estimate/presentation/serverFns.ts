/**
 * Estimate slice — RPC surface (TanStack `createServerFn`).
 * Moved from `src/core/ai/serverFns.ts` (which now re-exports from here).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";

async function requireServerAuth(): Promise<{ id: string }> {
  const { getCookies } = await import("@tanstack/react-start/server");
  const { createServerSupabase } = await import("@/platform/supabase/server");

  const supabase = createServerSupabase(getCookies());

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized: you must be signed in to use AI features.");
  }
  return { id: user.id };
}

const generateEstimateInputSchema = z.object({
  propertyType: z.string().min(1),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(10).optional(),
  region: z.string().min(1),
  postcode: z.string().optional(),
  condition: z.string().min(1),
  requirements: z.string(),
  sizeSqm: z.number().positive().optional(),
});

export const generateEstimateServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => generateEstimateInputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireServerAuth();
    const key = rateLimitKeyForUser(user.id, "ai-estimate");
    const rl = checkRateLimit(key);
    if (!rl.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
    }
    const { runSecureEstimateGeneration } =
      await import("../infrastructure/adapters/ai-estimate.adapter.server");
    return runSecureEstimateGeneration(data);
  });
