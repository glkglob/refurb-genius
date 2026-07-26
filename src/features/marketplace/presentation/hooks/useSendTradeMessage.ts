/**
 * Presentation-safe trade message send mutation (AO-1B3.1).
 *
 * Owns mutation orchestration and exact messagesByQuote invalidation.
 * Delegates persistence to src/lib/marketplace-write.ts sendTradeMessage.
 * Does not own toasts, form state, Realtime channels, or participant discovery.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendTradeMessage } from "@/lib/marketplace-write";
import { marketplaceKeys } from "@/lib/queries/marketplace";

export interface SendTradeMessageMutationInput {
  quoteRequestId: string;
  recipientId: string;
  body: string;
}

/**
 * Mutation hook for sending a trade message as the signed-in user.
 * Pass the same userId from useAuth (hook-level identity is authoritative).
 */
export function useSendTradeMessage(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, SendTradeMessageMutationInput>({
    mutationFn: async (input) => {
      if (!userId?.trim()) {
        throw new Error("You must be signed in");
      }
      await sendTradeMessage({
        quoteRequestId: input.quoteRequestId,
        senderId: userId,
        recipientId: input.recipientId,
        body: input.body,
      });
    },
    retry: false,
    onSuccess: (_data, input) => {
      const quoteRequestId = input.quoteRequestId?.trim();
      if (quoteRequestId) {
        // Insert success is authoritative; invalidation must not become user-facing failure.
        void queryClient.invalidateQueries({
          queryKey: marketplaceKeys.messagesByQuote(quoteRequestId),
        });
      }
    },
  });
}
