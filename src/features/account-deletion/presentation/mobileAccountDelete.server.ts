/**
 * POST /api/mobile/v1/account/delete — Bearer-authenticated native deletion.
 *
 * Identity is requireMobileBearer only. Body userId is ignored.
 */
import {
  requireMobileBearer,
  resolveAuthoritativeUserId,
} from "@/platform/http/mobile-bearer.server";
import { ACCOUNT_DELETION_SUCCESS, AccountDeletionError } from "../domain/accountDeletionContract";

export const MOBILE_ACCOUNT_DELETE_PATHNAME = "/api/mobile/v1/account/delete" as const;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function looksLikeSecret(value: string): boolean {
  return /access_token|refresh_token|Authorization|Bearer |service_role|SUPABASE_SERVICE_ROLE_KEY|eyJ[A-Za-z0-9_-]{20,}/i.test(
    value,
  );
}

function mapDeletionError(err: unknown): { status: number; message: string } {
  if (err instanceof AccountDeletionError) {
    if (err.code === "storage_cleanup_failed") {
      return { status: 500, message: "Required storage cleanup failed." };
    }
    if (err.code === "not_configured") {
      return { status: 503, message: "Account deletion is temporarily unavailable." };
    }
    return { status: 500, message: "Account deletion failed." };
  }
  const message = err instanceof Error ? err.message : "";
  if (/Missing SUPABASE_SERVICE_ROLE_KEY|Missing SUPABASE_URL/i.test(message)) {
    return { status: 503, message: "Account deletion is temporarily unavailable." };
  }
  if (looksLikeSecret(message) || !message) {
    return { status: 500, message: "Account deletion failed." };
  }
  return { status: 500, message: "Account deletion failed." };
}

export async function handleMobileAccountDelete(request: Request): Promise<Response> {
  const auth = await requireMobileBearer(request);
  if (!auth.ok) {
    return auth.response;
  }

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
    // Empty/invalid body is fine.
  }

  const userId = resolveAuthoritativeUserId(auth.userId, claimedUserId);
  if (!userId || userId !== auth.userId) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const { createServiceRoleSupabase } = await import("@/platform/supabase/service.server");
    const { executeAccountDeletion } = await import("../application/executeAccountDeletion.server");
    const result = await executeAccountDeletion(userId, createServiceRoleSupabase());
    if (result.success !== true) {
      return jsonResponse({ error: "Account deletion failed." }, 500);
    }
    return jsonResponse(ACCOUNT_DELETION_SUCCESS, 200);
  } catch (err) {
    const mapped = mapDeletionError(err);
    return jsonResponse({ error: mapped.message }, mapped.status);
  }
}
