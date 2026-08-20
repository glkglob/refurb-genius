/**
 * POST /api/mobile/v1/scope/analyze — Bearer-authenticated native Scope analysis.
 *
 * Identity is requireMobileBearer only. Body userId is ignored.
 * Client photo.url is never retrieval authority.
 */
import { z } from "zod";
import {
  requireMobileBearer,
  resolveAuthoritativeUserId,
} from "@/platform/http/mobile-bearer.server";

export const MOBILE_SCOPE_ANALYZE_PATHNAME = "/api/mobile/v1/scope/analyze" as const;

const photoSourceSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  name: z.string().min(1),
  size: z.number().nonnegative().optional(),
});

const analyzeBodySchema = z.object({
  projectId: z.string().uuid(),
  photos: z.array(photoSourceSchema),
  roomTags: z.array(z.string()),
  propertyType: z.string().min(1),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(10).optional(),
  region: z.string().min(1),
  notes: z.string().optional(),
  userId: z.unknown().optional(),
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

function looksLikeSecret(value: string): boolean {
  return /access_token|refresh_token|Authorization|Bearer |retrievalUrl|OPENAI_API_KEY|eyJ[A-Za-z0-9_-]{20,}/i.test(
    value,
  );
}

function safeUnexpectedMessage(): string {
  return "Scope analysis failed.";
}

function statusForScopeError(err: unknown): {
  status: number;
  message: string;
  retryAfter?: number;
} {
  const message = err instanceof Error ? err.message : "";
  if (/Rate limit exceeded/i.test(message)) {
    const seconds = Number((/Try again in (\d+)/i.exec(message) ?? [])[1] ?? 60);
    return {
      status: 429,
      message: "Rate limit exceeded. Try again shortly.",
      retryAfter: Number.isFinite(seconds) ? seconds : 60,
    };
  }
  if (/Not authenticated/i.test(message)) {
    return { status: 401, message: "Unauthorized" };
  }
  if (/Project not authorised/i.test(message)) {
    return { status: 403, message: "Project not authorised" };
  }
  if (/Source photo set mismatch/i.test(message)) {
    return { status: 400, message: "Invalid request" };
  }
  if (/Source photos not authorised/i.test(message)) {
    return { status: 500, message: safeUnexpectedMessage() };
  }
  if (/OPENAI_API_KEY/i.test(message)) {
    return { status: 503, message: "Scope analysis is temporarily unavailable." };
  }
  if (looksLikeSecret(message) || !message) {
    return { status: 500, message: safeUnexpectedMessage() };
  }
  return { status: 500, message: safeUnexpectedMessage() };
}

export async function handleMobileScopeAnalyze(request: Request): Promise<Response> {
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

  const parsed = analyzeBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }

  if (parsed.data.photos.length === 0) {
    return jsonResponse({ error: "Upload photos first to run the scope analysis" }, 400);
  }

  const claimed = typeof parsed.data.userId === "string" ? parsed.data.userId : undefined;
  const userId = resolveAuthoritativeUserId(auth.userId, claimed);
  if (!userId || userId !== auth.userId) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const { runAuthenticatedScopeAnalysis } =
      await import("../infrastructure/runAuthenticatedScopeAnalysis.server");
    const result = await runAuthenticatedScopeAnalysis({
      userId,
      supabase: auth.supabase as never,
      analysis: {
        projectId: parsed.data.projectId,
        photos: parsed.data.photos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          name: photo.name,
          size: photo.size,
        })),
        roomTags: parsed.data.roomTags,
        propertyType: parsed.data.propertyType,
        bedrooms: parsed.data.bedrooms,
        bathrooms: parsed.data.bathrooms,
        region: parsed.data.region,
        notes: parsed.data.notes,
      },
    });
    return jsonResponse(result, 200);
  } catch (err) {
    const mapped = statusForScopeError(err);
    return jsonResponse(
      { error: mapped.message },
      mapped.status,
      mapped.retryAfter != null ? { "Retry-After": String(mapped.retryAfter) } : undefined,
    );
  }
}
