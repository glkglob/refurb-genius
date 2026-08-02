import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serializePhotoAnalysisContent } from "@repo/types";

const { fromMock, updateMock, eqMock } = vi.hoisted(() => {
  const eqMock = vi.fn();
  const updateMock = vi.fn<(payload: Record<string, unknown>) => { eq: typeof eqMock }>(() => ({
    eq: eqMock,
  }));
  const fromMock = vi.fn(() => ({ update: updateMock }));
  return { fromMock, updateMock, eqMock };
});

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { updatePhotoAnalysisResult } from "./photo-analysis-write";

function lastUpdatePayload(): Record<string, unknown> {
  expect(updateMock).toHaveBeenCalled();
  const payload = updateMock.mock.calls[0]?.[0];
  expect(payload).toBeDefined();
  expect(payload).toBeTypeOf("object");
  return payload!;
}

/** Fail if any undefined appears in a JSON tree (keys or values). */
function assertNoUndefined(value: unknown, path = "$"): void {
  expect(value, path).not.toBeUndefined();
  if (value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoUndefined(item, `${path}[${i}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      expect(k.includes("undefined")).toBe(false);
      assertNoUndefined(v, `${path}.${k}`);
    }
  }
}

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
    const payload = lastUpdatePayload();
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

  it("payload analysis_data is JSON-compatible and has no undefined properties", async () => {
    await updatePhotoAnalysisResult({
      id: "a-json",
      category: "Bath",
      condition_report: "Ok",
      detected_defects: [{ description: "Drip" }],
      material_estimates: [{ name: "Sealant", quantity: 1, unit: "tube" }],
      cost_suggestions: { mid: 40, low: 20 },
      confidence_score: 0.7,
    });

    const payload = lastUpdatePayload();
    const analysisData = payload.analysis_data;
    expect(() => JSON.stringify(analysisData)).not.toThrow();
    assertNoUndefined(analysisData);
    // Round-trip preserves structure
    expect(JSON.parse(JSON.stringify(analysisData))).toEqual(analysisData);
  });

  it("serializer omits undefined optional defect/material keys", () => {
    const json = serializePhotoAnalysisContent({
      category: "Kitchen",
      condition_report: null,
      detected_defects: [{ description: "Crack" }], // no severity
      material_estimates: [{ name: "Tile", quantity: 1, unit: "m2" }], // no cost_per_unit
      cost_suggestions: { mid: 10 },
    });
    expect(json).toEqual({
      category: "Kitchen",
      condition_report: null,
      detected_defects: [{ description: "Crack" }],
      material_estimates: [{ name: "Tile", quantity: 1, unit: "m2" }],
      cost_suggestions: { mid: 10 },
    });
    assertNoUndefined(json);
    const defect = (json as { detected_defects: Array<Record<string, unknown>> })
      .detected_defects[0];
    expect(defect).not.toHaveProperty("severity");
    expect(defect).not.toHaveProperty("estimated_cost");
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
    expect(typeof chain.update).toBe("function");
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

  it("source does not use prohibited assertions or suppressions", () => {
    // Strip block comments so documentation text cannot false-positive the scan.
    const src = readFileSync(
      join(process.cwd(), "src/lib/photo-analysis-write.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toMatch(/\bas any\b/);
    expect(src).not.toMatch(/\bas unknown as\b/);
    expect(src).not.toMatch(/\bunknown as\b/);
    expect(src).not.toMatch(/@ts-ignore|@ts-expect-error|@ts-nocheck/);
    expect(src).not.toMatch(/eslint-disable/);
  });
});
