/**
 * Pure native-safe Supabase user → AuthUser mapper (IOS-READINESS-2B-3).
 *
 * Type-only AuthUser import; no web cookie client or server mappers.
 * Semantics match the legacy user mapping for id / email / fullName.
 */
import type { AuthUser } from "@/lib/auth";

/**
 * Map a Supabase auth user to the app AuthUser shape, or null when absent.
 */
export function mapNativeSupabaseUser(
  user:
    | {
        id: string;
        email?: string | null;
        user_metadata?: Record<string, unknown>;
      }
    | null
    | undefined,
): AuthUser | null {
  if (!user) return null;

  const meta = user.user_metadata;
  const fullName =
    (typeof meta?.full_name === "string" ? meta.full_name : undefined) ??
    (typeof meta?.name === "string" ? meta.name : undefined);

  return {
    id: user.id,
    email: user.email ?? "",
    fullName,
  };
}
