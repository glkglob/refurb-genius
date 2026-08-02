/**
 * AO-1C2 — useApplyPhotoAnalysesToEstimate: estimate cache append + invalidate.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { estimateQueryOptions } from "@/lib/queries/projects";
import {
  photoAnalysisByProjectQueryOptions,
  type PhotoAnalysisResultRow,
} from "@/lib/queries/photo-analysis";
import { createPhotoAnalysisAppModel } from "@repo/types";
import type { PersistedRoomEstimate } from "../../infrastructure/repositories/estimate.repository";

const mapMock = vi.hoisted(() => vi.fn());

vi.mock("../../application/mapPhotoAnalysesToEstimateRooms", () => ({
  mapPhotoAnalysesToEstimateRooms: (...args: unknown[]) => mapMock(...args),
}));

import { useApplyPhotoAnalysesToEstimate } from "./useApplyPhotoAnalysesToEstimate";

const PROJECT = "proj-1";

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

function analysis(id: string): PhotoAnalysisResultRow {
  return createPhotoAnalysisAppModel({
    id,
    project_id: PROJECT,
    photo_id: `photo-${id}`,
    category: "Kitchen",
    condition_report: null,
    detected_defects: [],
    material_estimates: [],
    cost_suggestions: null,
    confidence_score: 0.8,
  });
}

beforeEach(() => {
  mapMock.mockReset();
  mapMock.mockReturnValue([
    { id: "new-room-1", name: "Kitchen", items: [{ id: "sugg-a1-0", name: "Crack" }] },
  ]);
});

describe("useApplyPhotoAnalysesToEstimate", () => {
  it("maps analyses, appends rooms, preserves current fields, invalidates exact key", () => {
    const qc = createQc();
    const key = estimateQueryOptions(PROJECT).queryKey;
    const current = {
      estimate: { id: "est-1", mid_total: 999 },
      rooms: [{ id: "existing", name: "Living", items: [] }],
    } as unknown as PersistedRoomEstimate;
    qc.setQueryData(key, current);

    const order: string[] = [];
    const origSet = qc.setQueryData.bind(qc);
    const setSpy = vi
      .spyOn(qc, "setQueryData")
      .mockImplementation((...args: Parameters<typeof qc.setQueryData>) => {
        order.push("set");
        return origSet(...args);
      });
    const invSpy = vi
      .spyOn(qc, "invalidateQueries")
      .mockImplementation((...args: Parameters<typeof qc.invalidateQueries>) => {
        order.push("invalidate");
        return Promise.resolve();
      });

    const analyses = [analysis("a1")];
    const { result } = renderHook(() => useApplyPhotoAnalysesToEstimate(PROJECT), {
      wrapper: createWrapper(qc),
    });

    const ret = result.current.applyPhotoAnalysesToEstimate(analyses);

    expect(mapMock).toHaveBeenCalledTimes(1);
    expect(mapMock).toHaveBeenCalledWith(analyses);
    expect(ret).toEqual({ analysisCount: 1, roomCount: 1 });

    const data = qc.getQueryData<PersistedRoomEstimate>(key)!;
    expect(data.estimate).toEqual(current.estimate);
    expect(data.rooms.map((r) => r.id)).toEqual(["existing", "new-room-1"]);
    expect(data.rooms[0]?.name).toBe("Living");
    expect(data.rooms[1]?.name).toBe("Kitchen");

    expect(invSpy).toHaveBeenCalledTimes(1);
    expect(invSpy).toHaveBeenCalledWith({ queryKey: key });
    expect(order).toEqual(["set", "invalidate"]);
    setSpy.mockRestore();
    invSpy.mockRestore();
  });

  it("writes { rooms } only when current is null or undefined", () => {
    const qc = createQc();
    const key = estimateQueryOptions(PROJECT).queryKey;

    const { result } = renderHook(() => useApplyPhotoAnalysesToEstimate(PROJECT), {
      wrapper: createWrapper(qc),
    });

    result.current.applyPhotoAnalysesToEstimate([analysis("a1")]);
    expect(qc.getQueryData(key)).toEqual({
      rooms: [{ id: "new-room-1", name: "Kitchen", items: [{ id: "sugg-a1-0", name: "Crack" }] }],
    });

    qc.setQueryData(key, null);
    mapMock.mockReturnValue([{ id: "new-room-2", name: "Bath", items: [] }]);
    result.current.applyPhotoAnalysesToEstimate([analysis("a2")]);
    expect(qc.getQueryData(key)).toEqual({
      rooms: [{ id: "new-room-2", name: "Bath", items: [] }],
    });
  });

  it("does not touch analysis keys, room-estimate key, or introduce useMutation/toast/supabase", () => {
    const qc = createQc();
    const key = estimateQueryOptions(PROJECT).queryKey;
    const analysisKey = photoAnalysisByProjectQueryOptions(PROJECT).queryKey;
    qc.setQueryData(analysisKey, [{ id: "keep" }] as never);
    qc.setQueryData(["room-estimate", PROJECT], { rooms: [{ id: "rt" }] } as never);

    const invSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useApplyPhotoAnalysesToEstimate(PROJECT), {
      wrapper: createWrapper(qc),
    });
    result.current.applyPhotoAnalysesToEstimate([analysis("a1")]);

    expect(qc.getQueryData(analysisKey)).toEqual([{ id: "keep" }]);
    expect(qc.getQueryData(["room-estimate", PROJECT])).toEqual({ rooms: [{ id: "rt" }] });
    expect(invSpy).toHaveBeenCalledWith({ queryKey: key });
    expect(invSpy).not.toHaveBeenCalledWith({ queryKey: analysisKey });
    expect(invSpy).not.toHaveBeenCalledWith({ queryKey: ["room-estimate", PROJECT] });

    const src = readFileSync(
      join(
        process.cwd(),
        "src/features/estimate/presentation/hooks/useApplyPhotoAnalysesToEstimate.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/useMutation/);
    expect(src).not.toMatch(/from\s+["']sonner["']/);
    expect(src).not.toMatch(/@\/platform\/supabase/);
    expect(src).not.toMatch(/auth\.getUser|useAuth/);
    expect(src).not.toMatch(/retry\s*:/);
    expect(src).toMatch(/void queryClient\.invalidateQueries/);
  });
});
