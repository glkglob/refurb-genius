import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONDITION_LEVELS } from "@repo/types";
import {
  CONDITION_MULTIPLIERS,
  FINISH_MULTIPLIERS,
  REGION_MULTIPLIERS,
} from "../../../../packages/core/src/utilities/pricingData";
import { runPricingEngine, type PricingEngineInputs } from "../domain";
import { compareConditionLevels } from "./compareConditionLevels";

const BASE_INPUTS: PricingEngineInputs = {
  region: "West Midlands",
  property_condition: "Dated",
  finish_quality: "Standard",
  selected_categories: ["Kitchen", "Bathroom", "Flooring", "Painting", "Electrical"],
  property_size_sqm: 90,
};

function expectedCombinedMultiplier(inputs: PricingEngineInputs): number {
  const size = Math.min(1.8, Math.max(0.7, inputs.property_size_sqm / 90));
  return (
    REGION_MULTIPLIERS[inputs.region] *
    CONDITION_MULTIPLIERS[inputs.property_condition] *
    FINISH_MULTIPLIERS[inputs.finish_quality] *
    size
  );
}

describe("compareConditionLevels", () => {
  it("returns one row per canonical ConditionLevel", () => {
    const rows = compareConditionLevels(BASE_INPUTS);
    expect(rows.map((r) => r.condition)).toEqual([...CONDITION_LEVELS]);
    expect(rows).toHaveLength(CONDITION_LEVELS.length);
  });

  it("varies only property_condition; every other input is identical", () => {
    const rows = compareConditionLevels(BASE_INPUTS);
    for (const row of rows) {
      expect(row.pricing.inputs.region).toBe(BASE_INPUTS.region);
      expect(row.pricing.inputs.finish_quality).toBe(BASE_INPUTS.finish_quality);
      expect(row.pricing.inputs.selected_categories).toEqual(BASE_INPUTS.selected_categories);
      expect(row.pricing.inputs.property_size_sqm).toBe(BASE_INPUTS.property_size_sqm);
      expect(row.pricing.inputs.property_condition).toBe(row.condition);
    }
  });

  it("marks only the selected condition and leaves the working inputs unchanged", () => {
    const inputs: PricingEngineInputs = { ...BASE_INPUTS, property_condition: "Poor" };
    const snapshot = structuredClone(inputs);
    const rows = compareConditionLevels(inputs);
    expect(inputs).toEqual(snapshot);
    expect(rows.filter((r) => r.selected)).toHaveLength(1);
    expect(rows.find((r) => r.selected)?.condition).toBe("Poor");
  });

  it("uses runPricingEngine: selected row equals a direct engine call", () => {
    const inputs: PricingEngineInputs = {
      ...BASE_INPUTS,
      region: "London",
      property_condition: "Average",
      finish_quality: "Premium",
      property_size_sqm: 120,
    };
    const rows = compareConditionLevels(inputs);
    const selected = rows.find((r) => r.selected);
    expect(selected).toBeDefined();
    expect(selected!.pricing).toEqual(runPricingEngine(inputs));
  });

  it("Dated row equals the canonical Dated engine result for the same inputs", () => {
    const inputs: PricingEngineInputs = { ...BASE_INPUTS, property_condition: "Dated" };
    const rows = compareConditionLevels(inputs);
    const dated = rows.find((r) => r.condition === "Dated");
    expect(dated).toBeDefined();
    expect(dated!.selected).toBe(true);
    expect(dated!.pricing).toEqual(runPricingEngine(inputs));
    expect(dated!.pricing.mid_total).toBe(runPricingEngine(inputs).mid_total);
  });

  it("Dated compare equals Quick Dated even when another condition is selected", () => {
    const selectedInputs: PricingEngineInputs = { ...BASE_INPUTS, property_condition: "Modern" };
    const datedInputs: PricingEngineInputs = { ...BASE_INPUTS, property_condition: "Dated" };
    const dated = compareConditionLevels(selectedInputs).find((r) => r.condition === "Dated");
    expect(dated!.pricing).toEqual(runPricingEngine(datedInputs));
  });

  it("each ConditionLevel uses the canonical condition multiplier via the engine", () => {
    const rows = compareConditionLevels(BASE_INPUTS);
    for (const row of rows) {
      const expected = expectedCombinedMultiplier({
        ...BASE_INPUTS,
        property_condition: row.condition,
      });
      expect(row.pricing.multiplier).toBe(+expected.toFixed(3));
    }
    expect(CONDITION_MULTIPLIERS.Modern).toBe(0.6);
    expect(CONDITION_MULTIPLIERS.Average).toBe(0.85);
    expect(CONDITION_MULTIPLIERS.Dated).toBe(1.0);
    expect(CONDITION_MULTIPLIERS.Poor).toBe(1.25);
    expect(CONDITION_MULTIPLIERS["Full Renovation Needed"]).toBe(1.5);
  });

  it("is a pure function: no persistence, no authority, no other engines", () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "compareConditionLevels.ts"),
      "utf8",
    );
    expect(source).toContain("runPricingEngine");
    expect(source).not.toMatch(/TRADE_RATES|trade-rates|tradeRates/i);
    expect(source).not.toMatch(/DEFAULT_COST_LIBRARY|cost-library|costLibrary/i);
    expect(source).not.toMatch(/enhanced|new-build|measuredBoq|measured-boq/i);
    expect(source).not.toMatch(/refurbishment_level|supabase|saveAuthority|runRoiEngine/i);
    expect(source).not.toMatch(/CONDITION_MULTIPLIERS|CATEGORY_BASE|REGION_MULTIPLIERS/);
  });
});
