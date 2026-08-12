/**
 * IOS-READINESS-2B-4 — readNativeAuthSession classification contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const getSession = vi.fn();
const getNativeSupabase = vi.fn(() => ({
  auth: { getSession: (...args: unknown[]) => getSession(...args) },
}));

vi.mock("@/platform/supabase/native", () => ({
  getNativeSupabase: () => getNativeSupabase(),
}));

import { readNativeAuthSession } from "./readNativeAuthSession";

const SRC = join(__dirname, "readNativeAuthSession.ts");

beforeEach(() => {
  getSession.mockReset();
  getNativeSupabase.mockClear();
});

describe("readNativeAuthSession", () => {
  it("returns authenticated for clean session + mappable user", async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "u1", email: "a@b.com", user_metadata: { name: "A" } },
        },
      },
      error: null,
    });
    await expect(readNativeAuthSession()).resolves.toEqual({
      kind: "authenticated",
      user: { id: "u1", email: "a@b.com", fullName: "A" },
    });
  });

  it("returns signed-out for clean null session", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(readNativeAuthSession()).resolves.toEqual({ kind: "signed-out" });
  });

  it("returns indeterminate for any getSession error including session:null", async () => {
    getSession.mockResolvedValue({
      data: { session: null },
      error: { message: "refresh failed" },
    });
    await expect(readNativeAuthSession()).resolves.toEqual({ kind: "indeterminate" });
  });

  it("returns indeterminate on throw", async () => {
    getSession.mockRejectedValue(new Error("Keychain unavailable"));
    await expect(readNativeAuthSession()).resolves.toEqual({ kind: "indeterminate" });
  });

  it("returns indeterminate when session user cannot be mapped", async () => {
    getSession.mockResolvedValue({
      data: { session: { user: null } },
      error: null,
    });
    await expect(readNativeAuthSession()).resolves.toEqual({ kind: "indeterminate" });
  });

  it("is presentation-free and lazy-loads native client", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/import\(["']@\/platform\/supabase\/native["']\)/);
    expect(src).not.toMatch(/from\s+["']@tanstack\/react-query["']/);
    expect(src).not.toMatch(/useQueryClient|setQueryData\s*\(/);
    expect(src).not.toMatch(/from\s+["']react["']/);
    expect(src).not.toMatch(/console\.(log|info|debug)/);
  });
});
