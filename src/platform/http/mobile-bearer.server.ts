/**
 * Server Bearer guard for `/api/mobile/*` (IOS-READINESS-2C-1).
 *
 * Reuses packages/supabase verifyToken + createTokenSupabase.
 * Identity is derived only from the verified JWT — never from body/query userId.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";
import { verifyToken } from "@repo/supabase/server";

export type MobileBearerSuccess = {
  ok: true;
  userId: string;
  user: User;
  supabase: SupabaseClient<Database>;
  /** Opaque token retained only for createTokenSupabase-backed client — never log. */
  token: string;
};

export type MobileBearerFailure = {
  ok: false;
  response: Response;
};

export type ParseBearerResult =
  | { ok: true; token: string }
  | { ok: false; reason: "missing" | "scheme" | "empty" | "malformed" };

/**
 * Strict Authorization: Bearer <jwt> parser.
 * Does not validate the JWT cryptographically.
 */
export function parseBearerAuthorization(header: string | null): ParseBearerResult {
  if (header == null || header.trim() === "") {
    return { ok: false, reason: "missing" };
  }

  const trimmed = header.trim();
  const space = trimmed.indexOf(" ");
  if (space <= 0) {
    // e.g. "Bearer" with no token, or a single token with no scheme
    if (trimmed.toLowerCase() === "bearer") {
      return { ok: false, reason: "empty" };
    }
    return { ok: false, reason: "malformed" };
  }

  const scheme = trimmed.slice(0, space);
  const token = trimmed.slice(space + 1).trim();

  if (scheme.toLowerCase() !== "bearer") {
    return { ok: false, reason: "scheme" };
  }
  if (!token) {
    return { ok: false, reason: "empty" };
  }
  // Reject embedded whitespace (malformed multi-token)
  if (/\s/.test(token)) {
    return { ok: false, reason: "malformed" };
  }

  return { ok: true, token };
}

function unauthorizedResponse(message = "Unauthorized"): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * Authenticate a mobile API request via Bearer token.
 * Returns 401 Response on any auth failure (no token values in body).
 */
export async function requireMobileBearer(
  request: Request,
): Promise<MobileBearerSuccess | MobileBearerFailure> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const parsed = parseBearerAuthorization(header);

  if (!parsed.ok) {
    return { ok: false, response: unauthorizedResponse() };
  }

  try {
    const { supabase, userId, user } = await verifyToken<Database>(parsed.token);
    if (!userId || !user) {
      return { ok: false, response: unauthorizedResponse() };
    }
    return {
      ok: true,
      userId,
      user,
      supabase,
      token: parsed.token,
    };
  } catch {
    return { ok: false, response: unauthorizedResponse() };
  }
}

/**
 * Assert that a client-supplied identity claim cannot override the token identity.
 * Used by handlers/tests: prefer token userId always.
 */
export function resolveAuthoritativeUserId(
  tokenUserId: string,
  clientClaimedUserId: string | null | undefined,
): string {
  void clientClaimedUserId; // intentionally ignored
  return tokenUserId;
}
