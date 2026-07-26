/**
 * Canonical browser-side marketplace write primitives (AO-1B1 / AO-1B2 / AO-1B3.1).
 *
 * Owns direct inserts/deletes for `trade_favorites`, inserts for `quote_requests`,
 * and inserts for `trade_messages`.
 * Does NOT coordinate React Query, Auth resolution, or UI toasts —
 * presentation/hooks supply identity and cache orchestration.
 */
import { supabase } from "@/platform/supabase/browser";
import { logger } from "@/lib/logger";

export interface AddTradeFavoriteInput {
  userId: string;
  tradespersonId: string;
}

export interface RemoveTradeFavoriteInput {
  favoriteId: string;
}

/** Canonical favorite row for cache reconciliation (camelCase domain shape). */
export interface TradeFavoriteRecord {
  id: string;
  userId: string;
  tradespersonId: string;
  createdAt?: string;
}

export interface CreateQuoteRequestInput {
  userId: string;
  tradespersonId: string;
  /**
   * Persisted as project_id. Empty string is allowed to match current
   * QuoteRequestDialog projectless behaviour (do not convert to null/omit).
   */
  projectId: string;
  title: string;
  message: string;
  /** Optional budget in the same units as the UI (numeric pounds, not pence). */
  proposedPrice?: number;
}

function requireNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

/**
 * Insert a trade favorite for the given user and tradesperson.
 * Returns the mapped inserted row (including server-generated id).
 */
export async function addTradeFavorite(input: AddTradeFavoriteInput): Promise<TradeFavoriteRecord> {
  const userId = requireNonEmpty(input.userId, "userId");
  const tradespersonId = requireNonEmpty(input.tradespersonId, "tradespersonId");

  const { data, error } = await supabase
    .from("trade_favorites")
    .insert({
      user_id: userId,
      tradesperson_id: tradespersonId,
    })
    .select("id, user_id, tradesperson_id, created_at")
    .single();

  if (error) {
    logger.error("[marketplace-write] addTradeFavorite failed", {
      userId,
      tradespersonId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Favorite insert returned no row");
  }

  return {
    id: data.id,
    userId: data.user_id,
    tradespersonId: data.tradesperson_id,
    createdAt: data.created_at ?? undefined,
  };
}

/**
 * Delete a trade favorite by canonical row id.
 *
 * Zero-row delete is treated as success (idempotent): product UX only requires
 * the favorite to be absent after the operation; current component behaviour
 * already skipped delete when no matching row existed.
 */
export async function removeTradeFavorite(input: RemoveTradeFavoriteInput): Promise<void> {
  const favoriteId = requireNonEmpty(input.favoriteId, "favoriteId");

  const { error } = await supabase.from("trade_favorites").delete().eq("id", favoriteId);

  if (error) {
    logger.error("[marketplace-write] removeTradeFavorite failed", {
      favoriteId,
      error: error.message,
    });
    throw new Error(error.message);
  }
}

/**
 * Insert a marketplace quote request.
 *
 * Preserves current QuoteRequestDialog payload semantics, including:
 * - project_id may be "" (projectless marketplace flow)
 * - proposed_price omitted when undefined (type/schema drift uses a narrow cast)
 * - no pence conversion
 *
 * Does not return a row — current UX does not require the inserted record.
 */
export async function createQuoteRequest(input: CreateQuoteRequestInput): Promise<void> {
  const userId = requireNonEmpty(input.userId, "userId");
  const tradespersonId = requireNonEmpty(input.tradespersonId, "tradespersonId");
  const title = requireNonEmpty(input.title, "title");
  const message = requireNonEmpty(input.message, "message");

  // projectId is intentionally not requireNonEmpty — "" is a valid current product value.
  if (typeof input.projectId !== "string") {
    throw new Error("projectId is required");
  }
  const projectId = input.projectId;

  if (input.proposedPrice !== undefined && !Number.isFinite(input.proposedPrice)) {
    throw new Error("Proposed price must be a valid number");
  }

  // Generated Insert types omit proposed_price (schema drift). Narrow escape hatch only.
  const payload: Record<string, unknown> = {
    user_id: userId,
    tradesperson_id: tradespersonId,
    project_id: projectId,
    status: "pending",
    title,
    message,
  };
  if (input.proposedPrice !== undefined) {
    payload.proposed_price = input.proposedPrice;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- proposed_price not in generated Insert
  const { error } = await supabase.from("quote_requests").insert([payload] as any);

  if (error) {
    logger.error("[marketplace-write] createQuoteRequest failed", {
      userId,
      tradespersonId,
      projectId: projectId || null,
      error: error.message,
    });
    throw new Error(error.message);
  }
}

export interface SendTradeMessageInput {
  quoteRequestId: string;
  senderId: string;
  recipientId: string;
  body: string;
}

/**
 * Insert a marketplace trade message.
 *
 * Preserves current MessagingInbox payload semantics:
 * - body field (not legacy foundation `content`)
 * - no .select() / no returned row
 * - sender/recipient equality is not client-rejected
 *
 * Does not resolve participants, Auth, React Query, or Realtime.
 */
export async function sendTradeMessage(input: SendTradeMessageInput): Promise<void> {
  const quoteRequestId = requireNonEmpty(input.quoteRequestId, "quoteRequestId");
  const senderId = requireNonEmpty(input.senderId, "senderId");
  const recipientId = requireNonEmpty(input.recipientId, "recipientId");
  const body = requireNonEmpty(input.body, "body");

  const { error } = await supabase.from("trade_messages").insert({
    quote_request_id: quoteRequestId,
    sender_id: senderId,
    recipient_id: recipientId,
    body,
  });

  if (error) {
    logger.error("[marketplace-write] sendTradeMessage failed", {
      quoteRequestId,
      senderId,
      recipientId,
      error: error.message,
    });
    throw new Error(error.message);
  }
}
