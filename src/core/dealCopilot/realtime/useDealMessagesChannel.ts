/**
 * Deal Copilot — browser Realtime lifecycle for deal_messages (C3).
 *
 * Owns supabase.channel / postgres_changes / removeChannel for a single thread.
 * Presentation (DealChat) supplies only an onInsert callback (e.g. query invalidation).
 * Does not own React Query keys, CRUD, AI, or UI.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/platform/supabase/browser";

/**
 * Subscribe to INSERT events on public.deal_messages for the given thread.
 * Preserves historical DealChat channel identity and cleanup behaviour.
 */
export function useDealMessagesChannel(threadId: string | null, onInsert: () => void): void {
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;

  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`deal-messages-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "deal_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          onInsertRef.current();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);
}
