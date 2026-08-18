/**
 * NATIVE-AUTH-PASSWORD-1 — native password email sign-in primitive contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signInWithPassword = vi.fn();
const getSession = vi.fn();
const getNativeSupabase = vi.fn();

vi.mock("@/platform/supabase/native", () => ({
  getNativeSupabase: () => getNativeSupabase(),
}));

import { signInWithPasswordEmailNative } from "./signInWithPasswordEmailNative";

const SRC = join(__dirname, "signInWithPasswordEmailNative.ts");

const user = { id: "u1", email: "a@b.com" };
const session = { access_token: "at", refresh_token: "rt" };

beforeEach(() => {
  signInWithPassword.mockReset();
  getSession.mockReset();
  getNativeSupabase.mockReset();
  let persisted: { user: typeof user; session: typeof session } | null = null;
  signInWithPassword.mockImplementation(async () => {
    persisted = { user, session };
    return { data: { user, session }, error: null };
  });
  getSession.mockImplementation(async () => ({
    data: { session: persisted?.session ?? null },
    error: null,
  }));
  getNativeSupabase.mockReturnValue({
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      getSession: (...args: unknown[]) => getSession(...args),
    },
  });
});

describe("signInWithPasswordEmailNative", () => {
  it("uses getNativeSupabase().auth.signInWithPassword with exact credentials", async () => {
    const result = await signInWithPasswordEmailNative({
      email: "  User@Example.COM  ",
      password: "  secret  ",
    });

    expect(getNativeSupabase).toHaveBeenCalledTimes(1);
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "  User@Example.COM  ",
      password: "  secret  ",
    });
    expect(result).toEqual({ user, session });
  });

  it("makes the session readable on the same native client after sign-in", async () => {
    await signInWithPasswordEmailNative({ email: "a@b.com", password: "pw" });
    const client = getNativeSupabase.mock.results[0]?.value as {
      auth: { getSession: () => Promise<{ data: { session: unknown } }> };
    };
    const observed = await client.auth.getSession();
    expect(observed.data.session).toEqual(session);
    expect(getSession).toHaveBeenCalled();
  });

  it("throws returned Supabase Auth errors unchanged", async () => {
    const authError = Object.assign(new Error("Invalid login credentials"), { status: 400 });
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: authError,
    });

    await expect(signInWithPasswordEmailNative({ email: "a@b.com", password: "bad" })).rejects.toBe(
      authError,
    );
  });

  it("propagates a genuinely rejected promise", async () => {
    signInWithPassword.mockRejectedValue(new Error("network down"));

    await expect(
      signInWithPasswordEmailNative({ email: "a@b.com", password: "pw" }),
    ).rejects.toThrow("network down");
  });

  it("never imports browser authority, cookies, or presentation", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/getNativeSupabase/);
    expect(src).toMatch(/signInWithPassword/);
    expect(src).not.toMatch(/platform\/supabase\/browser|platform\/supabase\/_client/);
    expect(src).not.toMatch(/pip-auth|document\.cookie|createBrowserSupabase/);
    expect(src).not.toMatch(/localStorage|sessionStorage/);
    expect(src).not.toMatch(/useMutation|useQuery|QueryClient|from ["']react["']/);
    expect(src).not.toMatch(/\blogger\b|\btoast\b|trackEvent|navigate/);
    expect(src).not.toMatch(/emailRedirectTo|autoRefreshToken|startAutoRefresh/);
  });
});
