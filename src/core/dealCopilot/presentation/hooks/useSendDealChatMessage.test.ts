/**
 * AO-1J1 — useSendDealChatMessage optimistic lifecycle parity tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { dealChatKeys } from "../../query/dealChatKeys";
import type { DealMessageRow } from "@/serverFns/dealChat";

const sendMessageServerFn = vi.fn();
const trackEvent = vi.fn();

vi.mock("@/serverFns/dealChat", () => ({
  sendMessageServerFn: (...args: unknown[]) => sendMessageServerFn(...args),
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

import { useSendDealChatMessage, type DealMessageCacheRow } from "./useSendDealChatMessage";

const OPP = "opp-1";
const THREAD = "thread-1";
const THREAD_B = "thread-b";

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

function createQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function makeRow(
  partial: Partial<DealMessageCacheRow> & Pick<DealMessageCacheRow, "id" | "role" | "content">,
): DealMessageCacheRow {
  return {
    thread_id: THREAD,
    structured_output: null,
    metadata: {},
    // Required by migration-built deal_messages.image_urls (text[] NOT NULL).
    image_urls: [],
    created_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

beforeEach(() => {
  sendMessageServerFn.mockReset();
  trackEvent.mockReset();
});

describe("useSendDealChatMessage", () => {
  it("calls sendMessageServerFn with exact threadId, content, opportunityId payload", async () => {
    const qc = createQc();
    const userMessage = makeRow({ id: "u1", role: "user", content: "Hello" });
    const assistantMessage = makeRow({ id: "a1", role: "assistant", content: "Hi" });
    sendMessageServerFn.mockResolvedValue({ userMessage, assistantMessage });

    const { result } = renderHook(
      () => useSendDealChatMessage({ opportunityId: OPP, threadId: THREAD }),
      { wrapper: createWrapper(qc) },
    );

    await act(async () => {
      await result.current.mutateAsync("Hello");
    });

    expect(sendMessageServerFn).toHaveBeenCalledTimes(1);
    expect(sendMessageServerFn).toHaveBeenCalledWith({
      data: { threadId: THREAD, content: "Hello", opportunityId: OPP },
    });
  });

  it("awaits cancelQueries on exact message key before snapshot/write", async () => {
    const qc = createQc();
    const order: string[] = [];
    const cancelSpy = vi.spyOn(qc, "cancelQueries").mockImplementation(async () => {
      order.push("cancel");
    });
    const getSpy = vi.spyOn(qc, "getQueryData").mockImplementation((key) => {
      order.push("get");
      return qc.getQueryCache().find({ queryKey: key as readonly unknown[] })?.state.data;
    });
    const setSpy = vi.spyOn(qc, "setQueryData").mockImplementation((key, updater) => {
      order.push("set");
      return QueryClient.prototype.setQueryData.call(qc, key, updater);
    });

    sendMessageServerFn.mockResolvedValue({
      userMessage: makeRow({ id: "u1", role: "user", content: "x" }),
      assistantMessage: makeRow({ id: "a1", role: "assistant", content: "y" }),
    });

    const { result } = renderHook(
      () => useSendDealChatMessage({ opportunityId: OPP, threadId: THREAD }),
      { wrapper: createWrapper(qc) },
    );

    await act(async () => {
      await result.current.mutateAsync("x");
    });

    expect(cancelSpy).toHaveBeenCalledWith({
      queryKey: dealChatKeys.messages(THREAD),
    });
    expect(order.indexOf("cancel")).toBeLessThan(order.indexOf("get"));
    expect(order.indexOf("get")).toBeLessThan(order.indexOf("set"));
    // Concrete key shape
    expect(dealChatKeys.messages(THREAD)).toEqual(["deal-messages", THREAD]);
    cancelSpy.mockRestore();
    getSpy.mockRestore();
    setSpy.mockRestore();
  });

  it("snapshots existing messages and appends optimistic user row with exact shape", async () => {
    const qc = createQc();
    const existing = makeRow({ id: "existing", role: "assistant", content: "prior" });
    qc.setQueryData(dealChatKeys.messages(THREAD), [existing]);

    let resolveSend!: (v: unknown) => void;
    sendMessageServerFn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );

    const { result } = renderHook(
      () => useSendDealChatMessage({ opportunityId: OPP, threadId: THREAD }),
      { wrapper: createWrapper(qc) },
    );

    act(() => {
      result.current.mutate("New message");
    });

    await waitFor(() => {
      const data = qc.getQueryData<DealMessageCacheRow[]>(dealChatKeys.messages(THREAD));
      expect(data).toHaveLength(2);
    });

    const data = qc.getQueryData<DealMessageCacheRow[]>(dealChatKeys.messages(THREAD))!;
    expect(data[0]).toEqual(existing);
    const optimistic = data[1]!;
    expect(optimistic.id.startsWith("opt-")).toBe(true);
    expect(optimistic.thread_id).toBe(THREAD);
    expect(optimistic.role).toBe("user");
    expect(optimistic.content).toBe("New message");
    expect(optimistic.structured_output).toBeNull();
    expect(optimistic.metadata).toEqual({});
    expect(optimistic.image_urls).toEqual([]);
    expect(Array.isArray(optimistic.image_urls)).toBe(true);
    expect(optimistic.image_urls).not.toBeUndefined();
    expect(typeof optimistic.created_at).toBe("string");

    await act(async () => {
      resolveSend({
        userMessage: makeRow({ id: "u1", role: "user", content: "New message" }),
        assistantMessage: makeRow({ id: "a1", role: "assistant", content: "Reply" }),
      });
    });
  });

  it("preserves supplied image_urls on fixture/server-shaped rows exactly", async () => {
    const qc = createQc();
    const urls = ["https://cdn.example/a.png", "https://cdn.example/b.png"];
    const userMessage = makeRow({
      id: "u-img",
      role: "user",
      content: "with images",
      image_urls: urls,
    });
    const assistantMessage = makeRow({
      id: "a-img",
      role: "assistant",
      content: "ok",
      image_urls: [],
    });
    sendMessageServerFn.mockResolvedValue({ userMessage, assistantMessage });

    const { result } = renderHook(
      () => useSendDealChatMessage({ opportunityId: OPP, threadId: THREAD }),
      { wrapper: createWrapper(qc) },
    );

    await act(async () => {
      await result.current.mutateAsync("with images");
    });

    const data = qc.getQueryData<DealMessageCacheRow[]>(dealChatKeys.messages(THREAD))!;
    const user = data.find((m) => m.id === "u-img");
    expect(user?.image_urls).toEqual(urls);
    expect(user?.image_urls).toHaveLength(2);
  });

  it("treats absent cache as empty array for optimistic append", async () => {
    const qc = createQc();
    let resolveSend!: (v: unknown) => void;
    sendMessageServerFn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );

    const { result } = renderHook(
      () => useSendDealChatMessage({ opportunityId: OPP, threadId: THREAD }),
      { wrapper: createWrapper(qc) },
    );

    act(() => {
      result.current.mutate("Only");
    });

    await waitFor(() => {
      const data = qc.getQueryData<DealMessageRow[]>(dealChatKeys.messages(THREAD));
      expect(data).toHaveLength(1);
      expect(data![0]!.content).toBe("Only");
      expect(data![0]!.id.startsWith("opt-")).toBe(true);
    });

    await act(async () => {
      resolveSend({
        userMessage: makeRow({ id: "u1", role: "user", content: "Only" }),
        assistantMessage: makeRow({ id: "a1", role: "assistant", content: "Ok" }),
      });
    });
  });

  it("calls onOptimisticClearDraft after optimistic write (onMutate)", async () => {
    const qc = createQc();
    const clearDraft = vi.fn();
    const order: string[] = [];
    vi.spyOn(qc, "setQueryData").mockImplementation((key, updater) => {
      order.push("set");
      return QueryClient.prototype.setQueryData.call(qc, key, updater);
    });

    let resolveSend!: (v: unknown) => void;
    sendMessageServerFn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );

    const { result } = renderHook(
      () =>
        useSendDealChatMessage({
          opportunityId: OPP,
          threadId: THREAD,
          onOptimisticClearDraft: () => {
            order.push("clear");
            clearDraft();
          },
        }),
      { wrapper: createWrapper(qc) },
    );

    act(() => {
      result.current.mutate("Hi");
    });

    await waitFor(() => expect(clearDraft).toHaveBeenCalledTimes(1));
    expect(order.indexOf("set")).toBeLessThan(order.indexOf("clear"));

    await act(async () => {
      resolveSend({
        userMessage: makeRow({ id: "u1", role: "user", content: "Hi" }),
        assistantMessage: makeRow({ id: "a1", role: "assistant", content: "Hey" }),
      });
    });
  });

  it("on success strips all opt-* rows and appends user then assistant; tracks analytics", async () => {
    const qc = createQc();
    const prior = makeRow({ id: "keep", role: "assistant", content: "old" });
    const staleOpt = makeRow({ id: "opt-stale", role: "user", content: "stale" });
    qc.setQueryData(dealChatKeys.messages(THREAD), [prior, staleOpt]);

    const userMessage = makeRow({ id: "u-real", role: "user", content: "Hello" });
    const assistantMessage = makeRow({ id: "a-real", role: "assistant", content: "World" });
    sendMessageServerFn.mockResolvedValue({ userMessage, assistantMessage });

    const { result } = renderHook(
      () => useSendDealChatMessage({ opportunityId: OPP, threadId: THREAD }),
      { wrapper: createWrapper(qc) },
    );

    await act(async () => {
      await result.current.mutateAsync("Hello");
    });

    const data = qc.getQueryData<DealMessageRow[]>(dealChatKeys.messages(THREAD))!;
    expect(data.map((m) => m.id)).toEqual(["keep", "u-real", "a-real"]);
    expect(data.every((m) => !m.id.startsWith("opt-"))).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith("deal_message_sent");
  });

  it("does not invalidate message or thread queries on send success", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    sendMessageServerFn.mockResolvedValue({
      userMessage: makeRow({ id: "u1", role: "user", content: "x" }),
      assistantMessage: makeRow({ id: "a1", role: "assistant", content: "y" }),
    });

    const { result } = renderHook(
      () => useSendDealChatMessage({ opportunityId: OPP, threadId: THREAD }),
      { wrapper: createWrapper(qc) },
    );

    await act(async () => {
      await result.current.mutateAsync("x");
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("on error restores snapshot prev and does not track analytics", async () => {
    const qc = createQc();
    const existing = makeRow({ id: "keep", role: "user", content: "before" });
    qc.setQueryData(dealChatKeys.messages(THREAD), [existing]);
    sendMessageServerFn.mockRejectedValue(new Error("Rate limit"));

    const { result } = renderHook(
      () => useSendDealChatMessage({ opportunityId: OPP, threadId: THREAD }),
      { wrapper: createWrapper(qc) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync("fail me");
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const data = qc.getQueryData<DealMessageRow[]>(dealChatKeys.messages(THREAD));
    expect(data).toEqual([existing]);
    expect(trackEvent).not.toHaveBeenCalled();
    expect(result.current.error?.message).toBe("Rate limit");
  });

  it("isolates message keys between threads", async () => {
    const qc = createQc();
    const other = makeRow({
      id: "other",
      role: "user",
      content: "b",
      thread_id: THREAD_B,
    });
    qc.setQueryData(dealChatKeys.messages(THREAD_B), [other]);

    sendMessageServerFn.mockResolvedValue({
      userMessage: makeRow({ id: "u1", role: "user", content: "a" }),
      assistantMessage: makeRow({ id: "a1", role: "assistant", content: "r" }),
    });

    const { result } = renderHook(
      () => useSendDealChatMessage({ opportunityId: OPP, threadId: THREAD }),
      { wrapper: createWrapper(qc) },
    );

    await act(async () => {
      await result.current.mutateAsync("a");
    });

    expect(qc.getQueryData(dealChatKeys.messages(THREAD_B))).toEqual([other]);
    const aData = qc.getQueryData<DealMessageRow[]>(dealChatKeys.messages(THREAD))!;
    expect(aData.some((m) => m.id === "u1")).toBe(true);
  });

  it("does not write to empty-string message key when threadId is null", async () => {
    const qc = createQc();
    const setSpy = vi.spyOn(qc, "setQueryData");
    sendMessageServerFn.mockResolvedValue({
      userMessage: makeRow({ id: "u1", role: "user", content: "x" }),
      assistantMessage: makeRow({ id: "a1", role: "assistant", content: "y" }),
    });

    const { result } = renderHook(
      () => useSendDealChatMessage({ opportunityId: OPP, threadId: null }),
      { wrapper: createWrapper(qc) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync("x");
      } catch {
        // expected defensive failure
      }
    });

    expect(sendMessageServerFn).not.toHaveBeenCalled();
    const emptyKeyWrites = setSpy.mock.calls.filter(
      (call) => JSON.stringify(call[0]) === JSON.stringify(["deal-messages", ""]),
    );
    expect(emptyKeyWrites).toHaveLength(0);
  });
});
