/**
 * AO-1S1 — signOutSession: exact auth.signOut delegation, no side effects.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signOut = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: {
    signOut: (...args: unknown[]) => signOut(...args),
  },
}));

import { signOutSession } from "./signOutSession";

const SRC = join(__dirname, "signOutSession.ts");

beforeEach(() => {
  signOut.mockReset();
  signOut.mockResolvedValue(undefined);
});

describe("signOutSession", () => {
  it("calls auth.signOut exactly once with no arguments", async () => {
    await signOutSession();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith();
    expect(signOut.mock.calls[0]).toEqual([]);
  });

  it("resolves void on success", async () => {
    const result = await signOutSession();
    expect(result).toBeUndefined();
  });

  it("propagates the same thrown error", async () => {
    const err = new Error("sign out failed");
    signOut.mockRejectedValue(err);

    await expect(signOutSession()).rejects.toBe(err);
  });

  it("does not pass scope or options", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/await\s+auth\.signOut\s*\(\s*\)/);
    expect(src).not.toMatch(/scope\s*:/);
    expect(src).not.toMatch(/signOut\s*\(\s*\{/);
  });

  it("does not navigate, touch QueryClient, toast, or emit product analytics", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).not.toMatch(/useNavigate|navigate\s*\(|window\.location/);
    expect(src).not.toMatch(
      /\buseQueryClient\b|\binvalidateQueries\b|\bremoveQueries\b|\bsetQueryData\b|queryClient\.clear/,
    );
    expect(src).not.toMatch(/toast|sonner/);
    expect(src).not.toMatch(/trackEvent/);
  });
});
