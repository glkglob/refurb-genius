/**
 * AI-upload slice — RPC surface (TanStack `createServerFn`).
 * Moved from `src/core/ai/serverFns.ts` (which now re-exports from here).
 *
 * Supports multiple AI vision providers: OpenAI (gpt-4o) and HuggingFace (Llama 3.2 Vision, etc.).
 * Provider selected via `AI_VISION_PROVIDER` env var: "openai" | "huggingface" | "auto"
 * - "auto" (default): prefers OpenAI if configured, falls back to HF if configured
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CONDITION_LEVELS, REFURB_LEVELS, ROOM_TYPES } from "../domain";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";

async function requireServerAuth(): Promise<{ id: string }> {
  // cookieName must match browser client ("pip-auth") or getUser() is always null.
  const { requireUser } = await import("@/serverFns/auth");
  const user = await requireUser();
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

/** Determine which vision provider to use */
async function getVisionProvider(): Promise<"openai" | "huggingface"> {
  const explicit = process.env.AI_VISION_PROVIDER;
  if (explicit === "openai" || explicit === "huggingface") return explicit;

  // Auto mode: prefer OpenAI if configured, else HF if configured
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const { isHuggingFaceConfigured } = await import("@/platform/huggingface/server");
  const hasHF = isHuggingFaceConfigured();

  if (hasOpenAI) return "openai";
  if (hasHF) return "huggingface";

  // Neither configured - will use mock/fallback in dev
  return "openai";
}

export const runPhotoAnalysisServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runPhotoAnalysisInputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireServerAuth();
    const key = rateLimitKeyForUser(user.id, "ai-vision");
    const rl = checkRateLimit(key);
    if (!rl.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
    }

    const provider = await getVisionProvider();

    if (provider === "huggingface") {
      const { runSecurePhotoAnalysisHuggingFace } =
        await import("../infrastructure/adapters/hf-vision.adapter.server");
      return runSecurePhotoAnalysisHuggingFace(data);
    }

    // Default: OpenAI
    const { runSecurePhotoAnalysis } =
      await import("../infrastructure/adapters/ai-vision.adapter.server");
    return runSecurePhotoAnalysis(data);
  });

/**
 * Optional: explicit provider override for testing/comparison.
 * Call this to run with a specific provider regardless of env.
 */
export const runPhotoAnalysisWithProviderServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    runPhotoAnalysisInputSchema
      .extend({ provider: z.enum(["openai", "huggingface"]).optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireServerAuth();
    const key = rateLimitKeyForUser(user.id, "ai-vision");
    const rl = checkRateLimit(key);
    if (!rl.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
    }

    const provider = data.provider ?? (await getVisionProvider());

    if (provider === "huggingface") {
      const { runSecurePhotoAnalysisHuggingFace } =
        await import("../infrastructure/adapters/hf-vision.adapter.server");
      return runSecurePhotoAnalysisHuggingFace(data);
    }

    const { runSecurePhotoAnalysis } =
      await import("../infrastructure/adapters/ai-vision.adapter.server");
    return runSecurePhotoAnalysis(data);
  });
