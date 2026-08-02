/**
 * Presentation-safe deal chat send mutation + optimistic message lifecycle (AO-1J1).
 *
 * Owns:
 * - useMutation + sendMessageServerFn
 * - await cancelQueries on message key
 * - snapshot / optimistic user append / opt-* strip + server merge on success
 * - snapshot rollback on error
 * - deal_message_sent analytics on success
 * - optional onOptimisticClearDraft (draft state remains in DealChat)
 *
 * Does not own: thread create, thread list invalidation, realtime channel
 * lifecycle, draft React state, toasts, or message/thread reads.
 */
import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { trackEvent } from "@/lib/analytics";
import { sendMessageServerFn, type DealMessageRow } from "@/serverFns/dealChat";
import { dealChatKeys } from "../../query/dealChatKeys";

export interface UseSendDealChatMessageOptions {
  opportunityId: string;
  threadId: string | null;
  onOptimisticClearDraft?: () => void;
}

/**
 * Migration-built deal_messages includes image_urls text[] NOT NULL.
 * Tracked generated types omit the column until full canonical adoption (B6).
 * Intersection keeps both typecheck surfaces valid without handwritten gen edits.
 */
export type DealMessageCacheRow = DealMessageRow & { image_urls: string[] };

type SendResult = {
  userMessage: DealMessageRow;
  assistantMessage: DealMessageRow;
};

type OptimisticContext = {
  prev: DealMessageRow[];
};

export function useSendDealChatMessage(options: UseSendDealChatMessageOptions) {
  const { opportunityId, threadId } = options;
  const queryClient = useQueryClient();
  const clearDraftRef = useRef(options.onOptimisticClearDraft);
  clearDraftRef.current = options.onOptimisticClearDraft;

  return useMutation<SendResult, Error, string, OptimisticContext | undefined>({
    mutationFn: (content: string) => {
      if (!threadId) {
        throw new Error("No thread selected");
      }
      return sendMessageServerFn({
        data: { threadId, content, opportunityId },
      });
    },
    onMutate: async (content) => {
      // Defensive: component guards prevent normal null-thread sends.
      if (!threadId) {
        return undefined;
      }

      const key = dealChatKeys.messages(threadId);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<DealMessageRow[]>(key) ?? [];
      const optimistic: DealMessageCacheRow = {
        id: `opt-${Date.now()}`,
        thread_id: threadId,
        role: "user",
        content,
        structured_output: null,
        metadata: {},
        // Canonical deal_messages.image_urls is NOT NULL text[] (default '{}').
        // Text-only optimistic rows must supply an empty array, never undefined.
        image_urls: [],
        created_at: new Date().toISOString(),
      };
      // Cache is typed as DealMessageRow[]; migration field is additive.
      queryClient.setQueryData<DealMessageRow[]>(key, [...prev, optimistic]);
      clearDraftRef.current?.();
      return { prev };
    },
    onSuccess: ({ userMessage, assistantMessage }) => {
      if (!threadId) return;
      queryClient.setQueryData<DealMessageRow[]>(dealChatKeys.messages(threadId), (old = []) => {
        const withoutOptimistic = old.filter((m) => !m.id.startsWith("opt-"));
        return [...withoutOptimistic, userMessage, assistantMessage];
      });
      trackEvent("deal_message_sent");
    },
    onError: (_err, _content, context) => {
      if (!threadId) return;
      if (context?.prev) {
        queryClient.setQueryData(dealChatKeys.messages(threadId), context.prev);
      }
    },
  });
}
