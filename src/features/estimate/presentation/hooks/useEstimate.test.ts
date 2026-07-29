/**
 * AO-1K1 — useRoomEstimate + useSaveAIEstimate: canonical product estimate keys.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { estimateQueryOptions, projectKeys } from "@/lib/queries/projects";
import type {
  PersistedRoomEstimate,
  SaveAIEstimateInput,
} from "../../infrastructure/repositories/estimate.repository";

const saveAIEstimate = vi.hoisted(() => vi.fn());
const getLatestRoomEstimate = vi.hoisted(() => vi.fn());

vi.mock("../../infrastructure/repositories/estimate.repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../infrastructure/repositories/estimate.repository")>();
  return {
    ...actual,
    saveAIEstimate: (...args: unknown[]) => saveAIEstimate(...args),
    getLatestRoomEstimate: (...args: unknown[]) => getLatestRoomEstimate(...args),
  };
});

import { useRoomEstimate, useSaveAIEstimate } from "./useEstimate";

const PROJECT_A = "proj-a";
const PROJECT_B = "proj-b";
const ESTIMATE_KEY_A = projectKeys.estimateByProject(PROJECT_A);
const ESTIMATE_KEY_B = projectKeys.estimateByProject(PROJECT_B);
const FINANCIALS_KEY_A = projectKeys.financialsByProject(PROJECT_A);
const ROOM_ESTIMATE_KEY_A = ["room-estimate", PROJECT_A] as const;

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

function sampleInput(projectId = PROJECT_A): SaveAIEstimateInput {
  return {
    projectId,
    title: "AI Estimate",
    region: "London",
    rooms: [
      {
        name: "Kitchen",
        area_sqm: 12,
        items: [
          {
            name: "Cabinets",
            category: "Kitchen",
            quantity: 1,
            unit: "set",
            base_unit_cost: 4500,
            unit_cost: 4500,
            total_cost: 4500,
            labour: 0,
            materials: 0,
            weeks: 0,
            is_ai_suggested: true,
          },
        ],
      },
    ],
    subtotal: 4500,
    vat_rate: 20,
    vat_amount: 990,
    total: 5940,
    notes: "AI estimate",
  } as unknown as SaveAIEstimateInput;
}

function samplePersisted(): PersistedRoomEstimate {
  return {
    estimate: { id: "e1", mid_total: 5940 },
    rooms: [{ name: "Kitchen", items: [] }],
  } as unknown as PersistedRoomEstimate;
}

beforeEach(() => {
  saveAIEstimate.mockReset();
  getLatestRoomEstimate.mockReset();
  getLatestRoomEstimate.mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useRoomEstimate", () => {
  it("uses the canonical estimate tuple and options factory key", async () => {
    const qc = createQc();
    const seeded = samplePersisted();
    qc.setQueryData(ESTIMATE_KEY_A, seeded);

    const { result } = renderHook(() => useRoomEstimate(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(seeded);
    expect(estimateQueryOptions(PROJECT_A).queryKey).toEqual(["projects", PROJECT_A, "estimate"]);
    expect(result.current.dataUpdatedAt).toBeGreaterThan(0);
  });

  it("is enabled when projectId is truthy and fetches via getLatestRoomEstimate", async () => {
    const qc = createQc();
    const seeded = samplePersisted();
    getLatestRoomEstimate.mockResolvedValue(seeded);

    const { result } = renderHook(() => useRoomEstimate(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(getLatestRoomEstimate).toHaveBeenCalledWith(PROJECT_A);
    expect(result.current.data).toEqual(seeded);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.status).toBe("success");
  });

  it("is disabled when projectId is absent", () => {
    const qc = createQc();
    const { result } = renderHook(() => useRoomEstimate(undefined), {
      wrapper: createWrapper(qc),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isFetching).toBe(false);
    expect(getLatestRoomEstimate).not.toHaveBeenCalled();
  });

  it("does not use the retired room-estimate key", async () => {
    const qc = createQc();
    const productData = samplePersisted();
    const roomOnly = { rooms: [{ name: "orphan" }] };
    qc.setQueryData(ESTIMATE_KEY_A, productData);
    qc.setQueryData(ROOM_ESTIMATE_KEY_A, roomOnly);

    const { result } = renderHook(() => useRoomEstimate(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(productData);
    expect(result.current.data).not.toEqual(roomOnly);
  });

  it("preserves project isolation between two project IDs", async () => {
    const qc = createQc();
    const dataA = {
      estimate: { id: "a", mid_total: 1 },
      rooms: [{ name: "A" }],
    } as unknown as PersistedRoomEstimate;
    const dataB = {
      estimate: { id: "b", mid_total: 2 },
      rooms: [{ name: "B" }],
    } as unknown as PersistedRoomEstimate;
    qc.setQueryData(ESTIMATE_KEY_A, dataA);
    qc.setQueryData(ESTIMATE_KEY_B, dataB);

    const { result: resultA } = renderHook(() => useRoomEstimate(PROJECT_A), {
      wrapper: createWrapper(qc),
    });
    const { result: resultB } = renderHook(() => useRoomEstimate(PROJECT_B), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => {
      expect(resultA.current.isSuccess).toBe(true);
      expect(resultB.current.isSuccess).toBe(true);
    });

    expect(resultA.current.data).toEqual(dataA);
    expect(resultB.current.data).toEqual(dataB);
    expect(ESTIMATE_KEY_A).not.toEqual(ESTIMATE_KEY_B);
  });
});

describe("useSaveAIEstimate", () => {
  it("calls saveAIEstimate with the exact payload", async () => {
    const qc = createQc();
    const input = sampleInput();
    const persisted = samplePersisted();
    saveAIEstimate.mockResolvedValue(persisted);

    const { result } = renderHook(() => useSaveAIEstimate(), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.mutate(input);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(saveAIEstimate).toHaveBeenCalledTimes(1);
    expect(saveAIEstimate.mock.calls[0]![0]).toEqual(input);
    expect(result.current.data).toEqual(persisted);
  });

  it("invalidates canonical estimate then financials once each on success", async () => {
    const qc = createQc();
    const order: string[] = [];
    const invSpy = vi.spyOn(qc, "invalidateQueries").mockImplementation(async (filters) => {
      const key = (filters as { queryKey?: readonly unknown[] })?.queryKey;
      if (key && key[key.length - 1] === "estimate") order.push("invalidate-estimate");
      else if (key && key[key.length - 1] === "financials") order.push("invalidate-financials");
      else order.push("invalidate-other");
      return undefined;
    });

    saveAIEstimate.mockResolvedValue(samplePersisted());

    const { result } = renderHook(() => useSaveAIEstimate(), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.mutate(sampleInput());
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invSpy).toHaveBeenCalledTimes(2);
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ESTIMATE_KEY_A });
    expect(invSpy).toHaveBeenCalledWith({ queryKey: FINANCIALS_KEY_A });
    expect(order).toEqual(["invalidate-estimate", "invalidate-financials"]);
    expect(order.indexOf("invalidate-estimate")).toBeLessThan(
      order.indexOf("invalidate-financials"),
    );

    for (const call of invSpy.mock.calls) {
      const filters = call[0] as { exact?: boolean } | undefined;
      expect(filters?.exact).toBeUndefined();
    }

    expect(invSpy).not.toHaveBeenCalledWith({ queryKey: ROOM_ESTIMATE_KEY_A });
    expect(invSpy).not.toHaveBeenCalledWith({ queryKey: projectKeys.all });
    expect(invSpy).not.toHaveBeenCalledWith({ queryKey: projectKeys.byId(PROJECT_A) });
    expect(invSpy).not.toHaveBeenCalledWith({
      queryKey: projectKeys.photosByProject(PROJECT_A),
    });
  });

  it("does not invalidate on mutation failure", async () => {
    const qc = createQc();
    const invSpy = vi.spyOn(qc, "invalidateQueries");
    saveAIEstimate.mockRejectedValue(new Error("db down"));

    const { result } = renderHook(() => useSaveAIEstimate(), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.mutate(sampleInput());
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invSpy).not.toHaveBeenCalled();
  });

  it("preserves project isolation for invalidation targets", async () => {
    const qc = createQc();
    const invSpy = vi.spyOn(qc, "invalidateQueries").mockResolvedValue(undefined);
    saveAIEstimate.mockResolvedValue(samplePersisted());

    const { result } = renderHook(() => useSaveAIEstimate(), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.mutate(sampleInput(PROJECT_B));
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invSpy).toHaveBeenCalledWith({
      queryKey: projectKeys.estimateByProject(PROJECT_B),
    });
    expect(invSpy).toHaveBeenCalledWith({
      queryKey: projectKeys.financialsByProject(PROJECT_B),
    });
    expect(invSpy).not.toHaveBeenCalledWith({ queryKey: ESTIMATE_KEY_A });
    expect(invSpy).not.toHaveBeenCalledWith({ queryKey: FINANCIALS_KEY_A });
  });

  it("source does not reference room-estimate and uses canonical factories", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "useEstimate.ts"), "utf8");
    expect(src).not.toMatch(/room-estimate/);
    expect(src).toMatch(/estimateQueryOptions/);
    expect(src).toMatch(/projectKeys\.estimateByProject/);
    expect(src).toMatch(/projectKeys\.financialsByProject/);
    expect(src).toMatch(/@\/lib\/queries\/projects/);
  });
});
