/**
 * AO-1L1 — useAIEstimateBuilderSave: guard, mutate, toasts, onSaved order.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PersistedRoomEstimate } from "../../infrastructure/repositories/estimate.repository";
import type { SaveAIEstimateBuilderSnapshot } from "./useAIEstimateBuilderSave";

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

import { useAIEstimateBuilderSave } from "./useAIEstimateBuilderSave";

const PROJECT = "proj-a";

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

function sampleSnapshot(
  overrides: Partial<SaveAIEstimateBuilderSnapshot> = {},
): SaveAIEstimateBuilderSnapshot {
  return {
    propertyType: "Flat",
    bedrooms: 2,
    region: "London",
    rooms: [
      {
        name: "Kitchen",
        area_sqm: 10,
        items: [
          {
            name: "Cabinets",
            category: "both",
            quantity: 1,
            unit: "set",
            base_unit_cost: 1000,
            is_ai_suggested: true,
          },
        ],
      },
    ],
    notes: "AI notes",
    multiplier: 1.2,
    totals: { subtotal: 1200, vat_amount: 240, total: 1440 },
    ...overrides,
  };
}

beforeEach(() => {
  saveAIEstimate.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAIEstimateBuilderSave", () => {
  it("empty rooms: toast guard and does not mutate or onSaved", () => {
    const qc = createQc();
    const onSaved = vi.fn();
    const { result } = renderHook(() => useAIEstimateBuilderSave({ projectId: PROJECT, onSaved }), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.saveEstimate(sampleSnapshot({ rooms: [] }));
    });

    expect(toastError).toHaveBeenCalledWith("Generate or add rooms first");
    expect(saveAIEstimate).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("non-empty rooms: calls saveAIEstimate once with mapped payload", async () => {
    const qc = createQc();
    saveAIEstimate.mockResolvedValue({
      estimate: { id: "est-1" },
      rooms: [],
    } as unknown as PersistedRoomEstimate);

    const { result } = renderHook(() => useAIEstimateBuilderSave({ projectId: PROJECT }), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.saveEstimate(sampleSnapshot());
    });

    await waitFor(() => {
      expect(saveAIEstimate).toHaveBeenCalledTimes(1);
    });

    const payload = saveAIEstimate.mock.calls[0]![0] as {
      projectId: string;
      title: string;
      vat_rate: number;
      rooms: Array<{ name: string; items: Array<{ name: string }> }>;
      notes?: string;
    };
    expect(payload.projectId).toBe(PROJECT);
    expect(payload.title).toBe("AI Estimate — Flat, 2 bed");
    expect(payload.vat_rate).toBe(20);
    expect(payload.rooms.map((r) => r.name)).toEqual(["Kitchen"]);
    expect(payload.rooms[0]!.items.map((i) => i.name)).toEqual(["Cabinets"]);
    expect(payload.notes).toBe("AI notes");
  });

  it("success: toast then onSaved with estimate id; no direct invalidation ownership", async () => {
    const qc = createQc();
    const order: string[] = [];
    const invSpy = vi.spyOn(qc, "invalidateQueries").mockImplementation(async () => {
      order.push("invalidate");
    });
    toastSuccess.mockImplementation(() => {
      order.push("toast-success");
    });
    const onSaved = vi.fn(() => {
      order.push("onSaved");
    });

    saveAIEstimate.mockResolvedValue({
      estimate: { id: "est-99" },
      rooms: [],
    } as unknown as PersistedRoomEstimate);

    const { result } = renderHook(() => useAIEstimateBuilderSave({ projectId: PROJECT, onSaved }), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.saveEstimate(sampleSnapshot());
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith("est-99");
    });

    expect(toastSuccess).toHaveBeenCalledWith("Estimate saved");
    expect(order.indexOf("toast-success")).toBeLessThan(order.indexOf("onSaved"));
    // Invalidations run via useSaveAIEstimate; toast/onSaved after mutation success
    expect(invSpy).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("failure: error toast with message fallback; no onSaved", async () => {
    const qc = createQc();
    const onSaved = vi.fn();
    saveAIEstimate.mockRejectedValue(new Error("db down"));

    const { result } = renderHook(() => useAIEstimateBuilderSave({ projectId: PROJECT, onSaved }), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.saveEstimate(sampleSnapshot());
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("db down");
    });

    expect(onSaved).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("failure without message uses Failed to save estimate", async () => {
    const qc = createQc();
    saveAIEstimate.mockRejectedValue(new Error(""));

    const { result } = renderHook(() => useAIEstimateBuilderSave({ projectId: PROJECT }), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.saveEstimate(sampleSnapshot());
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });

    // Error("") has falsy message → fallback
    expect(toastError).toHaveBeenCalledWith("Failed to save estimate");
  });

  it("exposes isPending while mutation in flight", async () => {
    const qc = createQc();
    let resolveSave: (v: PersistedRoomEstimate) => void = () => {};
    saveAIEstimate.mockImplementation(
      () =>
        new Promise<PersistedRoomEstimate>((resolve) => {
          resolveSave = resolve;
        }),
    );

    const { result } = renderHook(() => useAIEstimateBuilderSave({ projectId: PROJECT }), {
      wrapper: createWrapper(qc),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.saveEstimate(sampleSnapshot());
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    act(() => {
      resolveSave({
        estimate: { id: "e1" },
        rooms: [],
      } as unknown as PersistedRoomEstimate);
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });

  it("source does not own QueryClient, projectKeys, or repository import", () => {
    const src = readFileSync(join(__dirname, "useAIEstimateBuilderSave.ts"), "utf8");
    expect(src).not.toMatch(/useQueryClient/);
    expect(src).not.toMatch(/useMutation/);
    expect(src).not.toMatch(/invalidateQueries/);
    expect(src).not.toMatch(/projectKeys/);
    expect(src).not.toMatch(/room-estimate/);
    expect(src).not.toMatch(/saveAIEstimate/);
    expect(src).toMatch(/useSaveAIEstimate/);
    expect(src).toMatch(/buildAIEstimateBuilderSaveInput/);
  });
});
