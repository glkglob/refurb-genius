import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { logger } from "@/lib/logger";
import type { Tables } from "@repo/supabase";
import type {
  Tradeperson,
  TradeSpecialty,
  TradeFavorite,
  QuoteRequest,
  TradeMessage,
} from "@repo/types";
import { optimisticSetList, rollbackList } from "./projects";

type TradepersonRow = Tables<"tradespeople">;
type TradeSpecialtyRow = Tables<"trade_specialties">;
type TradeFavoriteRow = Tables<"trade_favorites">;
type QuoteRequestRow = Tables<"quote_requests">;
type TradeMessageRow = Tables<"trade_messages">;

/**
 * Marketplace query keys.
 * Not always project-scoped; tradesperson discovery is global (RLS + filters apply).
 */
export const marketplaceKeys = {
  all: ["marketplace"] as const,
  tradespeople: () => [...marketplaceKeys.all, "tradespeople"] as const,
  tradesperson: (id: string) => [...marketplaceKeys.tradespeople(), id] as const,
  specialtiesByTradeperson: (id: string) =>
    [...marketplaceKeys.tradesperson(id), "specialties"] as const,
  favoritesByUser: (userId: string) => [...marketplaceKeys.all, "favorites", userId] as const,
  quoteRequestsByProject: (projectId: string) =>
    [...marketplaceKeys.all, "quotes", "project", projectId] as const,
  quoteRequestsByTradeperson: (tradespersonId: string) =>
    [...marketplaceKeys.all, "quotes", "tradesperson", tradespersonId] as const,
  messagesByQuote: (quoteId: string) => [...marketplaceKeys.all, "messages", quoteId] as const,
};

/**
 * List tradesperson profiles (for marketplace browse / search).
 * RLS ensures only visible/approved ones surface; client can add .ilike filters.
 */
export const tradespeopleQueryOptions = () =>
  queryOptions<TradepersonRow[]>({
    queryKey: marketplaceKeys.tradespeople(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tradespeople")
        .select("*")
        .order("rating", { ascending: false })
        .order("review_count", { ascending: false })
        .limit(100);

      if (error) {
        logger.error("[queries] tradespeople list failed", { error: error.message });
        throw new Error(error.message);
      }
      return (data ?? []) as TradepersonRow[];
    },
    staleTime: 5 * 60 * 1000, // 5 min - directory data is semi-static
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

/**
 * Single tradesperson + specialties (for profile card / quote flow).
 */
export const tradespersonQueryOptions = (tradespersonId: string) =>
  queryOptions<TradepersonRow | null>({
    queryKey: marketplaceKeys.tradesperson(tradespersonId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tradespeople")
        .select("*")
        .eq("id", tradespersonId)
        .maybeSingle();

      if (error) {
        logger.error("[queries] tradesperson fetch failed", {
          tradespersonId,
          error: error.message,
        });
        throw new Error(error.message);
      }
      return (data as TradepersonRow | null) ?? null;
    },
    enabled: !!tradespersonId,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  });

export const tradeSpecialtiesQueryOptions = (tradespersonId: string) =>
  queryOptions<TradeSpecialtyRow[]>({
    queryKey: marketplaceKeys.specialtiesByTradeperson(tradespersonId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_specialties")
        .select("*")
        .eq("tradesperson_id", tradespersonId);

      if (error) {
        logger.error("[queries] specialties fetch failed", {
          tradespersonId,
          error: error.message,
        });
        throw new Error(error.message);
      }
      return (data ?? []) as TradeSpecialtyRow[];
    },
    enabled: !!tradespersonId,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 1,
  });

/**
 * Current user's favorited tradespeople.
 */
export const tradeFavoritesQueryOptions = (userId: string) =>
  queryOptions<TradeFavoriteRow[]>({
    queryKey: marketplaceKeys.favoritesByUser(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_favorites")
        .select("*")
        .eq("user_id", userId);

      if (error) {
        logger.error("[queries] favorites fetch failed", { userId, error: error.message });
        throw new Error(error.message);
      }
      return (data ?? []) as TradeFavoriteRow[];
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

/**
 * Quote requests for a project (investor side) or for a tradesperson (trade side).
 */
export const quoteRequestsByProjectQueryOptions = (projectId: string) =>
  queryOptions<QuoteRequestRow[]>({
    queryKey: marketplaceKeys.quoteRequestsByProject(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_requests")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("[queries] quote requests (project) fetch failed", {
          projectId,
          error: error.message,
        });
        throw new Error(error.message);
      }
      return (data ?? []) as QuoteRequestRow[];
    },
    enabled: !!projectId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

export const quoteRequestsByTradepersonQueryOptions = (tradespersonId: string) =>
  queryOptions<QuoteRequestRow[]>({
    queryKey: marketplaceKeys.quoteRequestsByTradeperson(tradespersonId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_requests")
        .select("*")
        .eq("tradesperson_id", tradespersonId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("[queries] quote requests (trade) fetch failed", {
          tradespersonId,
          error: error.message,
        });
        throw new Error(error.message);
      }
      return (data ?? []) as QuoteRequestRow[];
    },
    enabled: !!tradespersonId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

/**
 * Messages thread for a quote request (chat).
 */
export const tradeMessagesQueryOptions = (quoteRequestId: string) =>
  queryOptions<TradeMessageRow[]>({
    queryKey: marketplaceKeys.messagesByQuote(quoteRequestId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_messages")
        .select("*")
        .eq("quote_request_id", quoteRequestId)
        .order("created_at", { ascending: true });

      if (error) {
        logger.error("[queries] trade messages fetch failed", {
          quoteRequestId,
          error: error.message,
        });
        throw new Error(error.message);
      }
      return (data ?? []) as TradeMessageRow[];
    },
    enabled: !!quoteRequestId,
    staleTime: 15 * 1000, // chatty
    gcTime: 3 * 60 * 1000,
    retry: 1,
  });

/**
 * Example optimistic toggle for favorites (use in a useMutation hook):
 *
 * const toggleFavorite = useMutation({
 *   mutationFn: async ({ tradespersonId, isFav }: { tradespersonId: string; isFav: boolean }) => { ... insert/delete ... },
 *   onMutate: async ({ tradespersonId, isFav }) => {
 *     await qc.cancelQueries({ queryKey: marketplaceKeys.favoritesByUser(userId) });
 *     const previous = optimisticSetList(qc, marketplaceKeys.favoritesByUser(userId), (old = []) => {
 *       if (isFav) return old.filter(f => f.tradesperson_id !== tradespersonId);
 *       return [...old, { id: 'temp', user_id: userId, tradesperson_id: tradespersonId, created_at: new Date().toISOString() }];
 *     });
 *     return { previous };
 *   },
 *   onError: (_e, _v, ctx) => { if (ctx?.previous) rollbackList(qc, key, ctx.previous); },
 *   onSettled: () => qc.invalidateQueries({ queryKey: marketplaceKeys.favoritesByUser(userId) }),
 * });
 */
