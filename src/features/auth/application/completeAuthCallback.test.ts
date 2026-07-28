/**
 * AO-1F1 — Auth callback application orchestration contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const exchangeAuthCode = vi.fn();
const getBrowserAuthSession = vi.fn();
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

vi.mock("@/lib/auth", () => ({
  fromSupabaseUser: (u: unknown) => fromSupabaseUser(u as { id: string; email?: string } | null),
}));

import { completeAuthCallback } from "./completeAuthCallback";

const SRC = join(__dirname, "completeAuthCallback.ts");

beforeEach(() => {
  exchangeAuthCode.mockReset();
  getBrowserAuthSession.mockReset();
  fromSupabaseUser.mockClear();
});

describe("completeAuthCallback — URL error", () => {
  it("prefers errorDescription over urlError and does not call Auth primitives", async () => {
    const result = await completeAuthCallback({
      urlError: "access_denied",
      errorDescription: "User cancelled",
      code: "should-not-use",
    });

    expect(result).toEqual({ kind: "error", message: "User cancelled" });
    expect(exchangeAuthCode).not.toHaveBeenCalled();
    expect(getBrowserAuthSession).not.toHaveBeenCalled();
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
    expect(fromSupabaseUser).toHaveBeenCalledWith(rawUser);
    expect(result).toEqual({
      kind: "authenticated",
      user: { id: "u1", email: "a@b.com" },
      destination: "/projects",
    });
  });

  it("returns exact missing-code error when no session", async () => {
    getBrowserAuthSession.mockResolvedValue(null);

    const result = await completeAuthCallback({});

    expect(result).toEqual({
      kind: "error",
      message: "No authentication code received. Please try signing in again.",
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

  it("converts thrown Auth error to error.message result", async () => {
    const err = Object.assign(new Error("invalid grant"), { status: 400 });
    exchangeAuthCode.mockRejectedValue(err);

    const result = await completeAuthCallback({ code: "bad" });

    expect(result).toEqual({ kind: "error", message: "invalid grant" });
  });

  it("converts non-Error rejection to Auth callback failed.", async () => {
    exchangeAuthCode.mockRejectedValue("boom");

    const result = await completeAuthCallback({ code: "bad" });

    expect(result).toEqual({ kind: "error", message: "Auth callback failed." });
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
