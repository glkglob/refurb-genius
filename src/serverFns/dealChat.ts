/**
 * Server functions for Deal Copilot conversation threads.
 *
 * Provides:
 *   createThreadServerFn   — create a new thread for an opportunity
 *   sendMessageServerFn    — save user message, call AI, save reply
 *   listMessagesServerFn   — load messages for a thread
 *   listThreadsServerFn    — list threads for an opportunity
 *
 * Auth: all functions require a signed-in user (requireUser()).
 * RLS enforces per-user ownership on both tables.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireUser, createSupabaseServerClient } from "@/serverFns/auth";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";
import type { Tables } from "@repo/supabase";

export type DealThreadRow = Tables<"deal_threads">;
export type DealMessageRow = Tables<"deal_messages">;

// ─── Create thread ────────────────────────────────────────────────────────────

const createThreadSchema = z.object({
  opportunityId: z.string().min(1),
  title: z.string().max(120).optional(),
});

export const createThreadServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createThreadSchema.parse(input))
  .handler(async ({ data }): Promise<DealThreadRow> => {
    const user = await requireUser();

    const rl = checkRateLimit(rateLimitKeyForUser(user.id, "deal-thread-create"));
    if (!rl.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
    }

    const supabase = await createSupabaseServerClient();

    const { data: row, error } = await supabase
      .from("deal_threads")
      .insert({
        opportunity_id: data.opportunityId,
        user_id: user.id,
        title: data.title ?? null,
      })
      .select()
      .single();

    if (error || !row) throw new Error(error?.message ?? "Failed to create thread");
    return row;
  });

// ─── List threads ─────────────────────────────────────────────────────────────

const listThreadsSchema = z.object({ opportunityId: z.string().min(1) });

export const listThreadsServerFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => listThreadsSchema.parse(input))
  .handler(async ({ data }): Promise<DealThreadRow[]> => {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();

    const { data: rows, error } = await supabase
      .from("deal_threads")
      .select("*")
      .eq("opportunity_id", data.opportunityId)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ─── List messages ────────────────────────────────────────────────────────────

const listMessagesSchema = z.object({
  threadId: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
});

export const listMessagesServerFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => listMessagesSchema.parse(input))
  .handler(async ({ data }): Promise<DealMessageRow[]> => {
    await requireUser();
    const supabase = await createSupabaseServerClient();

    const { data: rows, error } = await supabase
      .from("deal_messages")
      .select("*")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(data.limit ?? 50);

    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ─── Send message ─────────────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  threadId: z.string().min(1),
  content: z.string().min(1).max(4000),
  opportunityId: z.string().min(1),
});

export const sendMessageServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sendMessageSchema.parse(input))
  .handler(
    async ({
      data,
    }): Promise<{ userMessage: DealMessageRow; assistantMessage: DealMessageRow }> => {
      const user = await requireUser();

      const limit = checkRateLimit(rateLimitKeyForUser(user.id, "deal-chat"));
      if (!limit.allowed) {
        throw new Error(
          `Rate limit reached. Please wait ${limit.retryAfter}s before sending again.`,
        );
      }

      const supabase = await createSupabaseServerClient();

      // Verify thread ownership (RLS also enforces this, but fail fast with a clear error).
      const { data: thread, error: threadErr } = await supabase
        .from("deal_threads")
        .select("id, user_id, opportunity_id")
        .eq("id", data.threadId)
        .single();

      if (threadErr || !thread) throw new Error("Thread not found");
<<<<<<< HEAD
      if (thread.user_id !== user.id) throw new Error("Unauthorised");
=======
      if (thread.user_id !== user.id) throw new Error("Unauthorized");
>>>>>>> origin/main

      // Fetch opportunity for AI context (trust thread FK, not client input).
      if (thread.opportunity_id !== data.opportunityId) {
        throw new Error("Thread does not belong to this opportunity");
      }

      const { data: opp, error: oppErr } = await supabase
        .from("deal_opportunities")
        .select(
          "title, status, postcode, property_type, bedrooms, purchase_price, estimated_gdv, refurb_budget",
        )
        .eq("id", thread.opportunity_id)
        .single();

      if (oppErr || !opp) throw new Error("Opportunity not found");
      // Load recent history (last 20 messages) to pass as conversation context.
      const { data: history = [] } = await supabase
        .from("deal_messages")
        .select("role, content")
        .eq("thread_id", data.threadId)
        .order("created_at", { ascending: false })
        .limit(20);

      const orderedHistory = (history as Array<{ role: string; content: string }>)
        .reverse()
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      // Persist user message.
      const { data: userMsg, error: userMsgErr } = await supabase
        .from("deal_messages")
        .insert({ thread_id: data.threadId, role: "user", content: data.content })
        .select()
        .single();

      if (userMsgErr || !userMsg) throw new Error(userMsgErr?.message ?? "Failed to save message");

      // Call AI.
      const { runDealChat } = await import("@/core/dealCopilot/server/dealChat.adapter.server");

      const reply = await runDealChat(data.content, orderedHistory, {
        opportunityTitle: opp?.title ?? "Unknown",
        opportunityStatus: opp?.status ?? "draft",
        postcode: opp?.postcode ?? undefined,
        propertyType: opp?.property_type ?? undefined,
        bedrooms: opp?.bedrooms ?? undefined,
        purchasePrice: opp?.purchase_price ?? undefined,
        estimatedGdv: opp?.estimated_gdv ?? undefined,
        refurbBudget: opp?.refurb_budget ?? undefined,
      });

      // Persist assistant reply.
      const { data: assistantMsg, error: assistantMsgErr } = await supabase
        .from("deal_messages")
        .insert({ thread_id: data.threadId, role: "assistant", content: reply })
        .select()
        .single();

      if (assistantMsgErr || !assistantMsg)
        throw new Error(assistantMsgErr?.message ?? "Failed to save reply");

      // Bump thread updated_at.
      await supabase
        .from("deal_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", data.threadId);

      return { userMessage: userMsg, assistantMessage: assistantMsg };
    },
  );
