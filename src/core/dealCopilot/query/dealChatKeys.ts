/**
 * Shared Deal Copilot chat query-key authority (AO-1J1).
 *
 * Concrete shapes are frozen for parity with historical DealChat cache ownership:
 *   threads  → ["deal-threads", opportunityId]
 *   messages → ["deal-messages", threadId]
 *
 * Pure factory only — no React, QueryClient, server functions, or persistence.
 */
export const dealChatKeys = {
  threads: (opportunityId: string) => ["deal-threads", opportunityId] as const,
  messages: (threadId: string) => ["deal-messages", threadId] as const,
};
