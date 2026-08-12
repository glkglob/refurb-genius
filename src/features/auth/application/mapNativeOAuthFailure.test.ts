/**
 * IOS-READINESS-2B-3 — native OAuth failure mapping contracts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mapNativeOAuthFailure,
  NATIVE_OAUTH_GENERIC_FAILURE_MESSAGE,
  NATIVE_OAUTH_INVALID_OR_EXPIRED_MESSAGE,
  NATIVE_OAUTH_PKCE_FAILURE_MESSAGE,
} from "./mapNativeOAuthFailure";

const SRC = join(__dirname, "mapNativeOAuthFailure.ts");

describe("mapNativeOAuthFailure", () => {
  it("maps PKCE verifier failures", () => {
    expect(
      mapNativeOAuthFailure(
        Object.assign(new Error("PKCE code verifier not found in storage"), {
          code: "pkce_code_verifier_not_found",
        }),
      ),
    ).toBe(NATIVE_OAUTH_PKCE_FAILURE_MESSAGE);
  });

  it("maps expired / flow-state family", () => {
    expect(
      mapNativeOAuthFailure(
        Object.assign(new Error("flow_state not found"), { code: "flow_state" }),
      ),
    ).toBe(NATIVE_OAUTH_INVALID_OR_EXPIRED_MESSAGE);
    expect(
      mapNativeOAuthFailure(Object.assign(new Error("otp expired"), { code: "otp_expired" })),
    ).toBe(NATIVE_OAUTH_INVALID_OR_EXPIRED_MESSAGE);
  });

  it("returns generic copy for unknown errors", () => {
    expect(mapNativeOAuthFailure(new Error("some internal failure xyz"))).toBe(
      NATIVE_OAUTH_GENERIC_FAILURE_MESSAGE,
    );
  });

  it("never returns raw backend message as the user-facing string", () => {
    const raw = "PKCE code verifier not found in storage. Super secret";
    const mapped = mapNativeOAuthFailure(new Error(raw));
    expect(mapped).not.toBe(raw);
    expect(mapped).not.toMatch(/secret|verifier not found in storage/i);
  });

  it("does not import web completeAuthCallback or log secrets", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).not.toMatch(/completeAuthCallback|exchangeAuthCode|browser|_client/);
    expect(src).not.toMatch(/console\.|logger\.|trackEvent/);
  });
});
