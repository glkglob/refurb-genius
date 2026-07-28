/**
 * AO-1G1 — pure buildEstimateBuilderSaveInput contract.
 */
import { describe, it, expect } from "vitest";
import { buildEstimateBuilderSaveInput } from "./buildEstimateBuilderSaveInput";

describe("buildEstimateBuilderSaveInput", () => {
  const base = {
    projectId: "proj-1",
    projectName: "Acme House",
    region: "London",
    rooms: [
      {
        name: "Kitchen",
        area_sqm: 12,
        items: [
          {
            name: "Cabinets",
            category: "Kitchen",
            quantity: 2,
            unit: "set",
            unit_cost: 100,
            notes: "oak",
          },
        ],
      },
    ],
    subtotal: 200,
    vat: 44,
    total: 264,
  };

  it("maps header fields and constants exactly", () => {
    const out = buildEstimateBuilderSaveInput(base);
    expect(out.projectId).toBe("proj-1");
    expect(out.title).toBe("Acme House Refurbishment Estimate");
    expect(out.region).toBe("London");
    expect(out.subtotal).toBe(200);
    expect(out.vat_rate).toBe(20);
    expect(out.vat_amount).toBe(44);
    expect(out.total).toBe(264);
    expect(out.notes).toBe("Manual estimate built with drag & drop builder");
  });

  it("uses Property fallback when projectName is empty/null/undefined", () => {
    expect(buildEstimateBuilderSaveInput({ ...base, projectName: null }).title).toBe(
      "Property Refurbishment Estimate",
    );
    expect(buildEstimateBuilderSaveInput({ ...base, projectName: undefined }).title).toBe(
      "Property Refurbishment Estimate",
    );
    expect(buildEstimateBuilderSaveInput({ ...base, projectName: "" }).title).toBe(
      "Property Refurbishment Estimate",
    );
  });

  it("maps rooms and items with unit_cost → base_unit_cost and total_cost", () => {
    const out = buildEstimateBuilderSaveInput(base);
    expect(out.rooms).toHaveLength(1);
    expect(out.rooms[0]).toMatchObject({
      name: "Kitchen",
      area_sqm: 12,
    });
    expect(out.rooms[0]!.items).toEqual([
      {
        name: "Cabinets",
        category: "Kitchen",
        quantity: 2,
        unit: "set",
        base_unit_cost: 100,
        unit_cost: 100,
        total_cost: 200,
        notes: "oak",
        labour: 0,
        materials: 0,
        weeks: 0,
        is_ai_suggested: false,
      },
    ]);
  });

  it("is pure — same input yields equal output", () => {
    const a = buildEstimateBuilderSaveInput(base);
    const b = buildEstimateBuilderSaveInput(base);
    expect(a).toEqual(b);
  });
});
