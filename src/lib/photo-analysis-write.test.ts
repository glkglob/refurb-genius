import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { fromMock, updateMock, eqMock } = vi.hoisted(() => {
  const eqMock = vi.fn();
  const updateMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ update: updateMock }));
  return { fromMock, updateMock, eqMock };
});

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { updatePhotoAnalysisResult } from "./photo-analysis-write";

describe("photo-analysis-write", () => {
  const FIXED = "2026-07-27T12:00:00.000Z";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED));
    eqMock.mockResolvedValue({ error: null });
    updateMock.mockImplementation(() => ({ eq: eqMock }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates photo_analysis_results with analysis_data + confidence only", async () => {
    const result = await updatePhotoAnalysisResult({
      id: "analysis-1",
      category: "Kitchen",
      condition_report: "Fair",
      detected_defects: [{ description: "Crack", severity: "low" }],
      material_estimates: [{ name: "Tile", quantity: 2, unit: "m2" }],
      cost_suggestions: { mid: 500 },
      confidence_score: 0.85,
    });

    expect(result).toBeUndefined();
    expect(fromMock).toHaveBeenCalledWith("photo_analysis_results");
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({
      analysis_data: {
        category: "Kitchen",
        condition_report: "Fair",
        detected_defects: [{ description: "Crack", severity: "low" }],
        material_estimates: [{ name: "Tile", quantity: 2, unit: "m2" }],
        cost_suggestions: { mid: 500 },
      },
      confidence: 0.85,
      updated_at: FIXED,
    });
    const firstCall = updateMock.mock.calls[0] as unknown as [Record<string, unknown>];
    const payload = firstCall[0];
    expect(Object.keys(payload).sort()).toEqual(
      ["analysis_data", "confidence", "updated_at"].sort(),
    );
    // Obsolete flat columns must not appear on the DB update payload
    expect(payload).not.toHaveProperty("category");
    expect(payload).not.toHaveProperty("condition_report");
    expect(payload).not.toHaveProperty("detected_defects");
    expect(payload).not.toHaveProperty("material_estimates");
    expect(payload).not.toHaveProperty("cost_suggestions");
    expect(payload).not.toHaveProperty("confidence_score");
    expect(eqMock).toHaveBeenCalledWith("id", "analysis-1");
  });

  it("applies null fallbacks for optional fields inside analysis_data", async () => {
    await updatePhotoAnalysisResult({
      id: "a2",
      detected_defects: [],
      material_estimates: [],
      cost_suggestions: {},
    });

    expect(updateMock).toHaveBeenCalledWith({
      analysis_data: {
        category: null,
        condition_report: null,
        detected_defects: [],
        material_estimates: [],
        cost_suggestions: {},
      },
      confidence: null,
      updated_at: FIXED,
    });
  });

  it("throws Supabase error and does not call select", async () => {
    const err = { message: "rls denied", code: "42501" };
    eqMock.mockResolvedValue({ error: err });

    await expect(
      updatePhotoAnalysisResult({
        id: "a3",
        detected_defects: [],
        material_estimates: [],
        cost_suggestions: {},
      }),
    ).rejects.toBe(err);

    const chain = fromMock.mock.results[0]?.value as {
      update: unknown;
      select?: unknown;
      insert?: unknown;
      delete?: unknown;
    };
    expect(chain).not.toHaveProperty("select");
    expect(typeof (chain as { update: unknown }).update).toBe("function");
  });

  it("source has no Auth, QueryClient, select, or insert/delete", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/photo-analysis-write.ts"), "utf8");
    expect(src).not.toMatch(/auth\.getUser|useAuth|@\/lib\/auth/);
    expect(src).not.toMatch(/useQueryClient|invalidateQueries|setQueryData/);
    expect(src).not.toMatch(/from\s+["']sonner["']/);
    // Method-call form only (avoid false positives on unrelated identifiers).
    expect(src).not.toMatch(/\)\s*\.select\s*\(|\n\s*\.select\s*\(/);
    expect(src).not.toMatch(/\.insert\s*\(|\.delete\s*\(/);
    expect(src).not.toMatch(/from\s+["']@\/lib\/logger["']/);
  });

  it("source does not use as any or ts-ignore", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/photo-analysis-write.ts"), "utf8");
    expect(src).not.toMatch(/as any/);
    expect(src).not.toMatch(/@ts-ignore|@ts-expect-error/);
  });
});
