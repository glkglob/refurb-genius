/**
 * AO-1J1 — useCreateDealThread mutation lifecycle parity tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { dealChatKeys } from "../../query/dealChatKeys";
import type { DealThreadRow } from "@/serverFns/dealChat";

const createThreadServerFn = vi.fn();
const trackEvent = vi.fn();

vi.mock("@/serverFns/dealChat", () => ({
  createThreadServerFn: (...args: unknown[]) => createThreadServerFn(...args),
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

import { useCreateDealThread } from "./useCreateDealThread";

const OPP = "opp-1";
const OPP_B = "opp-b";

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

function makeThread(partial: Partial<DealThreadRow> = {}): DealThreadRow {
  return {
    id: "thread-new",
    opportunity_id: OPP,
    user_id: "user-1",
    title: "Thread 1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

beforeEach(() => {
  createThreadServerFn.mockReset();
  trackEvent.mockReset();
});

describe("useCreateDealThread", () => {
  it("calls createThreadServerFn with exact opportunityId and title payload", async () => {
    const qc = createQc();
    const thread = makeThread({ title: "Thread 3" });
    createThreadServerFn.mockResolvedValue(thread);

    const { result } = renderHook(() => useCreateDealThread(OPP), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: "Thread 3" });
    });

    expect(createThreadServerFn).toHaveBeenCalledTimes(1);
    expect(createThreadServerFn).toHaveBeenCalledWith({
      data: { opportunityId: OPP, title: "Thread 3" },
    });
  });

  it("invalidates dealChatKeys.threads(opportunityId) once on success", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    createThreadServerFn.mockResolvedValue(makeThread());

    const { result } = renderHook(() => useCreateDealThread(OPP), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: "Thread 1" });
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy.mock.calls[0]![0]).toEqual({
      queryKey: dealChatKeys.threads(OPP),
    });
    expect(dealChatKeys.threads(OPP)).toEqual(["deal-threads", OPP]);
  });

  it("calls onCreated then trackEvent in success order after invalidation", async () => {
    const qc = createQc();
    const order: string[] = [];
    vi.spyOn(qc, "invalidateQueries").mockImplementation(async () => {
      order.push("invalidate");
    });
    const onCreated = vi.fn(() => {
      order.push("onCreated");
    });
    trackEvent.mockImplementation(() => {
      order.push("analytics");
    });

    const thread = makeThread({ id: "t-99" });
    createThreadServerFn.mockResolvedValue(thread);

    const { result } = renderHook(() => useCreateDealThread(OPP, { onCreated }), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: "Thread 1" });
    });

    expect(onCreated).toHaveBeenCalledWith(thread);
    expect(trackEvent).toHaveBeenCalledWith("deal_thread_created");
    expect(order).toEqual(["invalidate", "onCreated", "analytics"]);
  });

  it("does not write message cache or invalidate messages key", async () => {
    const qc = createQc();
    const setSpy = vi.spyOn(qc, "setQueryData");
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    createThreadServerFn.mockResolvedValue(makeThread());

    const { result } = renderHook(() => useCreateDealThread(OPP), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: "Thread 1" });
    });

    expect(setSpy).not.toHaveBeenCalled();
    const messageInvalidations = invalidateSpy.mock.calls.filter(
      (call) =>
        Array.isArray(call[0]?.queryKey) && (call[0]?.queryKey as unknown[])[0] === "deal-messages",
    );
    expect(messageInvalidations).toHaveLength(0);
  });

  it("isolates opportunity thread keys", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    createThreadServerFn.mockResolvedValue(makeThread({ opportunity_id: OPP }));

    const { result } = renderHook(() => useCreateDealThread(OPP), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: "Thread 1" });
    });

    expect(invalidateSpy.mock.calls[0]![0]).toEqual({
      queryKey: dealChatKeys.threads(OPP),
    });
    expect(invalidateSpy.mock.calls[0]![0]).not.toEqual({
      queryKey: dealChatKeys.threads(OPP_B),
    });
  });

  it("exposes isPending during in-flight create", async () => {
    const qc = createQc();
    let resolveCreate!: (v: DealThreadRow) => void;
    createThreadServerFn.mockImplementation(
      () =>
        new Promise<DealThreadRow>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const { result } = renderHook(() => useCreateDealThread(OPP), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.mutate({ title: "Thread 1" });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    await act(async () => {
      resolveCreate(makeThread());
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});
