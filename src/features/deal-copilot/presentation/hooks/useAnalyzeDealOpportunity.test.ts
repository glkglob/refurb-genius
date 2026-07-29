/**
 * AO-1M6 — useAnalyzeDealOpportunity: serverFn mapping, analytics, no QC ops.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { DealAnalysis } from "@/core/dealCopilot/dealAnalysis";

const analyzeDealServerFn = vi.hoisted(() => vi.fn());
const trackEvent = vi.hoisted(() => vi.fn());

vi.mock("@/serverFns/dealAnalysis", () => ({
  analyzeDealServerFn: (...args: unknown[]) => analyzeDealServerFn(...args),
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

import { useAnalyzeDealOpportunity } from "./useAnalyzeDealOpportunity";

const OPP_A = "opp-analysis-a";
const OPP_B = "opp-analysis-b";

function makeAnalysis(overrides: Partial<DealAnalysis> = {}): DealAnalysis {
  return {
    valuationSummary: "Conservative underwriting summary for this deal.",
    riskFlags: [
      {
        severity: "medium",
        description: "Refurb contingency may be light.",
        mitigation: "Hold 10-15% contingency.",
      },
    ],
    nextSteps: ["Commission a Level 2 survey."],
    aiOpinion: {
      estimatedValue: 390_000,
      rationale: "Slight haircut on provided GDV.",
    },
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

describe("useAnalyzeDealOpportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyzeDealServerFn.mockResolvedValue(makeAnalysis());
  });

  it("calls analyzeDealServerFn with { data: { opportunityId } }", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useAnalyzeDealOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ opportunityId: OPP_A });
    });

    expect(analyzeDealServerFn).toHaveBeenCalledWith({
      data: { opportunityId: OPP_A },
    });
  });

  it("forwards promptContext when provided", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useAnalyzeDealOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        opportunityId: OPP_A,
        promptContext: "Focus on HMO exit risk.",
      });
    });

    expect(analyzeDealServerFn).toHaveBeenCalledWith({
      data: {
        opportunityId: OPP_A,
        promptContext: "Focus on HMO exit risk.",
      },
    });
  });

  it("omits promptContext when undefined", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useAnalyzeDealOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        opportunityId: OPP_A,
        promptContext: undefined,
      });
    });

    const payload = analyzeDealServerFn.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(payload.data.opportunityId).toBe(OPP_A);
    // JSON serialization of serverFn transport may drop undefined; direct object
    // may still include the key. Either way value must not be a string.
    expect(payload.data.promptContext).toBeUndefined();
  });

  it("resolves the exact DealAnalysis result", async () => {
    const analysis = makeAnalysis({ valuationSummary: "Exact payload" });
    analyzeDealServerFn.mockResolvedValue(analysis);
    const qc = createQc();
    const { result } = renderHook(() => useAnalyzeDealOpportunity(), {
      wrapper: createWrapper(qc),
    });

    let returned: DealAnalysis | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ opportunityId: OPP_A });
    });

    expect(returned).toEqual(analysis);
    await waitFor(() => {
      expect(result.current.data).toEqual(analysis);
    });
  });

  it("exposes server-function rejection to mutation consumers", async () => {
    analyzeDealServerFn.mockRejectedValue(new Error("Opportunity not found."));
    const qc = createQc();
    const { result } = renderHook(() => useAnalyzeDealOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ opportunityId: OPP_A })).rejects.toThrow(
        "Opportunity not found.",
      );
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual(new Error("Opportunity not found."));
    });
  });

  it("calls trackEvent deal_analyzed exactly once on success", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useAnalyzeDealOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ opportunityId: OPP_A });
    });

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("deal_analyzed");
  });

  it("does not call analytics on failure", async () => {
    analyzeDealServerFn.mockRejectedValue(new Error("Rate limit exceeded. Try again in 60s."));
    const qc = createQc();
    const { result } = renderHook(() => useAnalyzeDealOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ opportunityId: OPP_A })).rejects.toThrow(
        /Rate limit/,
      );
    });

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("exposes standard pending lifecycle", async () => {
    let resolveFn: ((value: DealAnalysis) => void) | undefined;
    analyzeDealServerFn.mockImplementation(
      () =>
        new Promise<DealAnalysis>((resolve) => {
          resolveFn = resolve;
        }),
    );
    const qc = createQc();
    const { result } = renderHook(() => useAnalyzeDealOpportunity(), {
      wrapper: createWrapper(qc),
    });

    expect(result.current.isPending).toBe(false);

    let pendingPromise: Promise<DealAnalysis> | undefined;
    act(() => {
      pendingPromise = result.current.mutateAsync({ opportunityId: OPP_A });
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    await act(async () => {
      resolveFn?.(makeAnalysis());
      await pendingPromise;
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("performs no QueryClient invalidation, setQueryData, or cancelQueries", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const setSpy = vi.spyOn(qc, "setQueryData");
    const cancelSpy = vi.spyOn(qc, "cancelQueries");
    const { result } = renderHook(() => useAnalyzeDealOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ opportunityId: OPP_A });
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it("forwards different opportunity IDs independently", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useAnalyzeDealOpportunity(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ opportunityId: OPP_A });
      await result.current.mutateAsync({ opportunityId: OPP_B });
    });

    expect(analyzeDealServerFn).toHaveBeenNthCalledWith(1, {
      data: { opportunityId: OPP_A },
    });
    expect(analyzeDealServerFn).toHaveBeenNthCalledWith(2, {
      data: { opportunityId: OPP_B },
    });
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });
});
