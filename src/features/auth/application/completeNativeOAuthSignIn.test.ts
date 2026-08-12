/**
 * IOS-READINESS-2B-3 — pure native OAuth completion application contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const extractNativeOAuthAuthorizationCode = vi.fn();
const exchangeNativeAuthCode = vi.fn();
const mapNativeSupabaseUser = vi.fn();
const resolveAuthCallbackDestination = vi.fn();
const mapNativeOAuthFailure = vi.fn();

vi.mock("../infrastructure/extractNativeOAuthAuthorizationCode", () => ({
  extractNativeOAuthAuthorizationCode: (url: unknown) => extractNativeOAuthAuthorizationCode(url),
}));

vi.mock("../infrastructure/exchangeNativeAuthCode", () => ({
  exchangeNativeAuthCode: (input: unknown) => exchangeNativeAuthCode(input),
}));

vi.mock("./mapNativeSupabaseUser", () => ({
  mapNativeSupabaseUser: (u: unknown) => mapNativeSupabaseUser(u),
}));

vi.mock("./resolveAuthCallbackDestination", () => ({
  resolveAuthCallbackDestination: (r?: unknown) => resolveAuthCallbackDestination(r),
}));

vi.mock("./mapNativeOAuthFailure", () => ({
  mapNativeOAuthFailure: (e: unknown) => mapNativeOAuthFailure(e),
}));

import { completeNativeOAuthSignIn } from "./completeNativeOAuthSignIn";

const SRC = join(__dirname, "completeNativeOAuthSignIn.ts");

beforeEach(() => {
  extractNativeOAuthAuthorizationCode.mockReset();
  exchangeNativeAuthCode.mockReset();
  mapNativeSupabaseUser.mockReset();
  resolveAuthCallbackDestination.mockReset();
  mapNativeOAuthFailure.mockReset();

  extractNativeOAuthAuthorizationCode.mockReturnValue("auth-code");
  exchangeNativeAuthCode.mockResolvedValue({
    user: { id: "u1", email: "a@b.com" },
    session: { access_token: "at" },
  });
  mapNativeSupabaseUser.mockReturnValue({ id: "u1", email: "a@b.com" });
  resolveAuthCallbackDestination.mockReturnValue("/dashboard");
  mapNativeOAuthFailure.mockReturnValue("We could not complete sign-in. Please try again.");
});

describe("completeNativeOAuthSignIn", () => {
  it("returns authenticated user and destination on success", async () => {
    const result = await completeNativeOAuthSignIn({
      callbackUrl: "com.refurbgenius.app://auth/callback?code=auth-code",
      redirectTo: "/projects",
    });

    expect(extractNativeOAuthAuthorizationCode).toHaveBeenCalledWith(
      "com.refurbgenius.app://auth/callback?code=auth-code",
    );
    expect(exchangeNativeAuthCode).toHaveBeenCalledWith({ code: "auth-code" });
    expect(mapNativeSupabaseUser).toHaveBeenCalledWith({ id: "u1", email: "a@b.com" });
    expect(resolveAuthCallbackDestination).toHaveBeenCalledWith("/projects");
    expect(result).toEqual({
      kind: "authenticated",
      user: { id: "u1", email: "a@b.com" },
      destination: "/dashboard",
    });
  });

  it("returns error when mapped user is null", async () => {
    mapNativeSupabaseUser.mockReturnValue(null);

    const result = await completeNativeOAuthSignIn({
      callbackUrl: "com.refurbgenius.app://auth/callback?code=x",
    });

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toBe("We could not complete sign-in. Please try again.");
    }
  });

  it("maps exchange failures to bounded error messages", async () => {
    const err = Object.assign(new Error("PKCE code verifier not found"), {
      code: "pkce_code_verifier_not_found",
    });
    exchangeNativeAuthCode.mockRejectedValue(err);
    mapNativeOAuthFailure.mockReturnValue(
      "This sign-in could not be completed. Please try again from the app.",
    );

    const result = await completeNativeOAuthSignIn({
      callbackUrl: "com.refurbgenius.app://auth/callback?code=x",
    });

    expect(result).toEqual({
      kind: "error",
      message: "This sign-in could not be completed. Please try again from the app.",
    });
    expect(mapNativeOAuthFailure).toHaveBeenCalledWith(err);
  });

  it("is application-pure (no QueryClient/React/toast/nav/analytics)", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).not.toMatch(
      /@tanstack\/react-query|useQueryClient|QueryClient|AUTH_USER_QUERY_KEY/,
    );
    expect(src).not.toMatch(/from ["']react["']|useNavigate|toast|logger|trackEvent|analytics/);
    expect(src).not.toMatch(
      /completeAuthCallback|exchangeAuthCode|getBrowserAuthSession|browser|_client/,
    );
  });
});
