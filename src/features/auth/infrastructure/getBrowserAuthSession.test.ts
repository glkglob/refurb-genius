/**
 * AO-1F1 — Browser Auth session retrieval primitive contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const getSession = vi.fn();

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}));

import { getBrowserAuthSession } from "./getBrowserAuthSession";

const SRC = join(__dirname, "getBrowserAuthSession.ts");

beforeEach(() => {
  getSession.mockReset();
  getSession.mockResolvedValue({
    data: { session: { user: { id: "u1", email: "a@b.com" } } },
    error: null,
  });
});

describe("getBrowserAuthSession", () => {
  it("uses platform browser Auth client via @/platform/supabase/browser", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/@\/platform\/supabase\/browser/);
    expect(src).toMatch(/supabase\.auth\.getSession/);
  });

  it("calls getSession once with no arguments", async () => {
    await getBrowserAuthSession();

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(getSession).toHaveBeenCalledWith();
  });

  it("returns the session user when a session exists", async () => {
    const user = { id: "u2", email: "x@y.com" };
    getSession.mockResolvedValue({
      data: { session: { user, access_token: "t" } },
      error: null,
    });

    const result = await getBrowserAuthSession();
    expect(result).toEqual({ user });
  });

  it("returns null when no session exists", async () => {
    getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const result = await getBrowserAuthSession();
    expect(result).toBeNull();
  });

  it("ignores returned error field when session is absent (parity)", async () => {
    getSession.mockResolvedValue({
      data: { session: null },
      error: Object.assign(new Error("session missing"), { status: 400 }),
    });

    const result = await getBrowserAuthSession();
    expect(result).toBeNull();
  });

  it("returns user when session exists even if error field is set (parity)", async () => {
    const user = { id: "u3", email: "z@z.com" };
    getSession.mockResolvedValue({
      data: { session: { user } },
      error: Object.assign(new Error("soft error"), { status: 400 }),
    });

    const result = await getBrowserAuthSession();
    expect(result).toEqual({ user });
  });

  it("propagates a genuinely rejected promise", async () => {
    getSession.mockRejectedValue(new Error("network down"));

    await expect(getBrowserAuthSession()).rejects.toThrow("network down");
  });

  it("remains presentation-free (no mapping, QC, nav, logger, window, exchange)", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/exchangeCodeForSession/);
    expect(src).not.toMatch(/QueryClient|setQueryData|AUTH_USER_QUERY_KEY/);
    expect(src).not.toMatch(/navigate|useNavigate|window\./);
    expect(src).not.toMatch(/\blogger\b|toast|fromSupabaseUser|captureAuthError/);
    expect(src).not.toMatch(/from ["']react["']/);
  });
});
