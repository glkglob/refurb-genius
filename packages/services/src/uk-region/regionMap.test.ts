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

  it("maps ZZ1 to London unmatched", () => {
    const r = resolvePostcodeRegion("ZZ1 1ZZ");
    expect(r.region).toBe("London");
    expect(r.matched).toBe(false);
  });

  it("maps empty to London unmatched", () => {
    const r = resolvePostcodeRegion("");
    expect(r.region).toBe("London");
    expect(r.matched).toBe(false);
    expect(r.area).toBe("");
  });

  it("maps malformed input to London unmatched", () => {
    const r = resolvePostcodeRegion("12345");
    expect(r.region).toBe("London");
    expect(r.matched).toBe(false);
  });
});

describe("postcodeToUkRegion compatibility", () => {
  it.each(["E1 6AN", "CV1 2WT", "M1 1AE", "ZZ1 1ZZ", "", "12345"])(
    "delegates to resolvePostcodeRegion for %s",
    (value) => {
      expect(postcodeToUkRegion(value)).toBe(resolvePostcodeRegion(value).region);
    },
  );
});
