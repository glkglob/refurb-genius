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
 * Delete the authenticated user's account (server-side).
 * Requires SUPABASE_SERVICE_ROLE_KEY on the server.
 */
export const deleteAccountServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => emptyInputSchema.parse(input ?? {}))
  .handler(async () => {
    const { requireUser } = await import("./auth.server");
    const user = await requireUser();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl =
      process.env.SUPABASE_URL ??
      process.env.VITE_SUPABASE_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      throw new Error(
        "Account deletion is not fully configured on the server. Please email support@refurbgenius.info with your account email and we will process deletion within 7 business days.",
      );
    }

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await admin.from("profiles").delete().eq("id", user.id);

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      throw new Error(`Failed to delete account: ${error.message}`);
    }

    return { ok: true as const };
  });
