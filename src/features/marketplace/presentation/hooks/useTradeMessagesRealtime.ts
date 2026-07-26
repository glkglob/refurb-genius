/**
 * Presentation-safe trade_messages Realtime lifecycle (AO-1B3.2).
 *
 * Owns channel create / postgres_changes INSERT / exact messagesByQuote
 * invalidation / SUBSCRIBED log / removeChannel cleanup.
 * Does not own reads, send, recipient, toasts, or selection state.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { marketplaceKeys } from "@/lib/queries/marketplace";
import { supabase } from "@/platform/supabase/browser";

/**
 * Subscribe to INSERT events on public.trade_messages for the given quote request.
 * Preserves historical MessagingInbox channel identity, filter, log, and cleanup.
 */
export function useTradeMessagesRealtime(quoteRequestId?: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!quoteRequestId) return;

    const channel = supabase
      .channel(`trade-messages-${quoteRequestId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trade_messages",
          filter: `quote_request_id=eq.${quoteRequestId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: marketplaceKeys.messagesByQuote(quoteRequestId),
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          logger.info("[marketplace] realtime subscribed to messages", {
            selectedQuoteId: quoteRequestId,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quoteRequestId, queryClient]);
}
