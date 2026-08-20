/**
 * Client-safe serverFn *declarations* for auth.
 *
 * This file may be imported from routes/hooks (e.g. `_authed.tsx`, `useAuth`).
 * It must NOT import `@tanstack/react-start/server` or other server-only modules
 * at module scope (TanStack import-protection).
 *
 * Server-only helpers live in `./auth.server.ts` and are loaded dynamically
 * inside createServerFn handlers only:
 *
 *   const { requireUser, createSupabaseServerClient } = await import("./auth.server");
 *
 * @file src/serverFns/auth.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const emptyInputSchema = z.object({});

/**
 * Returns the current authenticated user (or null) via request cookies.
 * Safe to call from client (RPC) or other serverFns.
 */
export const getCurrentUserServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => emptyInputSchema.parse(input ?? {}))
  .handler(async () => {
    const { createSupabaseServerClient, mapSupabaseUserToAuthUser } = await import("./auth.server");
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw new Error(`Failed to read auth session on the server: ${error.message}`);
    }

    return {
      user: mapSupabaseUserToAuthUser(user),
    };
  });

/**
 * Delete the authenticated user's account (web cookie authority).
 * Native clients must use POST /api/mobile/v1/account/delete instead.
 */
export const deleteAccountServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => emptyInputSchema.parse(input ?? {}))
  .handler(async () => {
    const { requireUser } = await import("./auth.server");
    const { createServiceRoleSupabase } = await import("@/platform/supabase/service.server");
    const { executeAccountDeletion, AccountDeletionError } =
      await import("@/features/account-deletion/application/executeAccountDeletion.server");

    const user = await requireUser();
    try {
      return await executeAccountDeletion(user.id, createServiceRoleSupabase());
    } catch (err) {
      if (err instanceof AccountDeletionError) {
        throw new Error(err.message);
      }
      const message = err instanceof Error ? err.message : "";
      if (/Missing SUPABASE_SERVICE_ROLE_KEY|Missing SUPABASE_URL/i.test(message)) {
        throw new Error("Account deletion is temporarily unavailable. Please try again.");
      }
      throw new Error("Account deletion failed.");
    }
  });
