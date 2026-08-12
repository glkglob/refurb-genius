/**
 * IOS-READINESS-2B-4 — signOutNativeSession contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signOut = vi.fn();
const getNativeSupabase = vi.fn(() => ({
  auth: { signOut: (...args: unknown[]) => signOut(...args) },
}));

vi.mock("@/platform/supabase/native", () => ({
  getNativeSupabase: () => getNativeSupabase(),
}));

import { signOutNativeSession } from "./signOutNativeSession";

const SRC = join(__dirname, "signOutNativeSession.ts");

beforeEach(() => {
  signOut.mockReset();
  getNativeSupabase.mockClear();
  signOut.mockResolvedValue({ error: null });
});

describe("signOutNativeSession", () => {
  it("calls signOut with local scope exactly once", async () => {
    await signOutNativeSession();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("throws bounded error when SDK returns error", async () => {
    signOut.mockResolvedValue({ error: { message: "boom" } });
    await expect(signOutNativeSession()).rejects.toThrow(/Unable to sign out/);
  });

  it("does not use browser auth or QueryClient", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/scope:\s*["']local["']/);
    expect(src).not.toMatch(/from\s+["']@\/lib\/auth["']/);
    expect(src).not.toMatch(/signOutSession|setQueryData\s*\(/);
    expect(src).not.toMatch(/from\s+["']@tanstack\/react-query["']/);
    expect(src).toMatch(/import\(["']@\/platform\/supabase\/native["']\)/);
  });
});
