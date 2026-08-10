import { describe, it, expect } from "vitest";
import {
  APPLE_SIGN_IN_SDK_URL,
  buildAppleSignInHeadMeta,
  isAppleSignInConfigured,
  resolveAppleClientId,
} from "./apple-sign-in-config";

describe("resolveAppleClientId", () => {
  it("returns empty string for absent / empty values", () => {
    expect(resolveAppleClientId(undefined)).toBe("");
    expect(resolveAppleClientId(null)).toBe("");
    expect(resolveAppleClientId("")).toBe("");
  });

  it("treats whitespace-only as unconfigured", () => {
    expect(resolveAppleClientId("   ")).toBe("");
    expect(resolveAppleClientId("\t\n")).toBe("");
  });

  it("trims a valid client ID", () => {
    expect(resolveAppleClientId("  com.example.test  ")).toBe("com.example.test");
  });
});

describe("isAppleSignInConfigured", () => {
  it("is false when empty after resolve", () => {
    expect(isAppleSignInConfigured("")).toBe(false);
  });

  it("is true for a non-empty client ID", () => {
    expect(isAppleSignInConfigured("com.example.test")).toBe(true);
  });
});

describe("buildAppleSignInHeadMeta — unconfigured", () => {
  it("omits all Apple Sign In meta when client ID is missing", () => {
    expect(buildAppleSignInHeadMeta("", "https://www.example.com")).toEqual([]);
    expect(
      buildAppleSignInHeadMeta(resolveAppleClientId(undefined), "https://www.example.com"),
    ).toEqual([]);
  });

  it("omits Apple Sign In meta when client ID is whitespace-only", () => {
    const meta = buildAppleSignInHeadMeta("   ", "https://www.example.com");
    expect(meta).toEqual([]);
    expect(meta.some((m) => m.name === "appleid-signin-client-id")).toBe(false);
    expect(meta.some((m) => m.content === "")).toBe(false);
  });

  it("does not emit empty client-id content", () => {
    const meta = buildAppleSignInHeadMeta("", "https://www.example.com");
    const clientMeta = meta.find((m) => m.name === "appleid-signin-client-id");
    expect(clientMeta).toBeUndefined();
  });
});

describe("buildAppleSignInHeadMeta — configured", () => {
  const siteUrl = "https://www.refurbgenius.info";
  const clientId = "com.example.test";

  it("emits client-id, scope, redirect, and popup meta", () => {
    const meta = buildAppleSignInHeadMeta(clientId, siteUrl);
    expect(meta).toEqual([
      { name: "appleid-signin-client-id", content: "com.example.test" },
      { name: "appleid-signin-scope", content: "name email" },
      {
        name: "appleid-signin-redirect-uri",
        content: "https://www.refurbgenius.info/auth/callback",
      },
      { name: "appleid-signin-use-popup", content: "true" },
    ]);
  });

  it("uses the trimmed client ID value", () => {
    const meta = buildAppleSignInHeadMeta("  com.example.test  ", siteUrl);
    expect(meta.find((m) => m.name === "appleid-signin-client-id")?.content).toBe(
      "com.example.test",
    );
  });
});

describe("APPLE_SIGN_IN_SDK_URL", () => {
  it("points at Apple's official auth.js SDK", () => {
    expect(APPLE_SIGN_IN_SDK_URL).toContain("appleid.auth.js");
    expect(APPLE_SIGN_IN_SDK_URL).toContain("appleid.cdn-apple.com");
  });
});
