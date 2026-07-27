/**
 * AO-1E1.1 — password email sign-in Auth primitive contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signInWithPassword = vi.fn();

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
    },
  },
}));

import { signInWithPasswordEmail } from "./signInWithPasswordEmail";

const SRC = join(__dirname, "signInWithPasswordEmail.ts");

beforeEach(() => {
  signInWithPassword.mockReset();
  signInWithPassword.mockResolvedValue({
    data: { user: { id: "u1", email: "a@b.com" }, session: {} },
    error: null,
  });
});

describe("signInWithPasswordEmail", () => {
  it("uses platform browser Auth client via @/platform/supabase/browser", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/@\/platform\/supabase\/browser/);
    expect(src).toMatch(/supabase\.auth\.signInWithPassword/);
  });

  it("calls signInWithPassword once with exact raw email and password", async () => {
    await signInWithPasswordEmail({
      email: "  User@Example.COM  ",
      password: "  secret  ",
    });

    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "  User@Example.COM  ",
      password: "  secret  ",
    });
  });

  it("returns the Auth user on success", async () => {
    const user = { id: "u1", email: "a@b.com" };
    signInWithPassword.mockResolvedValue({
      data: { user, session: { access_token: "t" } },
      error: null,
    });

    const result = await signInWithPasswordEmail({
      email: "a@b.com",
      password: "pw",
    });
    expect(result).toEqual({ user });
  });

  it("throws when Auth returns { error }", async () => {
    const err = Object.assign(new Error("Invalid login credentials"), {
      status: 400,
    });
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: err,
    });

    await expect(signInWithPasswordEmail({ email: "a@b.com", password: "bad" })).rejects.toThrow(
      "Invalid login credentials",
    );
  });

  it("propagates a genuinely rejected promise", async () => {
    signInWithPassword.mockRejectedValue(new Error("network down"));

    await expect(signInWithPasswordEmail({ email: "a@b.com", password: "pw" })).rejects.toThrow(
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
    expect(src).not.toMatch(/identifyAnalyticsUser|trackEvent|navigate/);
    expect(src).not.toMatch(/emailRedirectTo/);
  });
});
