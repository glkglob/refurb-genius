/**
 * Pricing engine invariant tests.
 * Verifies the full PricingEngineResult contract independently of ROI authority tests.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { runPricingEngine, type PricingEngineInputs } from "@repo/services";

// Guard against schema drift for projects table columns (e.g. bathrooms).
// The generated types in src/integrations/supabase/types.ts are the source of truth
// for what columns the DB + PostgREST expose. If a migration drops a column
// that the New Project form / serverFn / mappers expect, referencing it here
// will make `pnpm typecheck` (part of pre-commit) fail.
import type { Tables } from "@/integrations/supabase/types";

const BASE_INPUT: PricingEngineInputs = {
  region: "London",
  property_condition: "Average",
  finish_quality: "Standard",
  selected_categories: ["Kitchen", "Bathroom", "Flooring"],
  property_size_sqm: 90,
};

const EMPTY_INPUT: PricingEngineInputs = {
  region: "London",
  property_condition: "Average",
  finish_quality: "Standard",
  selected_categories: [],
  property_size_sqm: 90,
};

test("pricing result contains all required contract fields", () => {
  const result = runPricingEngine(BASE_INPUT);

  assert.ok("mid_total" in result, "mid_total must be present");
  assert.ok("low_total" in result, "low_total must be present");
  assert.ok("high_total" in result, "high_total must be present");
  assert.ok("lineItems" in result, "lineItems must be present");
  assert.ok("confidence" in result, "confidence must be present");
  assert.ok("assumptions" in result, "assumptions must be present");
  assert.ok("warnings" in result, "warnings must be present");
});

test("low_total <= mid_total <= high_total", () => {
  const result = runPricingEngine(BASE_INPUT);

  assert.ok(
    result.low_total <= result.mid_total,
    `low_total (${result.low_total}) must be <= mid_total (${result.mid_total})`,
  );
  assert.ok(
    result.mid_total <= result.high_total,
    `mid_total (${result.mid_total}) must be <= high_total (${result.high_total})`,
  );
});

test("mid_total is numeric, finite, and non-negative", () => {
  const result = runPricingEngine(BASE_INPUT);

  assert.equal(typeof result.mid_total, "number", "mid_total must be a number");
  assert.equal(Number.isFinite(result.mid_total), true, "mid_total must be finite");
  assert.ok(result.mid_total >= 0, "mid_total must be non-negative");
});

test("mid_total is positive when categories are provided", () => {
  const result = runPricingEngine(BASE_INPUT);

  assert.ok(result.mid_total > 0, "mid_total must be > 0 when categories are selected");
});

test("empty categories produce zero totals", () => {
  const result = runPricingEngine(EMPTY_INPUT);

  assert.equal(result.mid_total, 0, "mid_total must be 0 when no categories selected");
  assert.equal(result.low_total, 0, "low_total must be 0 when no categories selected");
  assert.equal(result.high_total, 0, "high_total must be 0 when no categories selected");
  assert.deepEqual(result.lineItems, [], "lineItems must be empty when no categories selected");
});

test("lineItems array is valid", () => {
  const result = runPricingEngine(BASE_INPUT);

  assert.ok(Array.isArray(result.lineItems), "lineItems must be an array");
  assert.ok(result.lineItems.length > 0, "lineItems must be non-empty when categories selected");

  for (const item of result.lineItems) {
    assert.equal(typeof item.category, "string", "lineItem.category must be a string");
    assert.equal(typeof item.labour, "number", "lineItem.labour must be a number");
    assert.equal(typeof item.materials, "number", "lineItem.materials must be a number");
    assert.ok(Number.isFinite(item.labour), `lineItem.labour must be finite: ${item.category}`);
    assert.ok(
      Number.isFinite(item.materials),
      `lineItem.materials must be finite: ${item.category}`,
    );
  }
});

test("confidence is one of the allowed literal values", () => {
  const allowed = ["low", "medium", "high"] as const;
  const empty = runPricingEngine(EMPTY_INPUT);
  const full = runPricingEngine(BASE_INPUT);

  assert.ok(
    allowed.includes(empty.confidence as (typeof allowed)[number]),
    `empty confidence "${empty.confidence}" must be low | medium | high`,
  );
  assert.ok(
    allowed.includes(full.confidence as (typeof allowed)[number]),
    `full confidence "${full.confidence}" must be low | medium | high`,
  );
  assert.equal(empty.confidence, "low", "0 categories must produce confidence=low");
});

test("assumptions and warnings are string arrays", () => {
  const result = runPricingEngine(BASE_INPUT);

  assert.ok(Array.isArray(result.assumptions), "assumptions must be an array");
  assert.ok(Array.isArray(result.warnings), "warnings must be an array");

  for (const a of result.assumptions) {
    assert.equal(typeof a, "string", "every assumption must be a string");
  }
  for (const w of result.warnings) {
    assert.equal(typeof w, "string", "every warning must be a string");
  }
});

test("pricing is deterministic for identical inputs", () => {
  const a = runPricingEngine(BASE_INPUT);
  const b = runPricingEngine({ ...BASE_INPUT });

  assert.deepEqual(a, b, "runPricingEngine must be deterministic for identical inputs");
});

test("ROI does not use fallback values — mid_total is always the authoritative cost", () => {
  // This is the structural invariant: mid_total must be defined and usable.
  // The full authority check (ROI.refurb_budget === pricing.mid_total) lives in
  // pricing-authority.test.ts. Here we just confirm mid_total is never undefined/NaN.
  const result = runPricingEngine(BASE_INPUT);

  assert.notEqual(result.mid_total, undefined, "mid_total must never be undefined");
  assert.notEqual(result.mid_total, null, "mid_total must never be null");
  assert.ok(!Number.isNaN(result.mid_total), "mid_total must never be NaN");
});

test("projects table in generated Supabase types includes critical columns (prevent schema drift)", () => {
  // Referencing these ensures that if the columns are removed from
  // src/integrations/supabase/types.ts (i.e. the DB schema no longer has them),
  // typecheck will fail this invariant test during pre-commit.
  // Matches the columns the New Project form, serverFn insert, mappers,
  // and initial migration (plus our add-if-not-exists migration) expect.
  type ProjectRow = Tables<"projects">;

  // These type assertions (keyof) will fail at compile time (during `pnpm typecheck`)
  // if the column was removed from the generated types (i.e. DB schema drift vs migration).
  const _baths: keyof ProjectRow = "bathrooms";
  const _beds: keyof ProjectRow = "bedrooms";
  const _size: keyof ProjectRow = "size_sqm";
  const _ptype: keyof ProjectRow = "property_type";
  const _price: keyof ProjectRow = "purchase_price";
  const _gdv: keyof ProjectRow = "estimated_gdv";

  assert.ok(true, "projects schema has critical columns (see migration 20260525120000)");
});
