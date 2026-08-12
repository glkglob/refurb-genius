/**
 * IOS-READINESS-2B-3 — native exchangeCodeForSession primitive contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const exchangeCodeForSession = vi.fn();
const getNativeSupabase = vi.fn(() => ({
  auth: {
    exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSession(...args),
  },
}));

vi.mock("@/platform/supabase/native", () => ({
  getNativeSupabase: () => getNativeSupabase(),
}));

import { exchangeNativeAuthCode } from "./exchangeNativeAuthCode";

const SRC = join(__dirname, "exchangeNativeAuthCode.ts");

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  getNativeSupabase.mockClear();
  exchangeCodeForSession.mockResolvedValue({
    data: {
      user: { id: "u1", email: "a@b.com" },
      session: { access_token: "at", refresh_token: "rt" },
    },
    error: null,
  });
});

describe("exchangeNativeAuthCode", () => {
  it("uses getNativeSupabase and exchangeCodeForSession(code) exactly", async () => {
    const result = await exchangeNativeAuthCode({ code: "auth-code" });

    expect(getNativeSupabase).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(result.user).toEqual({ id: "u1", email: "a@b.com" });
    expect(result.session).toEqual({ access_token: "at", refresh_token: "rt" });
  });

  it("propagates Auth errors unchanged", async () => {
    const authError = Object.assign(new Error("bad code"), { code: "flow_state" });
    exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: authError,
    });

    await expect(exchangeNativeAuthCode({ code: "x" })).rejects.toBe(authError);
  });

  it("never imports browser or web exchange authority", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/getNativeSupabase/);
    expect(src).toMatch(/exchangeCodeForSession/);
    expect(src).not.toMatch(
      /platform\/supabase\/browser|platform\/supabase\/_client|exchangeAuthCode/,
    );
    expect(src).not.toMatch(/pip-auth|createBrowserSupabase/);
    expect(src).not.toMatch(/console\.|logger\.|toast|navigate|QueryClient/);
  });
});
