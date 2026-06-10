/**
 * AI-upload slice — RPC surface (TanStack `createServerFn`).
 * Moved from `src/core/ai/serverFns.ts` (which now re-exports from here).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CONDITION_LEVELS, REFURB_LEVELS, ROOM_TYPES } from "../domain";
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

const photoInputSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  name: z.string().min(1),
  size: z.number().nonnegative().optional(),
});

const runPhotoAnalysisInputSchema = z.object({
  projectId: z.string().min(1),
  photos: z.array(photoInputSchema),
});

/** Shared schema for redesign serverFn input (re-exported by legacy serverFns shim). */
export const roomAnalysisOutputSchema = z.object({
  id: z.string().min(1),
  photo_url: z.string().min(1),
  photo_name: z.string().min(1),
  room_type: z.enum(ROOM_TYPES),
  condition_level: z.enum(CONDITION_LEVELS),
  refurbishment_level: z.enum(REFURB_LEVELS),
  visible_issues: z.array(z.string()),
  recommended_works: z.array(z.string()),
  ai_summary: z.string(),
  confidence_score: z.number(),
  source: z.enum(["ai", "mock", "fallback", "persisted"]),
});

export const runPhotoAnalysisServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runPhotoAnalysisInputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireServerAuth();
    const key = rateLimitKeyForUser(user.id, "ai-vision");
    const rl = checkRateLimit(key);
    if (!rl.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
    }
    const { runSecurePhotoAnalysis } =
      await import("../infrastructure/adapters/ai-vision.adapter.server");
    return runSecurePhotoAnalysis(data);
  });
