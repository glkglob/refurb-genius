/**
 * POST /api/mobile/v1/analysis/run — Bearer-authenticated native Analysis.
 *
 * Identity is requireMobileBearer only. Body identity/URL/path/provider
 * fields are rejected. Delegates to the shared authenticated runner.
 */
import { z } from "zod";
import {
  PHOTO_ANALYSIS_CATALOGUE_TOO_LARGE,
  PHOTO_ANALYSIS_DUPLICATE_PHOTO_IDS,
  PHOTO_ANALYSIS_NO_SOURCE_PHOTOS,
  PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED,
  PHOTO_ANALYSIS_PROVIDER_UNAVAILABLE,
  PHOTO_ANALYSIS_RETRIEVAL_UNAVAILABLE,
  PHOTO_ANALYSIS_SOURCE_NOT_AUTHORISED,
  PHOTO_ANALYSIS_SOURCE_SET_MISMATCH,
  PhotoAnalysisError,
} from "../domain";
import { requireMobileBearer } from "@/platform/http/mobile-bearer.server";

export const MOBILE_ANALYSIS_RUN_PATHNAME = "/api/mobile/v1/analysis/run" as const;

const analysisRunBodySchema = z
  .object({
    projectId: z.string().uuid(),
    photoIds: z.array(z.string().uuid()),
  })
  .strict();

function jsonResponse(body: unknown, status: number, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function looksLikeSecret(value: string): boolean {
  return /access_token|refresh_token|Authorization|Bearer |retrievalUrl|OPENAI_API_KEY|eyJ[A-Za-z0-9_-]{20,}/i.test(
    value,
  );
}

function safeUnexpectedMessage(): string {
  return "Photo analysis failed.";
}

function mapAnalysisError(err: unknown): {
  status: number;
  message: string;
  retryAfter?: number;
} {
  if (err instanceof PhotoAnalysisError) {
    switch (err.code) {
      case PHOTO_ANALYSIS_NO_SOURCE_PHOTOS:
        return { status: 400, message: err.message };
      case PHOTO_ANALYSIS_DUPLICATE_PHOTO_IDS:
        return { status: 400, message: "Invalid request" };
      case PHOTO_ANALYSIS_CATALOGUE_TOO_LARGE:
        return {
          status: 400,
          message: "This project has too many photos for one analysis operation.",
        };
      case PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED:
        return { status: 403, message: err.message };
      case PHOTO_ANALYSIS_SOURCE_NOT_AUTHORISED:
        return { status: 500, message: safeUnexpectedMessage() };
      case PHOTO_ANALYSIS_SOURCE_SET_MISMATCH:
        return { status: 409, message: err.message };
      case PHOTO_ANALYSIS_RETRIEVAL_UNAVAILABLE:
      case PHOTO_ANALYSIS_PROVIDER_UNAVAILABLE:
        return { status: 503, message: "Photo analysis is temporarily unavailable." };
      default:
        return { status: 500, message: safeUnexpectedMessage() };
    }
  }

  const message = err instanceof Error ? err.message : "";
  if (/Rate limit exceeded/i.test(message)) {
    const seconds = Number((/Try again in (\d+)/i.exec(message) ?? [])[1] ?? 60);
    return {
      status: 429,
      message: "Rate limit exceeded. Try again shortly.",
      retryAfter: Number.isFinite(seconds) ? seconds : 60,
    };
  }

  if (looksLikeSecret(message) || !message) {
    return { status: 500, message: safeUnexpectedMessage() };
  }
  return { status: 500, message: safeUnexpectedMessage() };
}

export async function handleMobileAnalysisRun(request: Request): Promise<Response> {
  const auth = await requireMobileBearer(request);
  if (!auth.ok) {
    return auth.response;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }

  const parsed = analysisRunBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }

  if (parsed.data.photoIds.length === 0) {
    return jsonResponse(
      { error: "Upload at least one project photo before running AI analysis." },
      400,
    );
  }

  if (new Set(parsed.data.photoIds).size !== parsed.data.photoIds.length) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }

  try {
    const { runAuthenticatedPhotoAnalysis } =
      await import("../infrastructure/runAuthenticatedPhotoAnalysis.server");
    const analyses = await runAuthenticatedPhotoAnalysis({
      userId: auth.userId,
      supabase: auth.supabase,
      projectId: parsed.data.projectId,
      photoIds: parsed.data.photoIds,
      catalogueMode: "exact",
    });
    return jsonResponse(analyses, 200);
  } catch (err) {
    const mapped = mapAnalysisError(err);
    return jsonResponse(
      { error: mapped.message },
      mapped.status,
      mapped.retryAfter != null ? { "Retry-After": String(mapped.retryAfter) } : undefined,
    );
  }
}
