/**
 * AO-1H2 — useSyncFloorplanTagsToEstimate: product-estimate cache sync only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { estimateQueryOptions, projectKeys } from "@/lib/queries/projects";

const toastSuccess = vi.hoisted(() => vi.fn());
const toastInfo = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    info: (...args: unknown[]) => toastInfo(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { useSyncFloorplanTagsToEstimate } from "./useSyncFloorplanTagsToEstimate";

const PROJECT = "proj-1";
const ESTIMATE_KEY = estimateQueryOptions(PROJECT).queryKey;
const ROOM_ESTIMATE_KEY = ["room-estimate", PROJECT] as const;
const FINANCIALS_KEY = projectKeys.financialsByProject(PROJECT);

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
  toastSuccess.mockReset();
  toastInfo.mockReset();
  toastError.mockReset();
  vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSyncFloorplanTagsToEstimate", () => {
  it("empty annotations: no cache get/set/invalidate/toast", () => {
    const qc = createQc();
    const getSpy = vi.spyOn(qc, "getQueryData");
    const setSpy = vi.spyOn(qc, "setQueryData");
    const invSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useSyncFloorplanTagsToEstimate(PROJECT), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.syncTagsToEstimate([]);
    });

    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(invSpy).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it("no usable labels: no cache set/invalidate/toast", () => {
    const qc = createQc();
    const getSpy = vi.spyOn(qc, "getQueryData");
    const setSpy = vi.spyOn(qc, "setQueryData");
    const invSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useSyncFloorplanTagsToEstimate(PROJECT), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.syncTagsToEstimate([{ label: "" }, { label: null }, {}]);
    });

    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(invSpy).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("all labels already exist: info toast, no set/invalidate", () => {
    const qc = createQc();
    qc.setQueryData(ESTIMATE_KEY, {
      estimate: { mid_total: 1 },
      rooms: [{ name: "Kitchen" }, { name: "Bath" }],
    } as never);
    const setSpy = vi.spyOn(qc, "setQueryData");
    const invSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useSyncFloorplanTagsToEstimate(PROJECT), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.syncTagsToEstimate([{ label: "Kitchen" }, { label: "Bath" }]);
    });

    expect(toastInfo).toHaveBeenCalledWith("All tags already in Estimate");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(invSpy).not.toHaveBeenCalled();
  });

  it("new labels: set then invalidate then success toast on product key", async () => {
    const qc = createQc();
    const current = {
      estimate: { mid_total: 99 },
      rooms: [{ name: "Keep", items: [{ id: "i1" }] }],
    };
    qc.setQueryData(ESTIMATE_KEY, current as never);
    qc.setQueryData(ROOM_ESTIMATE_KEY, { rooms: [{ name: "AI-only" }] });
    qc.setQueryData(FINANCIALS_KEY, { roi: 1 });

    const order: string[] = [];
    const setSpy = vi.spyOn(qc, "setQueryData").mockImplementation((...args) => {
      order.push("set");
      return Reflect.apply(QueryClient.prototype.setQueryData, qc, args as never);
    });
    const invSpy = vi.spyOn(qc, "invalidateQueries").mockImplementation(async (...args) => {
      order.push("invalidate");
      return Reflect.apply(QueryClient.prototype.invalidateQueries, qc, args as never);
    });
    const origSuccess = toastSuccess.getMockImplementation();
    toastSuccess.mockImplementation((...args: unknown[]) => {
      order.push("toast");
      return origSuccess?.(...args);
    });

    const { result } = renderHook(() => useSyncFloorplanTagsToEstimate(PROJECT), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.syncTagsToEstimate([{ label: "Kitchen" }, { label: "Keep" }]);
    });

    expect(setSpy).toHaveBeenCalled();
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ESTIMATE_KEY });
    expect(toastSuccess).toHaveBeenCalledWith("Synced 1 room tags from 3D to Estimate Builder");
    expect(order).toEqual(["set", "invalidate", "toast"]);

    const updated = qc.getQueryData(ESTIMATE_KEY) as {
      estimate: { mid_total: number };
      rooms: Array<{ name: string; id?: string; items: unknown[] }>;
    };
    expect(updated.estimate).toEqual({ mid_total: 99 });
    expect(updated.rooms[0]).toEqual({ name: "Keep", items: [{ id: "i1" }] });
    expect(updated.rooms[1]).toEqual({
      id: "fp-1700000000000-Kitchen",
      name: "Kitchen",
      items: [],
    });

    // Isolation
    expect(qc.getQueryData(ROOM_ESTIMATE_KEY)).toEqual({ rooms: [{ name: "AI-only" }] });
    expect(qc.getQueryData(FINANCIALS_KEY)).toEqual({ roi: 1 });
  });

  it("undefined current cache: writes rooms-only object", () => {
    const qc = createQc();

    const { result } = renderHook(() => useSyncFloorplanTagsToEstimate(PROJECT), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.syncTagsToEstimate([{ label: "Hall" }]);
    });

    expect(qc.getQueryData(ESTIMATE_KEY)).toEqual({
      rooms: [{ id: "fp-1700000000000-Hall", name: "Hall", items: [] }],
    });
    expect(toastSuccess).toHaveBeenCalledWith("Synced 1 room tags from 3D to Estimate Builder");
  });

  it("uses estimateQueryOptions product key only", () => {
    expect(ESTIMATE_KEY).toEqual(projectKeys.estimateByProject(PROJECT));
    expect(ESTIMATE_KEY).toEqual(["projects", PROJECT, "estimate"]);
  });

  it("source has no useMutation, room-estimate, financials, or saveAIEstimate", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "useSyncFloorplanTagsToEstimate.ts"), "utf8");
    expect(src).toMatch(/useQueryClient/);
    expect(src).toMatch(/estimateQueryOptions/);
    expect(src).toMatch(/mapFloorplanAnnotationsToEstimateRooms/);
    expect(src).not.toMatch(/\buseMutation\b/);
    expect(src).not.toMatch(/\["room-estimate"/);
    expect(src).not.toMatch(/financialsByProject/);
    expect(src).not.toMatch(/\bsaveAIEstimate\b/);
    expect(src).not.toMatch(/useQuery\s*\(/);
  });
});
