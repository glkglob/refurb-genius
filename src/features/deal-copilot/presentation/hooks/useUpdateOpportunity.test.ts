/**
 * AO-1M5 — useUpdateOpportunity: repository mapping, success-only list invalidation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { DealOpportunity } from "@repo/types";

const updateOpportunity = vi.hoisted(() => vi.fn());

vi.mock("../../infrastructure/dealOpportunityRepository", () => ({
  dealOpportunityRepository: {
    updateOpportunity: (...args: unknown[]) => updateOpportunity(...args),
  },
  updateOpportunity: (...args: unknown[]) => updateOpportunity(...args),
}));

import { useUpdateOpportunity } from "./useUpdateOpportunity";

const OPP_A = "opp-a";
const OPP_B = "opp-b";

function makeOpportunity(overrides: Partial<DealOpportunity> = {}): DealOpportunity {
  return {
    id: OPP_A,
    title: "Deal A",
    status: "sourced",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

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

describe("useUpdateOpportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOpportunity.mockResolvedValue(makeOpportunity({ status: "watchlist" }));
  });

  it("passes exact id to the repository", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useUpdateOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: OPP_A,
        updates: { status: "watchlist" },
      });
    });

    expect(updateOpportunity).toHaveBeenCalledWith({
      id: OPP_A,
      updates: { status: "watchlist" },
    });
  });

  it("passes the exact updates object unchanged", async () => {
    const qc = createQc();
    const updates = {
      status: "underwriting" as const,
      bedrooms: 0,
      purchasePrice: 0,
      listingUrl: null as unknown as undefined,
    };
    const { result } = renderHook(() => useUpdateOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: OPP_A, updates });
    });

    expect(updateOpportunity).toHaveBeenCalledWith({ id: OPP_A, updates });
    expect(updateOpportunity.mock.calls[0]![0].updates).toBe(updates);
  });

  it("returns the repository mapped DealOpportunity", async () => {
    const mapped = makeOpportunity({ id: OPP_A, status: "rejected", title: "Mapped" });
    updateOpportunity.mockResolvedValue(mapped);
    const qc = createQc();
    const { result } = renderHook(() => useUpdateOpportunity(), {
      wrapper: createWrapper(qc),
    });

    let returned: DealOpportunity | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        id: OPP_A,
        updates: { status: "rejected" },
      });
    });

    expect(returned).toEqual(mapped);
  });

  it('invalidates ["opportunities"] on success without exact scope', async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useUpdateOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: OPP_A,
        updates: { status: "sourced" },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["opportunities"] });
    const call = invalidateSpy.mock.calls[0]![0] as { queryKey: unknown; exact?: boolean };
    expect(call.exact).toBeUndefined();
  });

  it("does not invalidate on repository failure", async () => {
    updateOpportunity.mockRejectedValue(new Error("RLS denied"));
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useUpdateOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: OPP_A,
          updates: { status: "watchlist" },
        }),
      ).rejects.toThrow("RLS denied");
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("exposes the repository error to mutation consumers", async () => {
    updateOpportunity.mockRejectedValue(new Error("network down"));
    const qc = createQc();
    const { result } = renderHook(() => useUpdateOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: OPP_A,
          updates: { status: "sourced" },
        }),
      ).rejects.toThrow("network down");
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual(new Error("network down"));
    });
  });

  it("does not perform auth lookup or optimistic cache operations", async () => {
    const qc = createQc();
    const cancelSpy = vi.spyOn(qc, "cancelQueries");
    const setSpy = vi.spyOn(qc, "setQueryData");
    const getSpy = vi.spyOn(qc, "getQueryData");
    const { result } = renderHook(() => useUpdateOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: OPP_A,
        updates: { status: "sourced" },
      });
    });

    expect(cancelSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("forwards different IDs independently", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useUpdateOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: OPP_A,
        updates: { status: "sourced" },
      });
      await result.current.mutateAsync({
        id: OPP_B,
        updates: { status: "watchlist" },
      });
    });

    expect(updateOpportunity).toHaveBeenNthCalledWith(1, {
      id: OPP_A,
      updates: { status: "sourced" },
    });
    expect(updateOpportunity).toHaveBeenNthCalledWith(2, {
      id: OPP_B,
      updates: { status: "watchlist" },
    });
  });

  it("supports updates containing zero and null without hook-side transformation", async () => {
    const qc = createQc();
    const updates = {
      bedrooms: 0,
      purchasePrice: 0,
      listingUrl: null as unknown as undefined,
    };
    const { result } = renderHook(() => useUpdateOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: OPP_A, updates });
    });

    expect(updateOpportunity).toHaveBeenCalledWith({ id: OPP_A, updates });
  });
});
