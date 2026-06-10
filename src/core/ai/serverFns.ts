import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { REDESIGN_STYLES } from "@/lib/redesign";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";
import { roomAnalysisOutputSchema } from "@/features/ai-upload/presentation/serverFns";

const runRedesignInputSchema = z.object({
  projectId: z.string().min(1),
  styles: z.array(z.enum(REDESIGN_STYLES)).optional(),
  analyses: z.array(roomAnalysisOutputSchema).optional(),
});

async function requireServerAuth(): Promise<{ id: string }> {
  const { getCookies } = await import("@tanstack/react-start/server");
  const { createServerSupabase } = await import("@repo/supabase/server");

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

// ──────────────────────────────────────────────────────────────
// Photo analysis (vision) — moved to the ai-upload feature slice.
// Re-exported here as a legacy shim; import from
// "@/features/ai-upload" in new code.
// ──────────────────────────────────────────────────────────────

export { runPhotoAnalysisServerFn } from "@/features/ai-upload/presentation/serverFns";

export const generateRedesignConceptsServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runRedesignInputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireServerAuth();
    const key = rateLimitKeyForUser(user.id, "ai-redesign");
    const rl = checkRateLimit(key);
    if (!rl.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
    }
    const { runSecureRedesignGeneration } = await import("./server/openAiRedesign.server");
    return runSecureRedesignGeneration(data);
  });

// ──────────────────────────────────────────────────────────────
// AI estimate generation — moved to the estimate feature slice.
// Re-exported here as a legacy shim; import from
// "@/features/estimate" in new code.
// ──────────────────────────────────────────────────────────────

export { generateEstimateServerFn } from "@/features/estimate/presentation/serverFns";

// ──────────────────────────────────────────────────────────────
// AI scope analysis (photo → condition + costed scope)
// ──────────────────────────────────────────────────────────────

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
    const { runSecureScopeAnalysis } = await import("./server/openAiScopeAnalysis.server");
    return runSecureScopeAnalysis(data);
  });
