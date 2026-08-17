import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONDITION_LEVELS } from "@repo/types";
import { runPricingEngine, type PricingEngineInputs } from "../domain";
import { compareConditionLevels } from "./compareConditionLevels";

const BASE_INPUTS: PricingEngineInputs = {
  region: "West Midlands",
  property_condition: "Dated",
  finish_quality: "Standard",
  selected_categories: ["Kitchen", "Bathroom", "Flooring", "Painting", "Electrical"],
  property_size_sqm: 90,
};

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

  it("does not mutate the caller inputs object or its categories array", () => {
    const categories = [...BASE_INPUTS.selected_categories];
    const inputs: PricingEngineInputs = { ...BASE_INPUTS, selected_categories: categories };
    const objectSnapshot = { ...inputs };
    const categoriesSnapshot = [...categories];
    compareConditionLevels(inputs);
    expect(inputs).toEqual(objectSnapshot);
    expect(inputs.selected_categories).toBe(categories);
    expect(categories).toEqual(categoriesSnapshot);
  });

  it("marks only the selected condition", () => {
    const inputs: PricingEngineInputs = { ...BASE_INPUTS, property_condition: "Poor" };
    const rows = compareConditionLevels(inputs);
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

  it("Dated compare equals Quick Dated even when another condition is selected", () => {
    const selectedInputs: PricingEngineInputs = { ...BASE_INPUTS, property_condition: "Modern" };
    const datedInputs: PricingEngineInputs = { ...BASE_INPUTS, property_condition: "Dated" };
    const dated = compareConditionLevels(selectedInputs).find((r) => r.condition === "Dated");
    expect(dated!.pricing).toEqual(runPricingEngine(datedInputs));
  });

  it("Case A: London / Dated / Standard / 90 m2 matches Test 5 and the engine", () => {
    const inputs: PricingEngineInputs = {
      region: "London",
      property_condition: "Dated",
      finish_quality: "Standard",
      selected_categories: ["Kitchen", "Bathroom", "Flooring", "Painting", "Electrical"],
      property_size_sqm: 90,
    };
    const selected = compareConditionLevels(inputs).find((r) => r.selected);
    expect(selected!.pricing).toEqual(runPricingEngine(inputs));
    expect(selected!.pricing.mid_total).toBe(63492);
    expect(selected!.pricing.low_total).toBe(53968);
    expect(selected!.pricing.high_total).toBe(73016);
    expect(selected!.pricing.labour_total).toBe(21060);
    expect(selected!.pricing.materials_total).toBe(27040);
    expect(selected!.pricing.contingency).toBe(4810);
    expect(selected!.pricing.vat).toBe(10582);
    expect(selected!.pricing.multiplier).toBe(1.3);
  });

  it("Case B: West Midlands / Modern / Budget / 50 m2 matches Test 5 and the engine", () => {
    const inputs: PricingEngineInputs = {
      region: "West Midlands",
      property_condition: "Modern",
      finish_quality: "Budget",
      selected_categories: ["Kitchen", "Bathroom", "Flooring", "Painting", "Electrical"],
      property_size_sqm: 50,
    };
    const selected = compareConditionLevels(inputs).find((r) => r.selected);
    expect(selected!.pricing).toEqual(runPricingEngine(inputs));
    expect(selected!.pricing.mid_total).toBe(16421);
    expect(selected!.pricing.low_total).toBe(13958);
    expect(selected!.pricing.high_total).toBe(18884);
    expect(selected!.pricing.labour_total).toBe(5450);
    expect(selected!.pricing.materials_total).toBe(6990);
    expect(selected!.pricing.contingency).toBe(1244);
    expect(selected!.pricing.vat).toBe(2737);
    expect(selected!.pricing.multiplier).toBe(0.336);
  });

  it("Case C: Scotland / Poor / Premium / 150 m2 matches Test 5 and the engine", () => {
    const inputs: PricingEngineInputs = {
      region: "Scotland",
      property_condition: "Poor",
      finish_quality: "Premium",
      selected_categories: ["Kitchen", "Bathroom", "Flooring", "Painting", "Electrical"],
      property_size_sqm: 150,
    };
    const selected = compareConditionLevels(inputs).find((r) => r.selected);
    expect(selected!.pricing).toEqual(runPricingEngine(inputs));
    expect(selected!.pricing.mid_total).toBe(130495);
    expect(selected!.pricing.low_total).toBe(110921);
    expect(selected!.pricing.high_total).toBe(150069);
    expect(selected!.pricing.labour_total).toBe(43280);
    expect(selected!.pricing.materials_total).toBe(55580);
    expect(selected!.pricing.contingency).toBe(9886);
    expect(selected!.pricing.vat).toBe(21749);
    expect(selected!.pricing.multiplier).toBe(2.672);
  });

  it("empty categories: selected row equals the engine (zero mid)", () => {
    const inputs: PricingEngineInputs = { ...BASE_INPUTS, selected_categories: [] };
    const selected = compareConditionLevels(inputs).find((r) => r.selected);
    expect(selected!.pricing).toEqual(runPricingEngine(inputs));
    expect(selected!.pricing.mid_total).toBe(0);
  });

  it("size 0, 1, and 10000: selected row equals the engine", () => {
    for (const property_size_sqm of [0, 1, 10000]) {
      const inputs: PricingEngineInputs = { ...BASE_INPUTS, property_size_sqm };
      const selected = compareConditionLevels(inputs).find((r) => r.selected);
      expect(selected!.pricing).toEqual(runPricingEngine(inputs));
    }
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
