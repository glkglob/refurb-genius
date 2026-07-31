/**
 * Estimate slice — RPC surface (TanStack `createServerFn`).
 * Moved from `src/core/ai/serverFns.ts` (which now re-exports from here).
 *
 * Client-safe *declarations* only. Server-only modules are dynamic-imported
 * inside handlers. Do not statically import `.server.ts` modules here.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";
import { decodeSaveAuthorityCategoryEstimateCommand } from "../application/authority";

async function requireServerAuth(): Promise<{ id: string }> {
  // cookieName must match browser client ("pip-auth") or getUser() is always null.
  const { requireUser } = await import("@/serverFns/auth.server");
  const user = await requireUser();
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

/**
 * Canonical category authority save.
 *
 * inputValidator runs the strict decoder *before* the handler (and therefore
 * before authentication). Money/authority fields are rejected at this boundary.
 */
export const saveAuthorityCategoryEstimateServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    try {
      return decodeSaveAuthorityCategoryEstimateCommand(input);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(String(err));
    }
  })
  .handler(async ({ data: command }) => {
    const { requireUser } = await import("@/serverFns/auth.server");
    const { makeSaveAuthorityCategoryEstimate, isAuthorityError } =
      await import("../application/authority");
    const { assertProjectOwnedBy, persistCategoryEngineEstimate } =
      await import("../infrastructure/repositories/categoryAuthorityEstimate.repository.server");

    try {
      const save = makeSaveAuthorityCategoryEstimate({
        auth: {
          requireUserId: async () => {
            const user = await requireUser();
            return user.id;
          },
        },
        projects: {
          assertProjectOwnedBy,
        },
        persistence: {
          persistCategoryEngineEstimate,
        },
      });

      const result = await save(command);
      // Serializable DTO only — no Record<string, unknown>.
      return {
        estimateId: result.estimateId,
        replay: result.replay,
        midTotal: result.pricing.mid_total,
        lowTotal: result.pricing.low_total,
        highTotal: result.pricing.high_total,
        labourTotal: result.pricing.labour_total,
        materialsTotal: result.pricing.materials_total,
        subtotal: result.pricing.subtotal,
        contingency: result.pricing.contingency,
        vat: result.pricing.vat,
        timelineWeeks: result.pricing.timeline_weeks,
        itemCount: result.items.length,
      };
    } catch (err) {
      if (isAuthorityError(err)) {
        throw new Error(`${err.code}: ${err.message}`);
      }
      throw err;
    }
  });
