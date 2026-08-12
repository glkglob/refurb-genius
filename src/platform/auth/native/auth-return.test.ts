import { describe, it, expect } from "vitest";
import { classifyAuthReturnUrl } from "./auth-return";
import { parseOpenAuthSessionResult } from "./web-auth-session";

describe("classifyAuthReturnUrl — positive", () => {
  it("accepts exact custom-scheme callback", () => {
    const raw = "com.refurbgenius.app://auth/callback";
    expect(classifyAuthReturnUrl(raw)).toEqual({ kind: "custom-scheme", url: raw });
  });

  it("accepts exact custom-scheme callback with query (not inspected)", () => {
    const raw = "com.refurbgenius.app://auth/callback?code=abc";
    expect(classifyAuthReturnUrl(raw)).toEqual({ kind: "custom-scheme", url: raw });
  });

  it("accepts exact Universal Link callback", () => {
    const raw = "https://www.refurbgenius.info/auth/native-callback";
    expect(classifyAuthReturnUrl(raw)).toEqual({ kind: "universal-link", url: raw });
  });

  it("accepts exact Universal Link with query (not inspected)", () => {
    const raw = "https://www.refurbgenius.info/auth/native-callback?token_hash=x&type=email";
    expect(classifyAuthReturnUrl(raw)).toEqual({ kind: "universal-link", url: raw });
  });
});

describe("classifyAuthReturnUrl — negative", () => {
  const cases: Array<{ name: string; url: string }> = [
    { name: "custom scheme wrong authority", url: "com.refurbgenius.app://other/callback" },
    { name: "custom scheme wrong path", url: "com.refurbgenius.app://auth/other" },
    {
      name: "custom scheme credentials",
      url: "com.refurbgenius.app://user:pass@auth/callback",
    },
    { name: "custom scheme port", url: "com.refurbgenius.app://auth:8443/callback" },
    { name: "custom trailing slash", url: "com.refurbgenius.app://auth/callback/" },
    {
      name: "Universal Link wrong host",
      url: "https://evil.example/auth/native-callback",
    },
    {
      name: "Universal Link credentials",
      url: "https://user:pass@www.refurbgenius.info/auth/native-callback",
    },
    {
      name: "Universal Link port",
      url: "https://www.refurbgenius.info:8443/auth/native-callback",
    },
    {
      name: "Universal Link trailing slash",
      url: "https://www.refurbgenius.info/auth/native-callback/",
    },
    {
      name: "http equivalent",
      url: "http://www.refurbgenius.info/auth/native-callback",
    },
    {
      name: "apex-domain equivalent",
      url: "https://refurbgenius.info/auth/native-callback",
    },
    { name: "capacitor equivalent", url: "capacitor://localhost/auth/callback" },
    { name: "malformed URL", url: "not a url at all" },
    { name: "empty string", url: "" },
    {
      name: "path normalization trick",
      url: "https://www.refurbgenius.info/auth/../auth/native-callback",
    },
  ];

  for (const { name, url } of cases) {
    it(`rejects ${name}`, () => {
      expect(classifyAuthReturnUrl(url)).toBeNull();
    });
  }
});

describe("parseOpenAuthSessionResult", () => {
  it("accepts valid success", () => {
    expect(
      parseOpenAuthSessionResult({ type: "success", url: "com.refurbgenius.app://auth/callback" }),
    ).toEqual({
      type: "success",
      url: "com.refurbgenius.app://auth/callback",
    });
  });

  it("accepts valid cancel", () => {
    expect(parseOpenAuthSessionResult({ type: "cancel" })).toEqual({ type: "cancel" });
  });

  it("rejects success missing url", () => {
    expect(() => parseOpenAuthSessionResult({ type: "success" })).toThrow();
  });

  it("rejects success empty url", () => {
    expect(() => parseOpenAuthSessionResult({ type: "success", url: "" })).toThrow();
  });

  it("rejects unknown type", () => {
    expect(() => parseOpenAuthSessionResult({ type: "error", url: "x" })).toThrow();
  });

  it("rejects malformed value", () => {
    expect(() => parseOpenAuthSessionResult(null)).toThrow();
    expect(() => parseOpenAuthSessionResult("success")).toThrow();
    expect(() => parseOpenAuthSessionResult({ type: "cancel", url: "extra" })).toThrow();
  });
});
