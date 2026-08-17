import { describe, expect, it } from "vitest";
import { resolveProjectPricingRegion } from "@repo/services";

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
  });

  it("existing London postcode projects remain London", () => {
    const resolved = resolveProjectPricingRegion({
      postcode: "E1 6AN",
      explicitRegion: "London",
    });
    expect(resolved).toEqual({ ok: true, region: "London", source: "postcode" });
  });
});
