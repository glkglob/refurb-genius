/**
 * Pure participant resolution for marketplace trade messages (AO-1B3.1).
 *
 * Preserves MessagingInbox semantics exactly:
 * - when current user is the quote requester → recipient is quote.tradesperson_id
 *   (tradesperson profile id, not tradespeople.user_id)
 * - otherwise → recipient is quote.user_id
 *
 * No IO, React, Supabase, or Auth.
 */

export interface ResolveTradeMessageRecipientInput {
  currentUserId: string;
  quoteUserId: string;
  /** quote_requests.tradesperson_id (profile id) */
  quoteTradespersonId: string;
}

export function resolveTradeMessageRecipient(input: ResolveTradeMessageRecipientInput): string {
  return input.currentUserId === input.quoteUserId ? input.quoteTradespersonId : input.quoteUserId;
}
