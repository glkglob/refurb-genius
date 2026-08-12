/**
 * IOS-READINESS-2B-3 — native OAuth authorization-code extraction contracts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractNativeOAuthAuthorizationCode } from "./extractNativeOAuthAuthorizationCode";

const SRC = join(__dirname, "extractNativeOAuthAuthorizationCode.ts");

describe("extractNativeOAuthAuthorizationCode", () => {
  it("accepts exact custom-scheme callback with a single non-empty code", () => {
    const code = extractNativeOAuthAuthorizationCode(
      "com.refurbgenius.app://auth/callback?code=auth-code-abc",
    );
    expect(code).toBe("auth-code-abc");
  });

  it("rejects missing code", () => {
    expect(() =>
      extractNativeOAuthAuthorizationCode("com.refurbgenius.app://auth/callback"),
    ).toThrow("Invalid authentication return.");
  });

  it("rejects empty code", () => {
    expect(() =>
      extractNativeOAuthAuthorizationCode("com.refurbgenius.app://auth/callback?code="),
    ).toThrow("Invalid authentication return.");
  });

  it("rejects whitespace-only code", () => {
    expect(() =>
      extractNativeOAuthAuthorizationCode("com.refurbgenius.app://auth/callback?code=%20%20"),
    ).toThrow("Invalid authentication return.");
  });

  it("rejects duplicate code parameters", () => {
    expect(() =>
      extractNativeOAuthAuthorizationCode("com.refurbgenius.app://auth/callback?code=a&code=b"),
    ).toThrow("Invalid authentication return.");
  });

  it("rejects non-empty fragment", () => {
    expect(() =>
      extractNativeOAuthAuthorizationCode(
        "com.refurbgenius.app://auth/callback?code=x#access_token=secret",
      ),
    ).toThrow("Invalid authentication return.");
  });

  it.each(["token_hash", "access_token", "refresh_token"] as const)(
    "rejects %s query parameter",
    (key) => {
      expect(() =>
        extractNativeOAuthAuthorizationCode(
          `com.refurbgenius.app://auth/callback?code=ok&${key}=secret`,
        ),
      ).toThrow("Invalid authentication return.");
    },
  );

  it("rejects Universal Link surfaces", () => {
    expect(() =>
      extractNativeOAuthAuthorizationCode(
        "https://www.refurbgenius.info/auth/native-callback?code=x",
      ),
    ).toThrow("Invalid authentication return.");
  });

  it("rejects malformed / noncanonical custom-scheme paths", () => {
    expect(() =>
      extractNativeOAuthAuthorizationCode("com.refurbgenius.app://auth/callback/?code=x"),
    ).toThrow("Invalid authentication return.");
    expect(() =>
      extractNativeOAuthAuthorizationCode("com.refurbgenius.app://callback?code=x"),
    ).toThrow("Invalid authentication return.");
  });

  it("does not log callback URL or code", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).not.toMatch(/console\.(log|info|debug|warn|error)/);
    expect(src).not.toMatch(/logger\.|trackEvent|captureException|analytics/);
  });
});
