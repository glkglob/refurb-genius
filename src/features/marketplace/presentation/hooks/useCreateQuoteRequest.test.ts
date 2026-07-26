import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { marketplaceKeys } from "@/lib/queries/marketplace";

const createQuoteRequest = vi.fn();

vi.mock("@/lib/marketplace-write", () => ({
  createQuoteRequest: (...args: unknown[]) => createQuoteRequest(...args),
}));

import { useCreateQuoteRequest } from "./useCreateQuoteRequest";

const USER = "user-a";
const TP = "tp-1";
const PROJECT_A = "proj-a";
const PROJECT_B = "proj-b";

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
  createQuoteRequest.mockReset();
  createQuoteRequest.mockResolvedValue(undefined);
});

describe("useCreateQuoteRequest", () => {
  it("calls primitive with hook-level userId and no second userId in mutation input", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useCreateQuoteRequest(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        tradespersonId: TP,
        title: "Quote request for Acme",
        message: "Kitchen refit",
        projectId: PROJECT_A,
        proposedPrice: 1200,
      });
    });

    expect(createQuoteRequest).toHaveBeenCalledTimes(1);
    expect(createQuoteRequest).toHaveBeenCalledWith({
      userId: USER,
      tradespersonId: TP,
      projectId: PROJECT_A,
      title: "Quote request for Acme",
      message: "Kitchen refit",
      proposedPrice: 1200,
    });
    const arg = createQuoteRequest.mock.calls[0][0] as Record<string, unknown>;
    // Mutation input must not redefine identity — only hook userId is used.
    expect(Object.keys(arg).filter((k) => k.toLowerCase().includes("user"))).toEqual(["userId"]);
  });

  it("maps undefined projectId to empty string", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useCreateQuoteRequest(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        tradespersonId: TP,
        title: "Quote request for Acme",
        message: "Scope",
      });
    });

    expect(createQuoteRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "",
      }),
    );
  });

  it("missing user throws You must be signed in without IO", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useCreateQuoteRequest(undefined), {
      wrapper: createWrapper(qc),
    });

    let caught: Error | undefined;
    await act(async () => {
      try {
        await result.current.mutateAsync({
          tradespersonId: TP,
          title: "T",
          message: "M",
        });
      } catch (e) {
        caught = e as Error;
      }
    });

    expect(caught?.message).toBe("You must be signed in");
    expect(createQuoteRequest).not.toHaveBeenCalled();
  });

  it("success with projectId invalidates exact project key once", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCreateQuoteRequest(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        tradespersonId: TP,
        title: "T",
        message: "M",
        projectId: PROJECT_A,
      });
    });

    await waitFor(() => {
      const projectInvalidations = invalidateSpy.mock.calls.filter(
        (call) =>
          JSON.stringify(call[0]?.queryKey) ===
          JSON.stringify(marketplaceKeys.quoteRequestsByProject(PROJECT_A)),
      );
      expect(projectInvalidations).toHaveLength(1);
    });

    expect(
      invalidateSpy.mock.calls.some(
        (call) =>
          JSON.stringify(call[0]?.queryKey) ===
          JSON.stringify(marketplaceKeys.quoteRequestsByProject(PROJECT_B)),
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
        (call) => JSON.stringify(call[0]?.queryKey) === JSON.stringify(marketplaceKeys.all),
      ),
    ).toBe(false);
  });

  it("success without projectId does not invalidate", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCreateQuoteRequest(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        tradespersonId: TP,
        title: "T",
        message: "M",
      });
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("empty projectId does not invalidate", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCreateQuoteRequest(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        tradespersonId: TP,
        title: "T",
        message: "M",
        projectId: "",
      });
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("propagates original mutation error", async () => {
    createQuoteRequest.mockRejectedValue(new Error("fk violation"));
    const qc = createQc();
    const { result } = renderHook(() => useCreateQuoteRequest(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          tradespersonId: TP,
          title: "T",
          message: "M",
          projectId: PROJECT_A,
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("fk violation");
  });

  it("does not retry failed create", async () => {
    createQuoteRequest.mockRejectedValue(new Error("network"));
    const qc = createQc();
    const { result } = renderHook(() => useCreateQuoteRequest(USER), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          tradespersonId: TP,
          title: "T",
          message: "M",
        });
      } catch {
        // expected
      }
    });

    expect(createQuoteRequest).toHaveBeenCalledTimes(1);
  });
});
