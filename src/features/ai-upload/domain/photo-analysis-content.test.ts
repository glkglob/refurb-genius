/**
 * P1B2 — photo-analysis analysis_data parser/serializer contract.
 */
import { describe, it, expect } from "vitest";
import {
  parsePhotoAnalysisContent,
  serializePhotoAnalysisContent,
  mapPhotoAnalysisRow,
  EMPTY_PHOTO_ANALYSIS_CONTENT,
  createPhotoAnalysisAppModel,
  type PhotoAnalysisJson,
} from "./photo-analysis-content";

describe("parsePhotoAnalysisContent", () => {
  it("parses complete valid analysis_data", () => {
    const data: PhotoAnalysisJson = {
      category: "Kitchen",
      condition_report: "Fair",
      detected_defects: [{ description: "Crack", severity: "low", estimated_cost: 200 }],
      material_estimates: [{ name: "Tile", quantity: 3, unit: "m2", cost_per_unit: 12 }],
      cost_suggestions: { low: 100, mid: 500, high: 900 },
    };
    expect(parsePhotoAnalysisContent(data)).toEqual({
      category: "Kitchen",
      condition_report: "Fair",
      detected_defects: [{ description: "Crack", severity: "low", estimated_cost: 200 }],
      material_estimates: [{ name: "Tile", quantity: 3, unit: "m2", cost_per_unit: 12 }],
      cost_suggestions: { low: 100, mid: 500, high: 900 },
    });
  });

  it("returns empty defaults for empty object", () => {
    expect(parsePhotoAnalysisContent({})).toEqual(EMPTY_PHOTO_ANALYSIS_CONTENT);
  });

  it("returns empty defaults for null", () => {
    expect(parsePhotoAnalysisContent(null)).toEqual(EMPTY_PHOTO_ANALYSIS_CONTENT);
  });

  it("returns empty defaults for non-object JSON", () => {
    expect(parsePhotoAnalysisContent("not-an-object")).toEqual(EMPTY_PHOTO_ANALYSIS_CONTENT);
    expect(parsePhotoAnalysisContent(42)).toEqual(EMPTY_PHOTO_ANALYSIS_CONTENT);
    expect(parsePhotoAnalysisContent(true)).toEqual(EMPTY_PHOTO_ANALYSIS_CONTENT);
    expect(parsePhotoAnalysisContent([])).toEqual(EMPTY_PHOTO_ANALYSIS_CONTENT);
  });

  it("handles missing keys with defaults", () => {
    expect(parsePhotoAnalysisContent({ category: "Bath" })).toEqual({
      category: "Bath",
      condition_report: null,
      detected_defects: [],
      material_estimates: [],
      cost_suggestions: null,
    });
  });

  it("drops invalid entries from mixed-type arrays", () => {
    const data: PhotoAnalysisJson = {
      detected_defects: [
        { description: "Ok", severity: "high" },
        12,
        null,
        { severity: "low" }, // missing description
        "string-defect",
        { description: "Valid2" },
      ],
      material_estimates: [
        { name: "Pipe", quantity: 1, unit: "ea" },
        { quantity: 2 }, // missing name
        99,
        { name: "Glue", unit: "tube" },
      ],
    };
    const parsed = parsePhotoAnalysisContent(data);
    expect(parsed.detected_defects).toEqual([
      { description: "Ok", severity: "high" },
      { description: "Valid2" },
    ]);
    expect(parsed.material_estimates).toEqual([
      { name: "Pipe", quantity: 1, unit: "ea" },
      { name: "Glue", quantity: 1, unit: "tube" },
    ]);
  });

  it("does not coerce numbers or objects into strings", () => {
    // runtime values may be wrong types inside Json
    const parsed = parsePhotoAnalysisContent({
      category: 123,
      condition_report: { text: "nope" },
    });
    expect(parsed.category).toBeNull();
    expect(parsed.condition_report).toBeNull();
  });

  it("supports camelCase legacy aliases", () => {
    const parsed = parsePhotoAnalysisContent({
      conditionReport: "Legacy",
      detectedDefects: [{ description: "Drip" }],
      materialEstimates: [{ name: "Sealant", quantity: 1, unit: "tube" }],
      costSuggestions: { mid: 50 },
    });
    expect(parsed.condition_report).toBe("Legacy");
    expect(parsed.detected_defects).toEqual([{ description: "Drip" }]);
    expect(parsed.material_estimates[0]?.name).toBe("Sealant");
    expect(parsed.cost_suggestions).toEqual({ mid: 50 });
  });

  it("rejects invalid nested cost_suggestions", () => {
    expect(parsePhotoAnalysisContent({ cost_suggestions: "cheap" }).cost_suggestions).toBeNull();
    expect(parsePhotoAnalysisContent({ cost_suggestions: [] }).cost_suggestions).toBeNull();
    expect(
      parsePhotoAnalysisContent({ cost_suggestions: { mid: "x" } }).cost_suggestions,
    ).toBeNull();
  });
});

