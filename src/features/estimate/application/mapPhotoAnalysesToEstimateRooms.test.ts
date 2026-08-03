/**
 * AO-1C2 — mapPhotoAnalysesToEstimateRooms pure mapping contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PhotoAnalysisResultRow } from "@/lib/queries/photo-analysis";
import { createPhotoAnalysisAppModel } from "@repo/types";
import { mapPhotoAnalysesToEstimateRooms } from "./mapPhotoAnalysesToEstimateRooms";

function analysis(
  id: string,
  overrides: Partial<PhotoAnalysisResultRow> = {},
): PhotoAnalysisResultRow {
  return createPhotoAnalysisAppModel({
    id,
    project_id: "proj-1",
    photo_id: `photo-${id}`,
    category: "Kitchen",
    condition_report: null,
    detected_defects: [],
    material_estimates: [],
    cost_suggestions: null,
    confidence_score: 0.8,
    ...overrides,
  });
}

describe("mapPhotoAnalysesToEstimateRooms", () => {
  let uuidSeq = 0;

  beforeEach(() => {
    uuidSeq = 0;
    vi.spyOn(crypto, "randomUUID").mockImplementation(
      () => `uuid-${++uuidSeq}` as `${string}-${string}-${string}-${string}-${string}`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array for empty analyses", () => {
    expect(mapPhotoAnalysesToEstimateRooms([])).toEqual([]);
    expect(crypto.randomUUID).not.toHaveBeenCalled();
  });

  it("creates one room from one analysis with exact defect and material items", () => {
    const row = analysis("a1", {
      category: "Kitchen",
      confidence_score: 0.9,
      detected_defects: [{ description: "Crack", severity: "low", estimated_cost: 200 }],
      material_estimates: [{ name: "Tile", quantity: 3, unit: "m2", cost_per_unit: 12 }],
      cost_suggestions: { mid: 500 },
    });

    const rooms = mapPhotoAnalysesToEstimateRooms([row]);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toEqual({
      id: "uuid-1",
      name: "Kitchen",
      items: [
        {
          id: "sugg-a1-0",
          name: "Crack",
          category: "Kitchen",
          quantity: 1,
          unit: "item",
          unit_cost: 200,
          notes: "From AI photo analysis (conf 90%)",
        },
        {
          id: "sugg-mat-a1-0",
          name: "Tile",
          category: "Kitchen",
          quantity: 3,
          unit: "m2",
          unit_cost: 12,
          notes: "AI material estimate",
        },
      ],
    });
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("uses General / Unspecified when category is missing", () => {
    const rooms = mapPhotoAnalysesToEstimateRooms([
      analysis("a1", {
        category: null,
        detected_defects: [{ description: "Drip", severity: "low" }],
      }),
    ]);
    expect(rooms[0]?.name).toBe("General / Unspecified");
  });

  it("groups same room names within one apply and preserves first-seen order", () => {
    const rooms = mapPhotoAnalysesToEstimateRooms([
      analysis("a1", {
        category: "Kitchen",
        detected_defects: [{ description: "A", severity: "low" }],
      }),
      analysis("a2", {
        category: "Bath",
        detected_defects: [{ description: "B", severity: "low" }],
      }),
      analysis("a3", {
        category: "Kitchen",
        detected_defects: [{ description: "C", severity: "low" }],
      }),
    ]);

    expect(rooms.map((r) => r.name)).toEqual(["Kitchen", "Bath"]);
    expect(rooms[0]?.items.map((i) => i.name)).toEqual(["A", "C"]);
    expect(rooms[1]?.items.map((i) => i.name)).toEqual(["B"]);
    expect(crypto.randomUUID).toHaveBeenCalledTimes(2);
  });

  it("preserves analysis input order for room first-seen sequence", () => {
    const rooms = mapPhotoAnalysesToEstimateRooms([
      analysis("z", { category: "Z-room", detected_defects: [{ description: "z" }] }),
      analysis("a", { category: "A-room", detected_defects: [{ description: "a" }] }),
    ]);
    expect(rooms.map((r) => r.name)).toEqual(["Z-room", "A-room"]);
  });

  it("puts defects before materials for the same analysis", () => {
    const rooms = mapPhotoAnalysesToEstimateRooms([
      analysis("a1", {
        detected_defects: [{ description: "Defect" }],
        material_estimates: [{ name: "Mat", quantity: 1, unit: "ea" }],
      }),
    ]);
    expect(rooms[0]?.items.map((i) => i.id)).toEqual(["sugg-a1-0", "sugg-mat-a1-0"]);
  });

  it("applies defect cost precedence: estimated_cost, then mid/10, then 150", () => {
    const withEstimated = mapPhotoAnalysesToEstimateRooms([
      analysis("a1", {
        detected_defects: [{ description: "D", estimated_cost: 99 }],
        cost_suggestions: { mid: 1000 },
      }),
    ]);
    expect(withEstimated[0]?.items[0]?.unit_cost).toBe(99);

    const withMid = mapPhotoAnalysesToEstimateRooms([
      analysis("a2", {
        category: "X",
        detected_defects: [{ description: "D" }],
        cost_suggestions: { mid: 555 },
      }),
    ]);
    expect(withMid[0]?.items[0]?.unit_cost).toBe(Math.round(555 / 10));

    const withDefault = mapPhotoAnalysesToEstimateRooms([
      analysis("a3", {
        category: "Y",
        detected_defects: [{ description: "D" }],
        cost_suggestions: null,
      }),
    ]);
    expect(withDefault[0]?.items[0]?.unit_cost).toBe(150);
  });

  it("applies material quantity and cost fallbacks", () => {
    const rooms = mapPhotoAnalysesToEstimateRooms([
      analysis("a1", {
        category: null,
        material_estimates: [{ name: "Pipe", quantity: 0, unit: "", cost_per_unit: 0 }],
      }),
    ]);
    // quantity: 0 || 1 → 1; unit: "" || "item"; cost: 0 || 50 → 50; category: Materials
    expect(rooms[0]?.items[0]).toMatchObject({
      id: "sugg-mat-a1-0",
      quantity: 1,
      unit: "item",
      unit_cost: 50,
      category: "Materials",
      notes: "AI material estimate",
    });
  });

  it("uses defect category then analysis category then General", () => {
    const rooms = mapPhotoAnalysesToEstimateRooms([
      analysis("a1", {
        category: "Kitchen",
        detected_defects: [{ description: "D1", category: "Plumbing" }, { description: "D2" }],
      }),
    ]);
    expect(rooms[0]?.items[0]?.category).toBe("Plumbing");
    expect(rooms[0]?.items[1]?.category).toBe("Kitchen");

    const noCat = mapPhotoAnalysesToEstimateRooms([
      analysis("a2", {
        category: null,
        detected_defects: [{ description: "D" }],
      }),
    ]);
    expect(noCat[0]?.items[0]?.category).toBe("General");
  });

  it("confidence note uses confidence_score || 0.8 (0 falls through)", () => {
    const withZero = mapPhotoAnalysesToEstimateRooms([
      analysis("a1", {
        confidence_score: 0,
        detected_defects: [{ description: "D" }],
      }),
    ]);
    // 0 || 0.8 → 0.8 → 80%
    expect(withZero[0]?.items[0]?.notes).toBe("From AI photo analysis (conf 80%)");

    const withNull = mapPhotoAnalysesToEstimateRooms([
      analysis("a2", {
        confidence_score: null,
        detected_defects: [{ description: "D" }],
      }),
    ]);
    expect(withNull[0]?.items[0]?.notes).toBe("From AI photo analysis (conf 80%)");
  });

  it("duplicate analyses create duplicate items and does not mutate input", () => {
    const row = analysis("a1", {
      detected_defects: [{ description: "Crack", severity: "low" }],
    });
    const input = [row, row];
    const snapshot = structuredClone(input);

    const rooms = mapPhotoAnalysesToEstimateRooms(input);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.items).toHaveLength(2);
    expect(rooms[0]?.items.map((i) => i.id)).toEqual(["sugg-a1-0", "sugg-a1-0"]);
    expect(input).toEqual(snapshot);
  });
});
