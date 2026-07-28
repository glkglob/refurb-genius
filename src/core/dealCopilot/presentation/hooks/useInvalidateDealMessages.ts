/**
 * Presentation-safe deal_messages list invalidation (AO-1J1).
 *
 * Owns fire-and-forget invalidateQueries for dealChatKeys.messages(threadId).
 * Used as the useDealMessagesChannel onInsert callback (C3 realtime unchanged).
 *
 * Does not own channel lifecycle, mutations, server functions, or UI.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { dealChatKeys } from "../../query/dealChatKeys";

/**
 * Returns a synchronous callback that fire-and-forgets invalidation of the
 * message list for `threadId`. Null threadId is a no-op.
 *
 * Rejection of the invalidation promise must not throw to the caller (void).
 */
export function useInvalidateDealMessages(threadId: string | null): () => void {
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (!threadId) return;
    void queryClient.invalidateQueries({
      queryKey: dealChatKeys.messages(threadId),
    });
  }, [threadId, queryClient]);
}
