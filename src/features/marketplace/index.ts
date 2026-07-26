/**
 * Marketplace feature public API (AO-1B1 / AO-1B2 / AO-1B3.1).
 *
 * Presentation and routes import from this barrel only.
 * Persistence for marketplace writes lives in `@/lib/marketplace-write`.
 */
export {
  useToggleTradeFavorite,
  type ToggleTradeFavoriteInput,
  type ToggleTradeFavoriteResult,
} from "./presentation/hooks/useToggleTradeFavorite";

export {
  useCreateQuoteRequest,
  type CreateQuoteRequestMutationInput,
} from "./presentation/hooks/useCreateQuoteRequest";

export {
  useSendTradeMessage,
  type SendTradeMessageMutationInput,
} from "./presentation/hooks/useSendTradeMessage";

export {
  resolveTradeMessageRecipient,
  type ResolveTradeMessageRecipientInput,
} from "./presentation/resolveTradeMessageRecipient";