describe("serializePhotoAnalysisContent", () => {
  it("maps full supported payload to analysis_data snake_case keys", () => {
    const json = serializePhotoAnalysisContent({
      category: "Kitchen",
      condition_report: "Fair",
      detected_defects: [{ description: "Crack", severity: "low" }],
      material_estimates: [{ name: "Tile", quantity: 2, unit: "m2" }],
      cost_suggestions: { mid: 500 },
    });
    expect(json).toEqual({
      category: "Kitchen",
      condition_report: "Fair",
      detected_defects: [{ description: "Crack", severity: "low" }],
      material_estimates: [{ name: "Tile", quantity: 2, unit: "m2" }],
      cost_suggestions: { mid: 500 },
    });
  });

  it("uses empty defaults for missing arrays and null fields", () => {
    const json = serializePhotoAnalysisContent({
      category: null,
      condition_report: null,
      detected_defects: [],
      material_estimates: [],
      cost_suggestions: {},
    });
    expect(json).toEqual({
      category: null,
      condition_report: null,
      detected_defects: [],
      material_estimates: [],
      cost_suggestions: {},
    });
  });

  it("never includes obsolete flat column names outside content keys", () => {
    const json = serializePhotoAnalysisContent({
      category: "A",
      detected_defects: [],
      material_estimates: [],
      cost_suggestions: {},
    }) as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual(
      [
        "category",
        "condition_report",
        "cost_suggestions",
        "detected_defects",
        "material_estimates",
      ].sort(),
    );
    expect(json).not.toHaveProperty("confidence_score");
    expect(json).not.toHaveProperty("confidence");
    expect(json).not.toHaveProperty("synced_to_estimate");
  });
});

describe("mapPhotoAnalysisRow", () => {
  it("maps canonical analysis_data + confidence column", () => {
    const model = mapPhotoAnalysisRow({
      id: "a1",
      project_id: "p1",
      photo_id: "ph1",
      user_id: "u1",
      source: "ai",
      created_at: "t0",
      updated_at: "t1",
      analysis_data: {
        category: "Bath",
        condition_report: "Poor",
        detected_defects: [{ description: "Mould", severity: "high" }],
        material_estimates: [],
        cost_suggestions: { mid: 300 },
      },
      confidence: 0.77,
    });
    expect(model.category).toBe("Bath");
    expect(model.condition_report).toBe("Poor");
    expect(model.detected_defects).toEqual([{ description: "Mould", severity: "high" }]);
    expect(model.cost_suggestions).toEqual({ mid: 300 });
    expect(model.confidence_score).toBe(0.77);
    expect(model.source).toBe("ai");
    expect(model.user_id).toBe("u1");
  });

  it("falls back to legacy flat columns when analysis_data absent", () => {
    const model = mapPhotoAnalysisRow({
      id: "a2",
      project_id: "p1",
      photo_id: null,
      created_at: "t0",
      updated_at: "t1",
      category: "Kitchen",
      condition_report: "Fair",
      detected_defects: [{ description: "Crack", severity: "low" }],
      material_estimates: [{ name: "Grout", quantity: 1, unit: "kg" }],
      cost_suggestions: { mid: 100 },
      confidence_score: 0.9,
    });
    expect(model.category).toBe("Kitchen");
    expect(model.detected_defects[0]?.description).toBe("Crack");
    expect(model.material_estimates[0]?.name).toBe("Grout");
    expect(model.confidence_score).toBe(0.9);
  });

  it("maps multiple rows independently", () => {
    const rows = [
      mapPhotoAnalysisRow({
        id: "1",
        project_id: "p",
        created_at: "a",
        updated_at: "b",
        analysis_data: { category: "A", detected_defects: [], material_estimates: [] },
        confidence: 0.1,
      }),
      mapPhotoAnalysisRow({
        id: "2",
        project_id: "p",
        created_at: "a",
        updated_at: "b",
        analysis_data: {
          category: "B",
          detected_defects: [{ description: "X" }],
          material_estimates: [],
        },
        confidence: 0.9,
      }),
    ];
    expect(rows.map((r) => r.category)).toEqual(["A", "B"]);
    expect(rows[1]?.detected_defects).toHaveLength(1);
  });

  it("does not leak raw Json types on domain fields", () => {
    const model = createPhotoAnalysisAppModel({
      detected_defects: [{ description: "Y" }],
      material_estimates: [{ name: "Z", quantity: 1, unit: "ea" }],
    });
    expect(Array.isArray(model.detected_defects)).toBe(true);
    expect(typeof model.detected_defects[0]?.description).toBe("string");
    expect(typeof model.material_estimates[0]?.name).toBe("string");
  });
});
