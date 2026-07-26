/**
 * Canonical browser-side marketplace write primitives (AO-1B1).
 *
 * Owns direct inserts/deletes for `trade_favorites`.
 * Does NOT coordinate React Query, Auth resolution, or UI toasts —
 * presentation/hooks supply identity and cache orchestration.
 */
import { supabase } from "@/platform/supabase/browser";
import { logger } from "@/lib/logger";

export interface AddTradeFavoriteInput {
  userId: string;
  tradespersonId: string;
}

export interface RemoveTradeFavoriteInput {
  favoriteId: string;
}

/** Canonical favorite row for cache reconciliation (camelCase domain shape). */
export interface TradeFavoriteRecord {
  id: string;
  userId: string;
  tradespersonId: string;
  createdAt?: string;
}

function requireNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

/**
 * Insert a trade favorite for the given user and tradesperson.
 * Returns the mapped inserted row (including server-generated id).
 */
export async function addTradeFavorite(input: AddTradeFavoriteInput): Promise<TradeFavoriteRecord> {
  const userId = requireNonEmpty(input.userId, "userId");
  const tradespersonId = requireNonEmpty(input.tradespersonId, "tradespersonId");

  const { data, error } = await supabase
    .from("trade_favorites")
    .insert({
      user_id: userId,
      tradesperson_id: tradespersonId,
    })
    .select("id, user_id, tradesperson_id, created_at")
    .single();

  if (error) {
    logger.error("[marketplace-write] addTradeFavorite failed", {
      userId,
      tradespersonId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Favorite insert returned no row");
  }

  return {
    id: data.id,
    userId: data.user_id,
    tradespersonId: data.tradesperson_id,
    createdAt: data.created_at ?? undefined,
  };
}

/**
 * Delete a trade favorite by canonical row id.
 *
 * Zero-row delete is treated as success (idempotent): product UX only requires
 * the favorite to be absent after the operation; current component behaviour
 * already skipped delete when no matching row existed.
 */
export async function removeTradeFavorite(input: RemoveTradeFavoriteInput): Promise<void> {
  const favoriteId = requireNonEmpty(input.favoriteId, "favoriteId");

  const { error } = await supabase.from("trade_favorites").delete().eq("id", favoriteId);

  if (error) {
    logger.error("[marketplace-write] removeTradeFavorite failed", {
      favoriteId,
      error: error.message,
    });
    throw new Error(error.message);
  }
}
