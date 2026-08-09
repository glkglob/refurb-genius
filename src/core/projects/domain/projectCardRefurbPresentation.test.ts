/**
 * PUBLIC-BETA-R1 — card refurb presentation must not invent Estimate totals.
 */
import { describe, it, expect } from "vitest";
import type { Project } from "./types";
import { projectCardRefurbPresentation } from "./projectCardRefurbPresentation";
import { estimatedRefurbCost } from "./helpers";

const base = {
  id: "p1",
  name: "Name only",
  region: "London",
  status: "active",
  purchase_price: 0,
  estimated_gdv: 0,
  size_sqm: 0,
  bedrooms: 0,
  bathrooms: 0,
  address: "",
  postcode: "",
  property_type: "Terraced",
  photos_done: false,
  analysis_done: false,
  estimate_done: false,
  report_done: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_id: "u1",
} as unknown as Project;

describe("projectCardRefurbPresentation", () => {
  it("name-only / zero GDV does not yield a bare zero-refurb amount mode", () => {
    const view = projectCardRefurbPresentation(base);
    expect(view.mode).toBe("no_estimate");
    expect(view.label).toBe("No estimate yet");
    expect(view.label).not.toMatch(/£0/);
    expect(view.label.toLowerCase()).not.toMatch(/^£/);
    // Legacy helper would produce 0 — cards must not use that as Estimate display.
    expect(estimatedRefurbCost(base)).toBe(0);
  });

  it("non-zero GDV placeholder is not presented as a current Estimate amount", () => {
    const withGdv = { ...base, estimated_gdv: 350_000 } as Project;
    const view = projectCardRefurbPresentation(withGdv);
    expect(view.mode).toBe("no_estimate");
    expect(view.label).toBe("No estimate yet");
    // Legacy 15% GDV would be 52500 — must not appear in card presentation label.
    expect(estimatedRefurbCost(withGdv)).toBe(52_500);
    expect(view.label).not.toMatch(/52[,.]?500/);
    expect(view.label).not.toMatch(/£/);
  });
});
