import { describe, expect, it } from "vitest";
import { postcodeToUkRegion, resolvePostcodeRegion } from "./regionMap";

describe("resolvePostcodeRegion", () => {
  it("maps E1 to London matched", () => {
    const r = resolvePostcodeRegion("E1 6AN");
    expect(r.region).toBe("London");
    expect(r.matched).toBe(true);
    expect(r.area).toBe("E");
  });

  it("maps CV1 to West Midlands matched", () => {
    const r = resolvePostcodeRegion("CV1 2WT");
    expect(r.region).toBe("West Midlands");
    expect(r.matched).toBe(true);
  });

  it("maps M1 to North West England matched", () => {
    const r = resolvePostcodeRegion("M1 1AE");
    expect(r.region).toBe("North West England");
    expect(r.matched).toBe(true);
  });

  it("maps ZZ1 as unmatched without London", () => {
    const r = resolvePostcodeRegion("ZZ1 1ZZ");
    expect(r.region).toBeNull();
    expect(r.matched).toBe(false);
    expect(r.area).toBe("ZZ");
  });

  it("maps empty as unmatched without London", () => {
    const r = resolvePostcodeRegion("");
    expect(r.region).toBeNull();
    expect(r.matched).toBe(false);
    expect(r.area).toBe("");
  });

  it("maps malformed input as unmatched without London", () => {
    const r = resolvePostcodeRegion("12345");
    expect(r.region).toBeNull();
    expect(r.matched).toBe(false);
  });

  it("maps BS16 2EG to South West England and not London", () => {
    const r = resolvePostcodeRegion("BS16 2EG");
    expect(r.region).toBe("South West England");
    expect(r.region).not.toBe("London");
    expect(r.matched).toBe(true);
    expect(r.area).toBe("BS");
  });
});

describe("postcodeToUkRegion compatibility", () => {
  it.each(["E1 6AN", "CV1 2WT", "M1 1AE", "ZZ1 1ZZ", "", "12345", "BS16 2EG"])(
    "returns matched region or null for %s",
    (value) => {
      const resolved = resolvePostcodeRegion(value);
      expect(postcodeToUkRegion(value)).toBe(resolved.matched ? resolved.region : null);
    },
  );
});
