import { describe, expect, it } from "vitest";
import { getRegionalMultiplier, resolveProjectPricingRegion } from "@repo/services";

describe("project / Quick Estimate region seed", () => {
  it("BS16 2EG stored as London still seeds South West England", () => {
    const resolved = resolveProjectPricingRegion({
      postcode: "BS16 2EG",
      explicitRegion: "London",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.region).toBe("South West England");
    expect(resolved.region).not.toBe("London");
    expect(getRegionalMultiplier(resolved.region)).toBe(1.08);
  });

  it("existing London postcode projects remain London", () => {
    const resolved = resolveProjectPricingRegion({
      postcode: "E1 6AN",
      explicitRegion: "London",
    });
    expect(resolved).toEqual({ ok: true, region: "London", source: "postcode" });
  });

  it("legacy missing postcode + stored valid region remains usable", () => {
    expect(
      resolveProjectPricingRegion({
        postcode: "",
        explicitRegion: "Scotland",
      }),
    ).toEqual({ ok: true, region: "Scotland", source: "explicit" });
  });

  it("Quick Estimate does not inherit stale stored London when postcode maps elsewhere", () => {
    const seeded = resolveProjectPricingRegion({
      postcode: "BS16 2EG",
      explicitRegion: "London",
    });
    expect(seeded).toEqual({
      ok: true,
      region: "South West England",
      source: "postcode",
    });
    expect(getRegionalMultiplier("South West England")).toBe(1.08);
    expect(getRegionalMultiplier("London")).toBe(1.3);
  });
});
