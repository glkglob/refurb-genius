/**
 * AI-upload slice — RPC surface (TanStack `createServerFn`).
 *
 * Client may supply photo IDs (and optional metadata). Server re-resolves
 * canonical photo rows under project ownership before any vision call.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CONDITION_LEVELS, REFURB_LEVELS, ROOM_TYPES } from "../domain";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";

async function requireServerAuth(): Promise<{ id: string }> {
  const { requireUser } = await import("@/serverFns/auth.server");
  const user = await requireUser();
  return { id: user.id };
}

const photoInputSchema = z.object({
  id: z.string().uuid(),
  // URL/name accepted for temporary client compatibility but ignored for authority.
  url: z.string().optional(),
  name: z.string().optional(),
  size: z.number().nonnegative().optional(),
});

const runPhotoAnalysisInputSchema = z
  .object({
    projectId: z.string().uuid(),
    /** Preferred: explicit photo ID list. */
    photoIds: z.array(z.string().uuid()).min(1).optional(),
    /** Compatibility: photo objects; only `.id` is trusted as selector. */
    photos: z.array(photoInputSchema).min(1).optional(),
  })
  .superRefine((val, ctx) => {
    const ids = val.photoIds ?? val.photos?.map((p) => p.id) ?? [];
    if (ids.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Upload at least one project photo before running AI analysis.",
        path: ["photos"],
      });
    }
  });

/** Shared schema for redesign serverFn input (re-exported by legacy serverFns shim). */
export const roomAnalysisOutputSchema = z.object({
  id: z.string().min(1),
  photo_id: z.string().uuid().nullable().default(null),
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

  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const { isHuggingFaceConfigured } = await import("@/platform/huggingface/server");
  const hasHF = isHuggingFaceConfigured();

  if (hasOpenAI) return "openai";
  if (hasHF) return "huggingface";
  return "openai";
}

function extractPhotoIds(data: { photoIds?: string[]; photos?: Array<{ id: string }> }): string[] {
  if (data.photoIds?.length) return data.photoIds;
  return (data.photos ?? []).map((p) => p.id);
}

async function authorizeAndRunVision(input: {
  userId: string;
  projectId: string;
  photoIds: string[];
  provider?: "openai" | "huggingface";
}) {
  const { resolveAuthorizedProjectPhotos } =
    await import("../infrastructure/resolveAuthorizedPhotos.server");
  const photos = await resolveAuthorizedProjectPhotos({
    userId: input.userId,
    projectId: input.projectId,
    photoIds: input.photoIds,
  });

  const provider = input.provider ?? (await getVisionProvider());
  const payload = { projectId: input.projectId, photos };

  if (provider === "huggingface") {
    const { runSecurePhotoAnalysisHuggingFace } =
      await import("../infrastructure/adapters/hf-vision.adapter.server");
    return runSecurePhotoAnalysisHuggingFace(payload);
  }

  const { runSecurePhotoAnalysis } =
    await import("../infrastructure/adapters/ai-vision.adapter.server");
  return runSecurePhotoAnalysis(payload);
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

    const photoIds = extractPhotoIds(data);
    return authorizeAndRunVision({
      userId: user.id,
      projectId: data.projectId,
      photoIds,
    });
  });

/**
 * Optional: explicit provider override for testing/comparison.
 */
const runPhotoAnalysisWithProviderInputSchema = z
  .object({
    projectId: z.string().uuid(),
    photoIds: z.array(z.string().uuid()).min(1).optional(),
    photos: z.array(photoInputSchema).min(1).optional(),
    provider: z.enum(["openai", "huggingface"]).optional(),
  })
  .superRefine((val, ctx) => {
    const ids = val.photoIds ?? val.photos?.map((p) => p.id) ?? [];
    if (ids.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Upload at least one project photo before running AI analysis.",
        path: ["photos"],
      });
    }
  });

export const runPhotoAnalysisWithProviderServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runPhotoAnalysisWithProviderInputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireServerAuth();
    const key = rateLimitKeyForUser(user.id, "ai-vision");
    const rl = checkRateLimit(key);
    if (!rl.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
    }

    const photoIds = extractPhotoIds(data);
    return authorizeAndRunVision({
      userId: user.id,
      projectId: data.projectId,
      photoIds,
      provider: data.provider,
    });
  });
