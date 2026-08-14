/**
 * POST /api/mobile/v1/redesign/generate — Bearer-authenticated native generation.
 *
 * Identity is requireMobileBearer only. Body userId/analyses are ignored.
 */
import { z } from "zod";
import { REDESIGN_STYLES } from "@/lib/redesign";
import {
  PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED,
  PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS,
  PhotoAnalysisError,
} from "@/features/ai-upload";
import {
  requireMobileBearer,
  resolveAuthoritativeUserId,
} from "@/platform/http/mobile-bearer.server";
import type { RedesignPersistenceClient } from "../infrastructure/repositories/redesign-concepts.repository.server";

export const MOBILE_REDESIGN_GENERATE_PATHNAME = "/api/mobile/v1/redesign/generate" as const;

const generateBodySchema = z.object({
  projectId: z.string().uuid(),
  styles: z.array(z.enum(REDESIGN_STYLES)).optional(),
  userId: z.unknown().optional(),
  analyses: z.unknown().optional(),
});

function jsonResponse(body: unknown, status: number, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function statusForGenerationError(err: unknown): {
  status: number;
  message: string;
  retryAfter?: number;
} {
  if (err instanceof PhotoAnalysisError) {
    if (err.code === PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED) {
      return { status: 403, message: err.message };
    }
    if (err.code === PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS) {
      return { status: 409, message: err.message };
    }
    return { status: 409, message: err.message };
  }

  const message = err instanceof Error ? err.message : "Redesign generation failed.";
  if (/Rate limit exceeded/i.test(message)) {
    const seconds = Number((/Try again in (\d+)/i.exec(message) ?? [])[1] ?? 60);
    return { status: 429, message, retryAfter: Number.isFinite(seconds) ? seconds : 60 };
  }
  if (/Not authenticated/i.test(message)) {
    return { status: 401, message };
  }
  if (/Not authorised/i.test(message)) {
    return { status: 403, message };
  }
  if (/without durable Analysis/i.test(message)) {
    return { status: 409, message };
  }
  if (/OPENAI_API_KEY/i.test(message)) {
    return { status: 503, message: "Redesign generation is temporarily unavailable." };
  }
  return { status: 500, message };
}

export async function handleMobileRedesignGenerate(request: Request): Promise<Response> {
  const auth = await requireMobileBearer(request);
  if (!auth.ok) {
    return auth.response;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const parsed = generateBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }

  void parsed.data.analyses;
  const claimed = typeof parsed.data.userId === "string" ? parsed.data.userId : undefined;
  const userId = resolveAuthoritativeUserId(auth.userId, claimed);
  if (!userId || userId !== auth.userId) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const { runAuthenticatedRedesignGeneration } =
      await import("../infrastructure/runAuthenticatedRedesignGeneration.server");
    const concepts = await runAuthenticatedRedesignGeneration({
      userId,
      supabase: auth.supabase as unknown as RedesignPersistenceClient,
      projectId: parsed.data.projectId,
      styles: parsed.data.styles,
    });
    return jsonResponse(concepts, 200);
  } catch (err) {
    const mapped = statusForGenerationError(err);
    return jsonResponse(
      { error: mapped.message },
      mapped.status,
      mapped.retryAfter != null ? { "Retry-After": String(mapped.retryAfter) } : undefined,
    );
  }
}
