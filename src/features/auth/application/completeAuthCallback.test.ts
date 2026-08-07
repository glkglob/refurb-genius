/**
 * P0-AUTH-1 — Auth callback application orchestration contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const exchangeAuthCode = vi.fn();
const getBrowserAuthSession = vi.fn();
const verifyEmailTokenHash = vi.fn();
type MappedUser = { id: string; email: string; fullName?: string };

const fromSupabaseUser = vi.fn((u: { id: string; email?: string } | null): MappedUser | null =>
  u ? { id: u.id, email: u.email ?? "" } : null,
);

vi.mock("../infrastructure/exchangeAuthCode", () => ({
  exchangeAuthCode: (input: unknown) => exchangeAuthCode(input),
}));

vi.mock("../infrastructure/getBrowserAuthSession", () => ({
  getBrowserAuthSession: () => getBrowserAuthSession(),
}));

vi.mock("../infrastructure/verifyEmailTokenHash", () => ({
  verifyEmailTokenHash: (input: unknown) => verifyEmailTokenHash(input),
}));

vi.mock("@/lib/auth", () => ({
  fromSupabaseUser: (u: unknown) => fromSupabaseUser(u as { id: string; email?: string } | null),
}));

import {
  AUTH_CALLBACK_BROWSER_MISMATCH_MESSAGE,
  AUTH_CALLBACK_GENERIC_FAILURE_MESSAGE,
  AUTH_CALLBACK_INVALID_LINK_MESSAGE,
  completeAuthCallback,
} from "./completeAuthCallback";

const SRC = join(__dirname, "completeAuthCallback.ts");

beforeEach(() => {
  exchangeAuthCode.mockReset();
  getBrowserAuthSession.mockReset();
  verifyEmailTokenHash.mockReset();
  fromSupabaseUser.mockClear();
});

describe("completeAuthCallback — URL error", () => {
  it("prefers errorDescription over urlError and does not call Auth primitives", async () => {
    const result = await completeAuthCallback({
      urlError: "access_denied",
      errorDescription: "User cancelled",
      code: "should-not-use",
      tokenHash: "should-not-use",
    });

    expect(result).toEqual({ kind: "error", message: "User cancelled" });
    expect(exchangeAuthCode).not.toHaveBeenCalled();
    expect(getBrowserAuthSession).not.toHaveBeenCalled();
    expect(verifyEmailTokenHash).not.toHaveBeenCalled();
  });

  it("falls back to urlError when errorDescription is absent", async () => {
    const result = await completeAuthCallback({
      urlError: "access_denied",
    });

    expect(result).toEqual({ kind: "error", message: "access_denied" });
    expect(exchangeAuthCode).not.toHaveBeenCalled();
    expect(getBrowserAuthSession).not.toHaveBeenCalled();
  });
});

describe("completeAuthCallback — token-hash magic link", () => {
  it("calls verifyEmailTokenHash exactly once for type=email and skips code/session", async () => {
    const rawUser = { id: "u-th", email: "m@example.com" };
    verifyEmailTokenHash.mockResolvedValue({ user: rawUser });
    fromSupabaseUser.mockReturnValue({ id: "u-th", email: "m@example.com" });

    const result = await completeAuthCallback({
      tokenHash: "th-value",
      type: "email",
      redirectTo: "/projects",
      code: "should-not-use",
    });

    expect(verifyEmailTokenHash).toHaveBeenCalledTimes(1);
    expect(verifyEmailTokenHash).toHaveBeenCalledWith({ tokenHash: "th-value" });
    expect(exchangeAuthCode).not.toHaveBeenCalled();
    expect(getBrowserAuthSession).not.toHaveBeenCalled();
    expect(fromSupabaseUser).toHaveBeenCalledWith(rawUser);
    expect(result).toEqual({
      kind: "authenticated",
      user: { id: "u-th", email: "m@example.com" },
      destination: "/projects",
    });
  });

  it("rejects token hash with missing type before infrastructure invocation", async () => {
    const result = await completeAuthCallback({
      tokenHash: "th-value",
    });

    expect(verifyEmailTokenHash).not.toHaveBeenCalled();
    expect(exchangeAuthCode).not.toHaveBeenCalled();
    expect(getBrowserAuthSession).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "error",
      message: AUTH_CALLBACK_INVALID_LINK_MESSAGE,
    });
  });

  it("rejects token hash with unsupported type before infrastructure invocation", async () => {
    const result = await completeAuthCallback({
      tokenHash: "th-value",
      type: "recovery",
    });

    expect(verifyEmailTokenHash).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "error",
      message: AUTH_CALLBACK_INVALID_LINK_MESSAGE,
    });
  });

  it("maps token-hash Auth error to the safe expired-link message", async () => {
    verifyEmailTokenHash.mockRejectedValue(
      Object.assign(new Error("Token has expired or is invalid"), {
        code: "otp_expired",
        status: 403,
      }),
    );

    const result = await completeAuthCallback({
      tokenHash: "th-value",
      type: "email",
    });

    expect(result).toEqual({
      kind: "error",
      message: AUTH_CALLBACK_INVALID_LINK_MESSAGE,
    });
    expect(JSON.stringify(result)).not.toMatch(/th-value|otp_expired|Token has expired/i);
  });
});

describe("completeAuthCallback — no-code session", () => {
  it("maps session user and returns authenticated destination", async () => {
    const rawUser = { id: "u1", email: "a@b.com" };
    getBrowserAuthSession.mockResolvedValue({ user: rawUser });
    fromSupabaseUser.mockReturnValue({ id: "u1", email: "a@b.com" });

    const result = await completeAuthCallback({
      redirectTo: "/projects",
    });

    expect(getBrowserAuthSession).toHaveBeenCalledTimes(1);
    expect(exchangeAuthCode).not.toHaveBeenCalled();
    expect(verifyEmailTokenHash).not.toHaveBeenCalled();
    expect(fromSupabaseUser).toHaveBeenCalledWith(rawUser);
    expect(result).toEqual({
      kind: "authenticated",
      user: { id: "u1", email: "a@b.com" },
      destination: "/projects",
    });
  });

  it("returns generic missing-callback error when no session", async () => {
    getBrowserAuthSession.mockResolvedValue(null);

    const result = await completeAuthCallback({});

    expect(result).toEqual({
      kind: "error",
      message: AUTH_CALLBACK_GENERIC_FAILURE_MESSAGE,
    });
    expect(exchangeAuthCode).not.toHaveBeenCalled();
  });

  it("propagates rejected getBrowserAuthSession (no-code parity)", async () => {
    getBrowserAuthSession.mockRejectedValue(new Error("network down"));

    await expect(completeAuthCallback({})).rejects.toThrow("network down");
  });

  it("falls back destination to /dashboard when redirect invalid", async () => {
    getBrowserAuthSession.mockResolvedValue({ user: { id: "u1" } });
    fromSupabaseUser.mockReturnValue({ id: "u1", email: "" });

    const result = await completeAuthCallback({ redirectTo: "https://evil.com" });

    expect(result).toMatchObject({
      kind: "authenticated",
      destination: "/dashboard",
    });
  });

  it("rejects protocol-relative redirects", async () => {
    getBrowserAuthSession.mockResolvedValue({ user: { id: "u1" } });
    fromSupabaseUser.mockReturnValue({ id: "u1", email: "" });

    const result = await completeAuthCallback({ redirectTo: "//evil.example" });

    expect(result).toMatchObject({
      kind: "authenticated",
      destination: "/dashboard",
    });
  });

  it("rejects /auth redirects", async () => {
    getBrowserAuthSession.mockResolvedValue({ user: { id: "u1" } });
    fromSupabaseUser.mockReturnValue({ id: "u1", email: "" });

    const result = await completeAuthCallback({ redirectTo: "/auth?mode=signin" });

    expect(result).toMatchObject({
      kind: "authenticated",
      destination: "/dashboard",
    });
  });
});

describe("completeAuthCallback — code exchange", () => {
  it("returns authenticated with mapped user and destination on success", async () => {
    const rawUser = { id: "u2", email: "x@y.com" };
    exchangeAuthCode.mockResolvedValue({ user: rawUser });
    fromSupabaseUser.mockReturnValue({ id: "u2", email: "x@y.com" });

    const result = await completeAuthCallback({
      code: "pkce",
      redirectTo: "/dashboard",
    });

    expect(exchangeAuthCode).toHaveBeenCalledWith({ code: "pkce" });
    expect(getBrowserAuthSession).not.toHaveBeenCalled();
    expect(verifyEmailTokenHash).not.toHaveBeenCalled();
    expect(fromSupabaseUser).toHaveBeenCalledWith(rawUser);
    expect(result).toEqual({
      kind: "authenticated",
      user: { id: "u2", email: "x@y.com" },
      destination: "/dashboard",
    });
  });

  it("returns recovery without mapping or destination when type is recovery", async () => {
    exchangeAuthCode.mockResolvedValue({ user: { id: "u3", email: "r@r.com" } });

    const result = await completeAuthCallback({
      code: "pkce",
      type: "recovery",
      redirectTo: "/projects",
    });

    expect(result).toEqual({ kind: "recovery" });
    expect(fromSupabaseUser).not.toHaveBeenCalled();
  });

  it("maps null user on normal success (mapper null parity)", async () => {
    exchangeAuthCode.mockResolvedValue({ user: null });
    fromSupabaseUser.mockReturnValue(null);

    const result = await completeAuthCallback({ code: "pkce" });

    expect(fromSupabaseUser).toHaveBeenCalledWith(null);
    expect(result).toEqual({
      kind: "authenticated",
      user: null,
      destination: "/dashboard",
    });
  });

  it("maps PKCE verifier errors to the safe browser-mismatch message", async () => {
    exchangeAuthCode.mockRejectedValue(
      Object.assign(
        new Error("invalid request: both auth code and code verifier should be non-empty"),
        { status: 400 },
      ),
    );

    const result = await completeAuthCallback({ code: "bad" });

    expect(result).toEqual({
      kind: "error",
      message: AUTH_CALLBACK_BROWSER_MISMATCH_MESSAGE,
    });
    expect(JSON.stringify(result)).not.toMatch(/code verifier|pkce|invalid request/i);
  });

  it("maps unknown exchange failures to the generic message", async () => {
    exchangeAuthCode.mockRejectedValue(Object.assign(new Error("invalid grant"), { status: 400 }));

    const result = await completeAuthCallback({ code: "bad" });

    expect(result).toEqual({
      kind: "error",
      message: AUTH_CALLBACK_GENERIC_FAILURE_MESSAGE,
    });
    expect(JSON.stringify(result)).not.toMatch(/invalid grant/i);
  });

  it("maps non-Error rejection to the generic message", async () => {
    exchangeAuthCode.mockRejectedValue("boom");

    const result = await completeAuthCallback({ code: "bad" });

    expect(result).toEqual({
      kind: "error",
      message: AUTH_CALLBACK_GENERIC_FAILURE_MESSAGE,
    });
  });
});

describe("completeAuthCallback — purity", () => {
  it("does not own QueryClient, navigation, React, logger, or toast", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/QueryClient|setQueryData|AUTH_USER_QUERY_KEY/);
    expect(src).not.toMatch(/useNavigate|navigate\s*\(/);
    expect(src).not.toMatch(/from ["']react["']/);
    expect(src).not.toMatch(/\blogger\b|\btoast\b/);
    expect(src).not.toMatch(/@\/platform\/supabase/);
  });
});
