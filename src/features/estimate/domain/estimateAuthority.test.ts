import { describe, expect, it } from "vitest";
import {
  isAuthoritativePricingAuthority,
  selectCurrentAuthorityEstimateRow,
} from "./estimateAuthority";

describe("estimateAuthority (IA-5-R2)", () => {
  it("classifies authoritative pricing markers", () => {
    expect(isAuthoritativePricingAuthority("category-engine")).toBe(true);
    expect(isAuthoritativePricingAuthority("measured-boq-engine")).toBe(true);
    expect(isAuthoritativePricingAuthority("none")).toBe(false);
    expect(isAuthoritativePricingAuthority(null)).toBe(false);
  });

  it("selects valid E1 over newer draft", () => {
    const e1 = {
      id: "e1",
      pricing_authority: "category-engine",
      input_scope_id: "s1",
      created_at: "2026-08-08T10:00:00Z",
    };
    const draft = {
      id: "d1",
      pricing_authority: "none",
      input_scope_id: null,
      created_at: "2026-08-08T11:00:00Z",
    };
    expect(selectCurrentAuthorityEstimateRow([draft, e1], "s1")?.id).toBe("e1");
  });

  it("excludes stale-Scope authority rows", () => {
    const stale = {
      id: "e1",
      pricing_authority: "category-engine",
      input_scope_id: "s1",
      created_at: "2026-08-08T12:00:00Z",
    };
    expect(selectCurrentAuthorityEstimateRow([stale], "s2")).toBeNull();
  });

  it("picks latest among multiple valid on same Scope", () => {
    const e1 = {
      id: "e1",
      pricing_authority: "category-engine",
      input_scope_id: "s2",
      created_at: "2026-08-08T10:00:00Z",
    };
    const e2 = {
      id: "e2",
      pricing_authority: "measured-boq-engine",
      input_scope_id: "s2",
      created_at: "2026-08-08T11:00:00Z",
    };
    expect(selectCurrentAuthorityEstimateRow([e1, e2], "s2")?.id).toBe("e2");
  });
});
