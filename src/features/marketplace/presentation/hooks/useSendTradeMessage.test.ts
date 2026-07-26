import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { marketplaceKeys } from "@/lib/queries/marketplace";

const sendTradeMessage = vi.fn();

vi.mock("@/lib/marketplace-write", () => ({
  sendTradeMessage: (...args: unknown[]) => sendTradeMessage(...args),
}));

import { useSendTradeMessage } from "./useSendTradeMessage";

const USER = "user-a";
const QUOTE_A = "quote-a";
const QUOTE_B = "quote-b";
const RECIPIENT = "recipient-1";

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

beforeEach(() => {
  sendTradeMessage.mockReset();
  sendTradeMessage.mockResolvedValue(undefined);
});

describe("useSendTradeMessage", () => {
  it("calls primitive with hook-level sender ID and no second sender in mutation input", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useSendTradeMessage(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        quoteRequestId: QUOTE_A,
        recipientId: RECIPIENT,
        body: "Hello",
      });
    });

    expect(sendTradeMessage).toHaveBeenCalledTimes(1);
    expect(sendTradeMessage).toHaveBeenCalledWith({
      quoteRequestId: QUOTE_A,
      senderId: USER,
      recipientId: RECIPIENT,
      body: "Hello",
    });
    const arg = sendTradeMessage.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(arg).filter((k) => /sender|user/i.test(k))).toEqual(["senderId"]);
  });

  it("passes exact recipient ID and quote-request ID", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useSendTradeMessage(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        quoteRequestId: QUOTE_A,
        recipientId: "tp-profile-9",
        body: "Ping",
      });
    });

    expect(sendTradeMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteRequestId: QUOTE_A,
        recipientId: "tp-profile-9",
      }),
    );
  });

  it("passes body through to primitive (normalization owned by call site / primitive)", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useSendTradeMessage(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        quoteRequestId: QUOTE_A,
        recipientId: RECIPIENT,
        body: "  Hello world  ",
      });
    });

    expect(sendTradeMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "  Hello world  ",
      }),
    );
  });

  it("missing user throws You must be signed in without IO", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSendTradeMessage(undefined), {
      wrapper: createWrapper(qc),
    });

    let caught: Error | undefined;
    await act(async () => {
      try {
        await result.current.mutateAsync({
          quoteRequestId: QUOTE_A,
          recipientId: RECIPIENT,
          body: "Hi",
        });
      } catch (e) {
        caught = e as Error;
      }
    });

    expect(caught?.message).toBe("You must be signed in");
    expect(sendTradeMessage).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("success invalidates exact messagesByQuote key once", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSendTradeMessage(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        quoteRequestId: QUOTE_A,
        recipientId: RECIPIENT,
        body: "Hi",
      });
    });

    await waitFor(() => {
      const messageInvalidations = invalidateSpy.mock.calls.filter(
        (call) =>
          JSON.stringify(call[0]?.queryKey) ===
          JSON.stringify(marketplaceKeys.messagesByQuote(QUOTE_A)),
      );
      expect(messageInvalidations).toHaveLength(1);
    });

    expect(
      invalidateSpy.mock.calls.some(
        (call) =>
          JSON.stringify(call[0]?.queryKey) ===
          JSON.stringify(marketplaceKeys.messagesByQuote(QUOTE_B)),
      ),
    ).toBe(false);

    expect(
      invalidateSpy.mock.calls.some(
        (call) =>
          JSON.stringify(call[0]?.queryKey) ===
          JSON.stringify(marketplaceKeys.favoritesByUser(USER)),
      ),
    ).toBe(false);

    expect(
      invalidateSpy.mock.calls.some(
        (call) =>
          JSON.stringify(call[0]?.queryKey) ===
          JSON.stringify(marketplaceKeys.quoteRequestsByProject("proj-1")),
      ),
    ).toBe(false);

    expect(
      invalidateSpy.mock.calls.some(
        (call) => JSON.stringify(call[0]?.queryKey) === JSON.stringify(marketplaceKeys.all),
      ),
    ).toBe(false);
  });

  it("failed send does not invalidate", async () => {
    sendTradeMessage.mockRejectedValue(new Error("network"));
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSendTradeMessage(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          quoteRequestId: QUOTE_A,
          recipientId: RECIPIENT,
          body: "Hi",
        });
      } catch {
        // expected
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("propagates original mutation error", async () => {
    sendTradeMessage.mockRejectedValue(new Error("rls denied"));
    const qc = createQc();
    const { result } = renderHook(() => useSendTradeMessage(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          quoteRequestId: QUOTE_A,
          recipientId: RECIPIENT,
          body: "Hi",
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("rls denied");
  });

  it("does not retry failed send", async () => {
    sendTradeMessage.mockRejectedValue(new Error("network"));
    const qc = createQc();
    const { result } = renderHook(() => useSendTradeMessage(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          quoteRequestId: QUOTE_A,
          recipientId: RECIPIENT,
          body: "Hi",
        });
      } catch {
        // expected
      }
    });

    expect(sendTradeMessage).toHaveBeenCalledTimes(1);
  });

  it("does not optimistically setQueryData", async () => {
    const qc = createQc();
    const setSpy = vi.spyOn(qc, "setQueryData");
    const { result } = renderHook(() => useSendTradeMessage(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        quoteRequestId: QUOTE_A,
        recipientId: RECIPIENT,
        body: "Hi",
      });
    });

    expect(setSpy).not.toHaveBeenCalled();
  });

  it("source has no Realtime channel operations", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/features/marketplace/presentation/hooks/useSendTradeMessage.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/\.channel\s*\(|postgres_changes|removeChannel/);
  });
});
