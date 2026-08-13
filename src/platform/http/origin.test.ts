import { describe, it, expect } from "vitest";
import { joinProductionApiUrl, normalizeHttpsOrigin, resolveProductionApiOrigin } from "./origin";
import { NativeHttpError } from "./errors";

describe("normalizeHttpsOrigin", () => {
  it("strips trailing slashes and returns origin", () => {
    expect(normalizeHttpsOrigin("https://www.refurbgenius.info/")).toBe(
      "https://www.refurbgenius.info",
    );
    expect(normalizeHttpsOrigin("https://www.refurbgenius.info///")).toBe(
      "https://www.refurbgenius.info",
    );
  });

  it("rejects non-HTTPS", () => {
    expect(() => normalizeHttpsOrigin("http://www.refurbgenius.info")).toThrow(NativeHttpError);
    try {
      normalizeHttpsOrigin("http://www.refurbgenius.info");
    } catch (e) {
      expect(e).toMatchObject({ code: "origin_not_https" });
    }
  });

  it("rejects invalid URLs and credentials", () => {
    expect(() => normalizeHttpsOrigin("not-a-url")).toThrow(NativeHttpError);
    expect(() => normalizeHttpsOrigin("https://user:pass@evil.example")).toThrow(NativeHttpError);
  });
});

describe("resolveProductionApiOrigin", () => {
  it("uses provided VITE_PUBLIC_URL value", () => {
    expect(resolveProductionApiOrigin("https://www.refurbgenius.info")).toBe(
      "https://www.refurbgenius.info",
    );
  });

  it("fails closed when missing", () => {
    expect(() => resolveProductionApiOrigin(undefined)).toThrow(NativeHttpError);
    expect(() => resolveProductionApiOrigin("")).toThrow(NativeHttpError);
  });
});

describe("joinProductionApiUrl", () => {
  const origin = "https://www.refurbgenius.info";

  it("joins root-relative paths", () => {
    expect(joinProductionApiUrl(origin, "/api/mobile/v1/session/ping")).toBe(
      "https://www.refurbgenius.info/api/mobile/v1/session/ping",
    );
  });

  it("rejects non-root-relative and scheme-like paths", () => {
    expect(() => joinProductionApiUrl(origin, "api/mobile")).toThrow(NativeHttpError);
    expect(() => joinProductionApiUrl(origin, "//evil.example")).toThrow(NativeHttpError);
    expect(() => joinProductionApiUrl(origin, "https://evil.example/x")).toThrow(NativeHttpError);
  });

  it("never places caller secrets into the construction itself", () => {
    const url = joinProductionApiUrl(origin, "/api/mobile/v1/session/ping");
    expect(url).not.toMatch(/access_token|refresh_token|Bearer/i);
  });
});
