/**
 * AO-1G1 — useSaveEstimateBuilder: mutation, optimistic cache, dual-key isolation.
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
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("../../infrastructure/repositories/estimate.repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../infrastructure/repositories/estimate.repository")>();
  return {
    ...actual,
    saveAIEstimate: (...args: unknown[]) => saveAIEstimate(...args),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { useSaveEstimateBuilder } from "./useSaveEstimateBuilder";

const PROJECT = "proj-1";
const ESTIMATE_KEY = estimateQueryOptions(PROJECT).queryKey;
const FINANCIALS_KEY = projectKeys.financialsByProject(PROJECT);
const ROOM_ESTIMATE_KEY = ["room-estimate", PROJECT] as const;

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

function sampleInput(): SaveAIEstimateInput {
  return {
    projectId: PROJECT,
    title: "Property Refurbishment Estimate",
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
            is_ai_suggested: false,
          },
        ],
      },
    ],
    subtotal: 4500,
    vat_rate: 20,
    vat_amount: 990,
    total: 5940,
    notes: "Manual estimate built with drag & drop builder",
  } as unknown as SaveAIEstimateInput;
}

function sampleOptimistic() {
  return {
    total: 5940,
    rooms: [
      {
        id: "room-1",
        name: "Kitchen",
        area_sqm: 12,
        items: [
          {
            id: "item-1",
            name: "Cabinets",
            category: "Kitchen",
            quantity: 1,
            unit: "set",
            unit_cost: 4500,
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  saveAIEstimate.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSaveEstimateBuilder", () => {
  it("getSeededEstimate returns one-shot product key data only", () => {
    const qc = createQc();
    const seeded = {
      estimate: { mid_total: 100 },
      rooms: [{ name: "Bath", items: [] }],
    } as unknown as PersistedRoomEstimate;
    qc.setQueryData(ESTIMATE_KEY, seeded);
    qc.setQueryData(ROOM_ESTIMATE_KEY, { rooms: [{ name: "other" }] });

    const { result } = renderHook(() => useSaveEstimateBuilder(PROJECT), {
      wrapper: createWrapper(qc),
    });

    expect(result.current.getSeededEstimate()).toEqual(seeded);
  });

  it("onMutate cancels, snapshots, and optimistically writes product estimate key", async () => {
    const qc = createQc();
    const previous = {
      estimate: { mid_total: 1 },
      rooms: [{ name: "Old", items: [] }],
    } as unknown as PersistedRoomEstimate;
    qc.setQueryData(ESTIMATE_KEY, previous);
    const roomEstimate = { rooms: [{ name: "ai-only" }] };
    qc.setQueryData(ROOM_ESTIMATE_KEY, roomEstimate);

    const cancelSpy = vi.spyOn(qc, "cancelQueries");
    saveAIEstimate.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useSaveEstimateBuilder(PROJECT), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.save({
        input: sampleInput(),
        optimistic: sampleOptimistic(),
      });
    });

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith({ queryKey: ESTIMATE_KEY });
    });

    const optimistic = qc.getQueryData(ESTIMATE_KEY) as {
      estimate: { mid_total: number };
      rooms: Array<{ name: string; items: Array<{ id: string; base_unit_cost: number }> }>;
    };
    expect(optimistic.estimate.mid_total).toBe(5940);
    expect(optimistic.rooms[0]!.name).toBe("Kitchen");
    expect(optimistic.rooms[0]!.items[0]!.id).toBe("item-1");
    expect(optimistic.rooms[0]!.items[0]!.base_unit_cost).toBe(4500);
    expect(qc.getQueryData(ROOM_ESTIMATE_KEY)).toEqual(roomEstimate);
  });

  it("onSuccess invalidates estimate then financials, clears draft, toasts, calls onSaved", async () => {
    const qc = createQc();
    const order: string[] = [];
    const invSpy = vi.spyOn(qc, "invalidateQueries").mockImplementation(async (filters) => {
      const key = (filters as { queryKey?: readonly unknown[] })?.queryKey;
      if (key && key[key.length - 1] === "estimate") order.push("invalidate-estimate");
      else if (key && key[key.length - 1] === "financials") order.push("invalidate-financials");
      else order.push("invalidate-other");
    });

    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");
    localStorage.setItem(`estimate-draft:${PROJECT}`, "[]");

    saveAIEstimate.mockResolvedValue({
      estimate: { id: "e1" },
      rooms: [],
    } as unknown as PersistedRoomEstimate);

    const onSaved = vi.fn(() => {
      order.push("onSaved");
    });

    const { result } = renderHook(() => useSaveEstimateBuilder(PROJECT, { onSaved }), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.save({
        input: sampleInput(),
        optimistic: sampleOptimistic(),
      });
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Estimate saved");
    });

    expect(invSpy).toHaveBeenCalledWith({ queryKey: projectKeys.estimateByProject(PROJECT) });
    expect(invSpy).toHaveBeenCalledWith({ queryKey: projectKeys.financialsByProject(PROJECT) });
    expect(removeItemSpy).toHaveBeenCalledWith(`estimate-draft:${PROJECT}`);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(order.indexOf("invalidate-estimate")).toBeLessThan(
      order.indexOf("invalidate-financials"),
    );
    expect(order.indexOf("invalidate-financials")).toBeLessThan(order.indexOf("onSaved"));
    expect(invSpy).not.toHaveBeenCalledWith({ queryKey: ROOM_ESTIMATE_KEY });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("onError restores previous when truthy and toasts Save failed without room-estimate touch", async () => {
    const qc = createQc();
    const previous = {
      estimate: { mid_total: 42 },
      rooms: [{ name: "Keep", items: [] }],
    } as unknown as PersistedRoomEstimate;
    qc.setQueryData(ESTIMATE_KEY, previous);
    qc.setQueryData(ROOM_ESTIMATE_KEY, { rooms: [{ name: "ai" }] });

    saveAIEstimate.mockRejectedValue(new Error("db down"));

    const { result } = renderHook(() => useSaveEstimateBuilder(PROJECT), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.save({
        input: sampleInput(),
        optimistic: sampleOptimistic(),
      });
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Save failed");
    });

    expect(qc.getQueryData(ESTIMATE_KEY)).toEqual(previous);
    expect(qc.getQueryData(ROOM_ESTIMATE_KEY)).toEqual({ rooms: [{ name: "ai" }] });
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("onError does not restore when previous is null/undefined (truthiness)", async () => {
    const qc = createQc();
    // no seed → previous undefined
    saveAIEstimate.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => useSaveEstimateBuilder(PROJECT), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.save({
        input: sampleInput(),
        optimistic: sampleOptimistic(),
      });
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Save failed");
    });

    // optimistic write remains (previous was falsy — no restore)
    const data = qc.getQueryData(ESTIMATE_KEY) as { estimate: { mid_total: number } };
    expect(data.estimate.mid_total).toBe(5940);
  });

  it("source does not reference room-estimate key", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "useSaveEstimateBuilder.ts"), "utf8");
    expect(src).not.toMatch(/room-estimate/);
    expect(src).toMatch(/saveAIEstimate/);
    expect(src).toMatch(/estimateQueryOptions/);
    expect(src).toMatch(/financialsByProject/);
  });
});
