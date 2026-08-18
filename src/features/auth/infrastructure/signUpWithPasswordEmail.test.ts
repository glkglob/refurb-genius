/**
 * AO-1E1.1 — password email signup Auth primitive contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signUp = vi.fn();

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => signUp(...args),
    },
  },
}));

import { signUpWithPasswordEmail } from "./signUpWithPasswordEmail";

const SRC = join(__dirname, "signUpWithPasswordEmail.ts");

beforeEach(() => {
  signUp.mockReset();
  signUp.mockResolvedValue({
    data: {
      user: { id: "u1", email: "a@b.com" },
      session: { access_token: "t" },
    },
    error: null,
  });
});

describe("signUpWithPasswordEmail", () => {
  it("uses platform browser Auth client via @/platform/supabase/browser", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/@\/platform\/supabase\/browser/);
    expect(src).toMatch(/supabase\.auth\.signUp/);
    expect(src).not.toMatch(/getNativeSupabase|platform\/supabase\/native/);
  });

  it("calls signUp once with exact metadata keys and no emailRedirectTo", async () => {
    await signUpWithPasswordEmail({
      email: "raw@example.com",
      password: "secret12",
      fullName: "Ada Lovelace",
      companyName: "Analytical Engines Ltd",
    });

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
  });

  it("passes undefined metadata values when optional fields are omitted", async () => {
    await signUpWithPasswordEmail({
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

  it("returns user and session on success", async () => {
    const user = { id: "u1", email: "a@b.com" };
    const session = { access_token: "t" };
    signUp.mockResolvedValue({ data: { user, session }, error: null });

    const result = await signUpWithPasswordEmail({
      email: "a@b.com",
      password: "pw1234",
      fullName: "Ada",
    });
    expect(result).toEqual({ user, session });
  });

  it("throws when Auth returns { error }", async () => {
    const err = Object.assign(new Error("User already registered"), { status: 400 });
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: err,
    });

    await expect(signUpWithPasswordEmail({ email: "a@b.com", password: "pw1234" })).rejects.toThrow(
      "User already registered",
    );
  });

  it("propagates a genuinely rejected promise", async () => {
    signUp.mockRejectedValue(new Error("network down"));

    await expect(signUpWithPasswordEmail({ email: "a@b.com", password: "pw1234" })).rejects.toThrow(
      "network down",
    );
  });

  it("contains no table writes, cache, analytics, toast, navigation, or storage", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\.from\s*\(/);
    expect(src).not.toMatch(/refreshSession|getSession|getUser\s*\(/);
    expect(src).not.toMatch(/\blogger\b|\btoast\b/);
    expect(src).not.toMatch(/localStorage|markNewUserOnboarding/);
    expect(src).not.toMatch(/useMutation|useQuery|QueryClient|from ["']react["']/);
    expect(src).not.toMatch(/identifyAnalyticsUser|trackSignupCompleted|navigate/);
    expect(src).not.toMatch(/emailRedirectTo/);
  });
});
