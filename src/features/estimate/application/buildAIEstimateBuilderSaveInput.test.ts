/**
 * AO-1L1 — pure buildAIEstimateBuilderSaveInput contract.
 */
import { describe, it, expect } from "vitest";
import { calculateLineItem } from "@/core/pricing";
import { buildAIEstimateBuilderSaveInput } from "./buildAIEstimateBuilderSaveInput";

describe("buildAIEstimateBuilderSaveInput", () => {
  const base = {
    projectId: "proj-1",
    propertyType: "Terraced",
    bedrooms: 3,
    region: "London",
    rooms: [
      {
        name: "Kitchen",
        area_sqm: 12,
        items: [
          {
            name: "Cabinets",
            category: "both",
            quantity: 2,
            unit: "set",
            base_unit_cost: 100,
            notes: "oak",
            is_ai_suggested: true,
          },
          {
            name: "Tiling",
            category: "materials",
            quantity: 1,
            unit: "lot",
            base_unit_cost: 50,
            is_ai_suggested: false,
          },
        ],
      },
      {
        name: "Bath",
        items: [
          {
            name: "Suite",
            category: "both",
            quantity: 1,
            unit: "set",
            base_unit_cost: 200,
          },
        ],
      },
    ],
    notes: "  ",
    multiplier: 1.25,
    totals: {
      subtotal: 1000,
      vat_amount: 200,
      total: 1200,
    },
  };

  it("maps header fields and constants exactly", () => {
    const out = buildAIEstimateBuilderSaveInput({ ...base, notes: "Site notes" });
    expect(out.projectId).toBe("proj-1");
    expect(out.title).toBe("AI Estimate — Terraced, 3 bed");
    expect(out.region).toBe("London");
    expect(out.subtotal).toBe(1000);
    expect(out.vat_rate).toBe(20);
    expect(out.vat_amount).toBe(200);
    expect(out.total).toBe(1200);
    expect(out.notes).toBe("Site notes");
  });

  it("treats empty notes as undefined", () => {
    expect(buildAIEstimateBuilderSaveInput({ ...base, notes: "" }).notes).toBeUndefined();
  });

  it("preserves room and item order, names, and area", () => {
    const out = buildAIEstimateBuilderSaveInput(base);
    expect(out.rooms.map((r) => r.name)).toEqual(["Kitchen", "Bath"]);
    expect(out.rooms[0]!.area_sqm).toBe(12);
    expect(out.rooms[0]!.items.map((i) => i.name)).toEqual(["Cabinets", "Tiling"]);
    expect(out.rooms[1]!.items.map((i) => i.name)).toEqual(["Suite"]);
  });

  it("applies regional multiplier via calculateLineItem", () => {
    const out = buildAIEstimateBuilderSaveInput(base);
    const expected = calculateLineItem(base.rooms[0]!.items[0]!, 1.25);
    expect(out.rooms[0]!.items[0]).toEqual(expected);
    expect(out.rooms[0]!.items[0]!.unit_cost).toBe(125);
    expect(out.rooms[0]!.items[0]!.total_cost).toBe(250);
  });

  it("does not introduce unsupported top-level fields", () => {
    const out = buildAIEstimateBuilderSaveInput(base) as Record<string, unknown>;
    expect(Object.keys(out).sort()).toEqual(
      [
        "notes",
        "projectId",
        "region",
        "rooms",
        "subtotal",
        "title",
        "total",
        "vat_amount",
        "vat_rate",
      ].sort(),
    );
  });
});
