/**
 * NATIVE-AUTH-PASSWORD-1 — native password email signup primitive contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signUp = vi.fn();
const getNativeSupabase = vi.fn();

vi.mock("@/platform/supabase/native", () => ({
  getNativeSupabase: () => getNativeSupabase(),
}));

import { signUpWithPasswordEmailNative } from "./signUpWithPasswordEmailNative";

const SRC = join(__dirname, "signUpWithPasswordEmailNative.ts");

beforeEach(() => {
  signUp.mockReset();
  getNativeSupabase.mockReset();
  getNativeSupabase.mockReturnValue({
    auth: {
      signUp: (...args: unknown[]) => signUp(...args),
    },
  });
  signUp.mockResolvedValue({
    data: {
      user: { id: "u1", email: "a@b.com" },
      session: { access_token: "t" },
    },
    error: null,
  });
});

describe("signUpWithPasswordEmailNative", () => {
  it("uses getNativeSupabase().auth.signUp with exact metadata and no emailRedirectTo", async () => {
    const result = await signUpWithPasswordEmailNative({
      email: "raw@example.com",
      password: "secret12",
      fullName: "Ada Lovelace",
      companyName: "Analytical Engines Ltd",
    });

    expect(getNativeSupabase).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledWith({
      email: "raw@example.com",
      password: "secret12",
      options: {
        data: {
          full_name: "Ada Lovelace",
          company_name: "Analytical Engines Ltd",
        },
      },
    });

    const payload = signUp.mock.calls[0][0] as {
      options: { data: Record<string, unknown>; emailRedirectTo?: unknown };
    };
    expect(Object.keys(payload.options)).toEqual(["data"]);
    expect(Object.keys(payload.options.data)).toEqual(["full_name", "company_name"]);
    expect(payload.options.emailRedirectTo).toBeUndefined();
    expect(result.user).toEqual({ id: "u1", email: "a@b.com" });
    expect(result.session).toEqual({ access_token: "t" });
  });

  it("passes undefined metadata values when optional fields are omitted", async () => {
    await signUpWithPasswordEmailNative({
      email: "a@b.com",
      password: "pw1234",
    });

    expect(signUp).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "pw1234",
      options: {
        data: {
          full_name: undefined,
          company_name: undefined,
        },
      },
    });
  });

  it("returns user and null session when verification is required", async () => {
    const user = { id: "u3", email: "verify@ex.com" };
    signUp.mockResolvedValue({ data: { user, session: null }, error: null });

    const result = await signUpWithPasswordEmailNative({
      email: "verify@ex.com",
      password: "secret12",
    });
    expect(result).toEqual({ user, session: null });
  });

  it("throws returned Supabase Auth errors unchanged", async () => {
    const authError = Object.assign(new Error("User already registered"), { status: 400 });
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: authError,
    });

    await expect(
      signUpWithPasswordEmailNative({ email: "a@b.com", password: "pw1234" }),
    ).rejects.toBe(authError);
  });

  it("propagates a genuinely rejected promise", async () => {
    signUp.mockRejectedValue(new Error("network down"));

    await expect(
      signUpWithPasswordEmailNative({ email: "a@b.com", password: "pw1234" }),
    ).rejects.toThrow("network down");
  });

  it("never imports browser authority, cookies, or presentation", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/getNativeSupabase/);
    expect(src).toMatch(/auth\.signUp/);
    expect(src).not.toMatch(/platform\/supabase\/browser|platform\/supabase\/_client/);
    expect(src).not.toMatch(/pip-auth|document\.cookie|createBrowserSupabase/);
    expect(src).not.toMatch(/localStorage|sessionStorage/);
    expect(src).not.toMatch(/useMutation|useQuery|QueryClient|from ["']react["']/);
    expect(src).not.toMatch(/\blogger\b|\btoast\b|trackSignupCompleted|navigate/);
    expect(src).not.toMatch(/emailRedirectTo|autoRefreshToken|startAutoRefresh/);
  });
});
