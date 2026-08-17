import { describe, expect, it } from "vitest";
import { REGION_MULTIPLIERS } from "../pricing/pricingEngine";
import {
  NAME_ONLY_PLACEHOLDER_REGION,
  regionAfterPostcodeChange,
  requireProjectPricingRegion,
  resolveAuthoritativePricingRegion,
  resolveProjectPricingRegion,
  UNRESOLVED_POSTCODE_REGION_MESSAGE,
} from "./pricingRegionAuthority";

describe("resolveAuthoritativePricingRegion", () => {
  it("maps BS16 2EG to South West England and not London", () => {
    const r = resolveAuthoritativePricingRegion("BS16 2EG");
    expect(r).toEqual({
      status: "matched",
      area: "BS",
      region: "South West England",
    });
    expect(r.status === "matched" && r.region).not.toBe("London");
  });

  it.each([
    ["bs16 2eg", "South West England"],
    ["BS162EG", "South West England"],
    ["  BS16 2EG  ", "South West England"],
  ])("normalizes %s", (postcode, region) => {
    const r = resolveAuthoritativePricingRegion(postcode);
    expect(r.status).toBe("matched");
    if (r.status === "matched") expect(r.region).toBe(region);
  });

  it("maps a London postcode to London", () => {
    expect(resolveAuthoritativePricingRegion("E1 6AN")).toMatchObject({
      status: "matched",
      region: "London",
    });
    expect(resolveAuthoritativePricingRegion("SW1A 1AA")).toMatchObject({
      status: "matched",
      region: "London",
    });
  });

  it.each([
    ["TN1 1AA", "South East England"],
    ["CB1 1AA", "East of England"],
    ["NG1 1AA", "East Midlands"],
    ["CV1 2WT", "West Midlands"],
    ["M1 1AE", "North West England"],
    ["NE1 1AA", "North East England"],
    ["LS1 1AA", "Yorkshire and the Humber"],
    ["EH1 1YZ", "Scotland"],
    ["CF10 1AA", "Wales"],
    ["BT1 5GS", "Northern Ireland"],
    ["BS16 2EG", "South West England"],
    ["E1 6AN", "London"],
  ] as const)("maps %s to %s", (postcode, region) => {
    const r = resolveAuthoritativePricingRegion(postcode);
    expect(r.status).toBe("matched");
    if (r.status === "matched") expect(r.region).toBe(region);
  });

  it("treats missing postcode as missing, not London", () => {
    expect(resolveAuthoritativePricingRegion("")).toEqual({ status: "missing" });
    expect(resolveAuthoritativePricingRegion("   ")).toEqual({ status: "missing" });
    expect(resolveAuthoritativePricingRegion(null)).toEqual({ status: "missing" });
  });

  it("treats malformed postcode as invalid, not London", () => {
    expect(resolveAuthoritativePricingRegion("12345")).toEqual({ status: "invalid" });
  });

  it("treats unknown well-formed area as unknown, not London", () => {
    expect(resolveAuthoritativePricingRegion("ZZ1 1ZZ")).toEqual({
      status: "unknown",
      area: "ZZ",
    });
  });
});

describe("resolveProjectPricingRegion", () => {
  it("postcode is authoritative over a stored London region", () => {
    const r = resolveProjectPricingRegion({
      postcode: "BS16 2EG",
      explicitRegion: "London",
    });
    expect(r).toEqual({
      ok: true,
      region: "South West England",
      source: "postcode",
    });
  });

  it("keeps explicit London when postcode is missing", () => {
    expect(resolveProjectPricingRegion({ postcode: "", explicitRegion: "London" })).toEqual({
      ok: true,
      region: "London",
      source: "explicit",
    });
  });

  it("uses name-only placeholder London only when postcode and region are both missing", () => {
    expect(resolveProjectPricingRegion({ postcode: "", explicitRegion: "" })).toEqual({
      ok: true,
      region: NAME_ONLY_PLACEHOLDER_REGION,
      source: "name-only-placeholder",
    });
  });

  it("refuses unknown postcode without an explicit region", () => {
    expect(resolveProjectPricingRegion({ postcode: "ZZ1 1ZZ", explicitRegion: "" })).toEqual({
      ok: false,
      reason: "unresolved",
    });
  });

  it("keeps explicit region when postcode is unknown", () => {
    expect(
      resolveProjectPricingRegion({
        postcode: "ZZ1 1ZZ",
        explicitRegion: "West Midlands",
      }),
    ).toEqual({
      ok: true,
      region: "West Midlands",
      source: "explicit",
    });
  });
});

describe("requireProjectPricingRegion / regionAfterPostcodeChange", () => {
  it("throws for unknown postcode without explicit region", () => {
    expect(() => requireProjectPricingRegion({ postcode: "ZZ1 1ZZ" })).toThrow(
      UNRESOLVED_POSTCODE_REGION_MESSAGE,
    );
  });

  it("refreshes region when postcode becomes BS16 2EG", () => {
    expect(
      regionAfterPostcodeChange({
        nextPostcode: "BS16 2EG",
        previousRegion: "London",
      }),
    ).toEqual({
      ok: true,
      region: "South West England",
      source: "postcode",
    });
  });

  it("keeps London when postcode changes to a London postcode", () => {
    expect(
      regionAfterPostcodeChange({
        nextPostcode: "E1 6AN",
        previousRegion: "South West England",
      }),
    ).toEqual({ ok: true, region: "London", source: "postcode" });
  });
});

describe("Quick Estimate multiplier for BS16 2EG", () => {
  it("uses South West England 1.08, not London 1.3", () => {
    const resolved = requireProjectPricingRegion({
      postcode: "BS16 2EG",
      explicitRegion: "London",
    });
    expect(resolved.region).toBe("South West England");
    expect(REGION_MULTIPLIERS[resolved.region]).toBe(1.08);
    expect(REGION_MULTIPLIERS.London).toBe(1.3);
  });
});
