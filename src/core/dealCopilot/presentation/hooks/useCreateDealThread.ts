/**
 * Presentation-safe deal thread creation (AO-1J1).
 *
 * Owns:
 * - useMutation + createThreadServerFn
 * - fire-and-forget threads list invalidation (dealChatKeys.threads)
 * - deal_thread_created analytics on success
 * - optional onCreated callback (selection stays in DealChat)
 *
 * Does not own thread/message reads, selectedThreadId state, message cache,
 * realtime lifecycle, voice input, or UI rendering.
 */
import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { trackEvent } from "@/lib/analytics";
import { createThreadServerFn, type DealThreadRow } from "@/serverFns/dealChat";
import { dealChatKeys } from "../../query/dealChatKeys";

export interface CreateDealThreadInput {
  title: string;
}

export interface UseCreateDealThreadOptions {
  onCreated?: (thread: DealThreadRow) => void;
}

export function useCreateDealThread(opportunityId: string, options?: UseCreateDealThreadOptions) {
  const queryClient = useQueryClient();
  const onCreatedRef = useRef(options?.onCreated);
  onCreatedRef.current = options?.onCreated;

  return useMutation<DealThreadRow, Error, CreateDealThreadInput>({
    mutationFn: ({ title }) =>
      createThreadServerFn({
        data: { opportunityId, title },
      }),
    onSuccess: (thread) => {
      // Source order: invalidate threads → select created thread → analytics.
      void queryClient.invalidateQueries({
        queryKey: dealChatKeys.threads(opportunityId),
      });
      onCreatedRef.current?.(thread);
      trackEvent("deal_thread_created");
    },
  });
}
