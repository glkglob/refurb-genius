/**
 * Mobile API request dispatcher for `/api/mobile/*` (IOS-READINESS-2C-1).
 *
 * Isolated from TanStack serverFn transport and CSRF middleware.
 * Invoked from Production `src/server.ts` before the Start entry.
 */
import { requireMobileBearer, resolveAuthoritativeUserId } from "./mobile-bearer.server";
import { mobileCorsPreflightResponse, withMobileCors } from "./mobile-cors.server";

export const MOBILE_API_PATH_PREFIX = "/api/mobile/" as const;
export const MOBILE_SESSION_PING_PATHNAME = "/api/mobile/v1/session/ping" as const;
export const MOBILE_REDESIGN_GENERATE_PATHNAME = "/api/mobile/v1/redesign/generate" as const;
export const MOBILE_ANALYSIS_GENERATE_PATHNAME = "/api/mobile/v1/analysis/generate" as const;

export function isMobileApiPath(pathname: string): boolean {
  return pathname === "/api/mobile" || pathname.startsWith(MOBILE_API_PATH_PREFIX);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * Handle a single mobile API request (including OPTIONS preflight).
 */
export async function handleMobileApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return mobileCorsPreflightResponse(request);
  }

  if (method !== "POST") {
    return withMobileCors(request, jsonResponse({ error: "Method not allowed" }, 405));
  }

  if (url.pathname === MOBILE_SESSION_PING_PATHNAME) {
    return withMobileCors(request, await handleSessionPing(request));
  }

  if (url.pathname === MOBILE_REDESIGN_GENERATE_PATHNAME) {
    const { handleMobileRedesignGenerate } =
      await import("@/features/ai-design/presentation/mobileRedesignGenerate.server");
    return withMobileCors(request, await handleMobileRedesignGenerate(request));
  }

  if (url.pathname === MOBILE_ANALYSIS_GENERATE_PATHNAME) {
    const { handleMobilePhotoAnalysisGenerate } =
      await import("@/features/ai-upload/presentation/mobilePhotoAnalysisGenerate.server");
    return withMobileCors(request, await handleMobilePhotoAnalysisGenerate(request));
  }

  return withMobileCors(request, jsonResponse({ error: "Not found" }, 404));
}

/**
 * POST /api/mobile/v1/session/ping
 * Proves Bearer auth without cookies; returns only { authenticated: true }.
 */
async function handleSessionPing(request: Request): Promise<Response> {
  const auth = await requireMobileBearer(request);
  if (!auth.ok) {
    return auth.response;
  }

  // Optional body may include a forged userId — must never override token identity.
  let claimedUserId: string | undefined;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { userId?: unknown };
      if (typeof body?.userId === "string") {
        claimedUserId = body.userId;
      }
    }
  } catch {
    // Empty/invalid body is fine for ping.
  }

  const userId = resolveAuthoritativeUserId(auth.userId, claimedUserId);
  if (!userId || userId !== auth.userId) {
    // Defensive: resolveAuthoritativeUserId always returns token id; keep fail-closed shape.
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Prove RLS-capable token client exists without returning private profile fields.
  void auth.supabase;

  return jsonResponse({ authenticated: true as const }, 200);
}
