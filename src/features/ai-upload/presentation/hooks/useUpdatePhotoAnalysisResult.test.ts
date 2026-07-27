/**
 * AO-1C1 — useUpdatePhotoAnalysisResult: canonical write + optimistic analysis cache.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  photoAnalysisByProjectQueryOptions,
  type PhotoAnalysisResultRow,
} from "@/lib/queries/photo-analysis";
import { estimateQueryOptions } from "@/lib/queries/projects";

const updatePhotoAnalysisResult = vi.fn();

vi.mock("@/lib/photo-analysis-write", () => ({
  updatePhotoAnalysisResult: (...args: unknown[]) => updatePhotoAnalysisResult(...args),
}));

import { useUpdatePhotoAnalysisResult } from "./useUpdatePhotoAnalysisResult";

const PROJECT = "proj-1";
const ANALYSIS_A = "analysis-a";
const ANALYSIS_B = "analysis-b";

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

function seedAnalyses(qc: QueryClient, rows: PhotoAnalysisResultRow[]) {
  qc.setQueryData(photoAnalysisByProjectQueryOptions(PROJECT).queryKey, rows);
}

function row(id: string, overrides: Partial<PhotoAnalysisResultRow> = {}): PhotoAnalysisResultRow {
  return {
    id,
    project_id: PROJECT,
    photo_id: `photo-${id}`,
    category: "Original",
    condition_report: "Before",
    detected_defects: [],
    material_estimates: [],
    cost_suggestions: {},
    confidence_score: 0.5,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    created_by: null,
    editable_notes: null,
    room_id: null,
    severity: null,
    synced_to_estimate: false,
    ...overrides,
  } as PhotoAnalysisResultRow;
}

beforeEach(() => {
  updatePhotoAnalysisResult.mockReset();
  updatePhotoAnalysisResult.mockResolvedValue(undefined);
});

describe("useUpdatePhotoAnalysisResult", () => {
  it("calls updatePhotoAnalysisResult with exact mapped payload (category not room)", async () => {
    const qc = createQc();
    seedAnalyses(qc, [row(ANALYSIS_A)]);

    const { result } = renderHook(() => useUpdatePhotoAnalysisResult(PROJECT), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: ANALYSIS_A,
        newData: {
          category: "Bathroom",
          condition_report: "Good",
          defects: [{ description: "Leak", severity: "high" }],
          material_estimates: [{ name: "Pipe", quantity: 1, unit: "ea" }],
          cost_suggestions: { mid: 200, low: 100, high: 300 },
          confidence: 0.9,
        },
      });
    });

    expect(updatePhotoAnalysisResult).toHaveBeenCalledTimes(1);
    expect(updatePhotoAnalysisResult).toHaveBeenCalledWith({
      id: ANALYSIS_A,
      category: "Bathroom",
      condition_report: "Good",
      detected_defects: [{ description: "Leak", severity: "high" }],
      material_estimates: [{ name: "Pipe", quantity: 1, unit: "ea" }],
      cost_suggestions: { mid: 200, low: 100, high: 300 },
      confidence_score: 0.9,
    });
    const arg = updatePhotoAnalysisResult.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg).not.toHaveProperty("room");
  });

  it("maps missing optional fields with current null/empty defaults", async () => {
    const qc = createQc();
    seedAnalyses(qc, [row(ANALYSIS_A)]);

    const { result } = renderHook(() => useUpdatePhotoAnalysisResult(PROJECT), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: ANALYSIS_A,
        newData: {},
      });
    });

    expect(updatePhotoAnalysisResult).toHaveBeenCalledWith({
      id: ANALYSIS_A,
      category: null,
      condition_report: null,
      detected_defects: [],
      material_estimates: [],
      cost_suggestions: {},
      confidence_score: null,
    });
  });

  it("optimistically patches only the matching row without updated_at", async () => {
    const qc = createQc();
    seedAnalyses(qc, [
      row(ANALYSIS_A, { category: "A", updated_at: "old-a" }),
      row(ANALYSIS_B, { category: "B", updated_at: "old-b" }),
    ]);

    let resolveWrite: (() => void) | undefined;
    updatePhotoAnalysisResult.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );

    const { result } = renderHook(() => useUpdatePhotoAnalysisResult(PROJECT), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.mutate({
        id: ANALYSIS_A,
        newData: { category: "Patched", condition_report: "New", confidence: 0.2 },
      });
    });

    await waitFor(() => {
      const data = qc.getQueryData<PhotoAnalysisResultRow[]>(
        photoAnalysisByProjectQueryOptions(PROJECT).queryKey,
      );
      expect(data?.find((r) => r.id === ANALYSIS_A)?.category).toBe("Patched");
    });

    const data = qc.getQueryData<PhotoAnalysisResultRow[]>(
      photoAnalysisByProjectQueryOptions(PROJECT).queryKey,
    )!;
    const patched = data.find((r) => r.id === ANALYSIS_A)!;
    const other = data.find((r) => r.id === ANALYSIS_B)!;
    expect(patched.condition_report).toBe("New");
    expect(patched.confidence_score).toBe(0.2);
    expect(patched.updated_at).toBe("old-a");
    expect(other.category).toBe("B");
    expect(other.updated_at).toBe("old-b");

    await act(async () => {
      resolveWrite?.();
    });
  });

  it("rolls back previous list on error and does not invalidate", async () => {
    const qc = createQc();
    const previous = [row(ANALYSIS_A, { category: "Original" })];
    seedAnalyses(qc, previous);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    updatePhotoAnalysisResult.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useUpdatePhotoAnalysisResult(PROJECT), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          id: ANALYSIS_A,
          newData: { category: "ShouldRollback" },
        });
      } catch {
        // expected
      }
    });

    const data = qc.getQueryData<PhotoAnalysisResultRow[]>(
      photoAnalysisByProjectQueryOptions(PROJECT).queryKey,
    );
    expect(data?.[0]?.category).toBe("Original");
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("invalidates exact analysis project key on success only", async () => {
    const qc = createQc();
    seedAnalyses(qc, [row(ANALYSIS_A)]);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const estimateKey = estimateQueryOptions(PROJECT).queryKey;

    const { result } = renderHook(() => useUpdatePhotoAnalysisResult(PROJECT), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: ANALYSIS_A,
        newData: { category: "Saved" },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: photoAnalysisByProjectQueryOptions(PROJECT).queryKey,
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: estimateKey });
  });

  it("source sets retry false and has no toast import or direct Supabase", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "src/features/ai-upload/presentation/hooks/useUpdatePhotoAnalysisResult.ts",
      ),
      "utf8",
    );
    expect(src).toMatch(/retry:\s*false/);
    expect(src).not.toMatch(/from\s+["']sonner["']/);
    expect(src).not.toMatch(/toast\.(success|error|info)/);
    expect(src).not.toMatch(/@\/platform\/supabase/);
    expect(src).not.toMatch(/estimateQueryOptions/);
    expect(src).toMatch(/updatePhotoAnalysisResult/);
    expect(src).toMatch(/photoAnalysisByProjectQueryOptions/);
  });
});
