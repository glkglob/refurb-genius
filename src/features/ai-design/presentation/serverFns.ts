/**
 * AI-design slice — RPC surface (TanStack `createServerFn`).
 * Moved from `src/core/ai/serverFns.ts` (which now re-exports from here).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { REDESIGN_STYLES } from "@/lib/redesign";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";
import { roomAnalysisOutputSchema } from "@/features/ai-upload";

async function requireServerAuth(): Promise<{ id: string }> {
  // cookieName must match browser client ("pip-auth") or getUser() is always null.
  const { requireUser } = await import("@/serverFns/auth.server");
  const user = await requireUser();
  return { id: user.id };
}

const runRedesignInputSchema = z.object({
  projectId: z.string().min(1),
  styles: z.array(z.enum(REDESIGN_STYLES)).optional(),
  analyses: z.array(roomAnalysisOutputSchema).optional(),
});

export const generateRedesignConceptsServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runRedesignInputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireServerAuth();
    const key = rateLimitKeyForUser(user.id, "ai-redesign");
    const rl = checkRateLimit(key);
    if (!rl.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
    }
    const { runSecureRedesignGeneration } =
      await import("../infrastructure/adapters/ai-redesign.adapter.server");
    return runSecureRedesignGeneration(data);
  });

const photoSourceSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  name: z.string().min(1),
  size: z.number().nonnegative().optional(),
});

const scopeAnalysisInputSchema = z.object({
  projectId: z.string().min(1),
  photos: z.array(photoSourceSchema),
  roomTags: z.array(z.string()),
  propertyType: z.string().min(1),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(10).optional(),
  region: z.string().min(1),
  notes: z.string().optional(),
});

export const runScopeAnalysisServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => scopeAnalysisInputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireServerAuth();
    const key = rateLimitKeyForUser(user.id, "ai-scope");
    const rl = checkRateLimit(key);
    if (!rl.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
    }
    const { runSecureScopeAnalysis } =
      await import("../infrastructure/adapters/ai-scope.adapter.server");
    return runSecureScopeAnalysis(data);
  });
