/**
 * Presentation-safe marketplace favorite toggle (AO-1B1).
 *
 * Owns React Query optimistic cache for favoritesByUser.
 * Delegates persistence to src/lib/marketplace-write.ts.
 * Does not own toasts or raw Supabase clients.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addTradeFavorite,
  removeTradeFavorite,
  type TradeFavoriteRecord,
} from "@/lib/marketplace-write";
import { marketplaceKeys } from "@/lib/queries/marketplace";
import { optimisticSetList, rollbackList } from "@/lib/queries/projects";
import type { Tables } from "@repo/supabase";

type TradeFavoriteRow = Tables<"trade_favorites">;

export interface ToggleTradeFavoriteInput {
  userId: string;
  tradespersonId: string;
  isFavorited: boolean;
  /** Required when isFavorited is true (canonical favorite row id). */
  favoriteId?: string;
}

export interface ToggleTradeFavoriteResult {
  action: "add" | "remove";
  record?: TradeFavoriteRecord;
}

type OptimisticCtx = {
  /** Snapshot before optimistic write; empty array when the key had no cache. */
  previous: TradeFavoriteRow[];
  tempId?: string;
  didOptimistic: boolean;
};

/**
 * Mutation hook for toggling a tradesperson favorite for a given user.
 * Pass the same userId used for tradeFavoritesQueryOptions.
 */
export function useToggleTradeFavorite(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation<ToggleTradeFavoriteResult, Error, ToggleTradeFavoriteInput, OptimisticCtx>({
    mutationFn: async (input) => {
      if (!input.userId.trim()) {
        throw new Error("Sign in to favorite");
      }
      if (!input.tradespersonId.trim()) {
        throw new Error("tradespersonId is required");
      }

      if (input.isFavorited) {
        if (!input.favoriteId?.trim()) {
          // Match prior component: no-op remote delete when row missing.
          return { action: "remove" };
        }
        // Never send optimistic/temp ids to the database.
        if (input.favoriteId.startsWith("temp-")) {
          throw new Error("Favorite is still saving; try again");
        }
        await removeTradeFavorite({ favoriteId: input.favoriteId });
        return { action: "remove" };
      }

      const record = await addTradeFavorite({
        userId: input.userId,
        tradespersonId: input.tradespersonId,
      });
      return { action: "add", record };
    },

    onMutate: async (input) => {
      if (!userId || userId !== input.userId) {
        return { previous: [], didOptimistic: false };
      }

      const key = marketplaceKeys.favoritesByUser(userId);
      await queryClient.cancelQueries({ queryKey: key });

      let tempId: string | undefined;
      const previousRaw = optimisticSetList<TradeFavoriteRow>(queryClient, key, (old = []) => {
        if (input.isFavorited) {
          return old.filter((f) => f.tradesperson_id !== input.tradespersonId);
        }
        tempId = `temp-${Date.now()}`;
        return [
          ...old,
          {
            id: tempId,
            user_id: input.userId,
            tradesperson_id: input.tradespersonId,
            created_at: new Date().toISOString(),
          } as TradeFavoriteRow,
        ];
      });

      // Always snapshot for rollback — including "no prior cache" (undefined → []).
      return { previous: previousRaw ?? [], tempId, didOptimistic: true };
    },

    onSuccess: (result, input, ctx) => {
      if (!userId || userId !== input.userId || result.action !== "add" || !result.record) {
        return;
      }
      const key = marketplaceKeys.favoritesByUser(userId);
      const canonical = result.record;
      queryClient.setQueryData<TradeFavoriteRow[]>(key, (old = []) => {
        // Replace temp/prior rows for this tradesperson with the server row.
        const cleaned = old.filter(
          (f) =>
            f.tradesperson_id !== input.tradespersonId && !(ctx?.tempId && f.id === ctx.tempId),
        );
        return [
          ...cleaned,
          {
            id: canonical.id,
            user_id: canonical.userId,
            tradesperson_id: canonical.tradespersonId,
            created_at: canonical.createdAt ?? new Date().toISOString(),
          } as TradeFavoriteRow,
        ];
      });
    },

    onError: (_err, input, ctx) => {
      if (ctx?.didOptimistic && userId && userId === input.userId) {
        rollbackList(queryClient, marketplaceKeys.favoritesByUser(userId), ctx.previous);
      }
    },

    onSettled: (_data, _err, input) => {
      if (userId && userId === input.userId) {
        void queryClient.invalidateQueries({
          queryKey: marketplaceKeys.favoritesByUser(userId),
        });
      }
    },
  });
}
