/**
 * AO-1F1 — Authorization-code exchange Auth primitive contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const exchangeCodeForSession = vi.fn();

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSession(...args),
    },
  },
}));

import { exchangeAuthCode } from "./exchangeAuthCode";

const SRC = join(__dirname, "exchangeAuthCode.ts");

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  exchangeCodeForSession.mockResolvedValue({
    data: { user: { id: "u1", email: "a@b.com" }, session: {} },
    error: null,
  });
});

describe("exchangeAuthCode", () => {
  it("uses platform browser Auth client via @/platform/supabase/browser", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/@\/platform\/supabase\/browser/);
    expect(src).toMatch(/supabase\.auth\.exchangeCodeForSession/);
  });

  it("calls exchangeCodeForSession once with the exact code string", async () => {
    await exchangeAuthCode({ code: "pkce-code-abc" });

    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code-abc");
  });

  it("returns the Auth user on success", async () => {
    const user = { id: "u2", email: "x@y.com" };
    exchangeCodeForSession.mockResolvedValue({
      data: { user, session: { access_token: "t" } },
      error: null,
    });

    const result = await exchangeAuthCode({ code: "c" });
    expect(result).toEqual({ user });
  });

  it("returns null user when Auth returns null user", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const result = await exchangeAuthCode({ code: "c" });
    expect(result).toEqual({ user: null });
  });

  it("throws returned Auth error unchanged", async () => {
    const err = Object.assign(new Error("invalid code"), { status: 400 });
    exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: err,
    });

    await expect(exchangeAuthCode({ code: "bad" })).rejects.toBe(err);
  });

  it("propagates a genuinely rejected promise", async () => {
    exchangeCodeForSession.mockRejectedValue(new Error("network down"));

    await expect(exchangeAuthCode({ code: "c" })).rejects.toThrow("network down");
  });

  it("remains presentation-free (no session re-read, QC, nav, logger, window, mapping)", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/getSession/);
    expect(src).not.toMatch(/QueryClient|setQueryData|AUTH_USER_QUERY_KEY/);
    expect(src).not.toMatch(/navigate|useNavigate|window\./);
    expect(src).not.toMatch(/\blogger\b|toast|fromSupabaseUser|captureAuthError/);
    expect(src).not.toMatch(/from ["']react["']/);
  });
});
