/**
 * AO-1E1.3 — Password update Auth primitive contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const updateUser = vi.fn();

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: {
      updateUser: (...args: unknown[]) => updateUser(...args),
    },
  },
}));

import { updateAuthUserPassword } from "./updateAuthUserPassword";

const SRC = join(__dirname, "updateAuthUserPassword.ts");

beforeEach(() => {
  updateUser.mockReset();
  updateUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
});

describe("updateAuthUserPassword", () => {
  it("uses platform browser Auth client via @/platform/supabase/browser", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/@\/platform\/supabase\/browser/);
    expect(src).toMatch(/supabase\.auth\.updateUser/);
  });

  it("calls updateUser with exact password payload only", async () => {
    await updateAuthUserPassword({ password: "new-secret-12" });

    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith({ password: "new-secret-12" });
    const call = updateUser.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(call)).toEqual(["password"]);
  });

  it("throws returned Auth error unchanged", async () => {
    const err = Object.assign(new Error("weak password"), { status: 422 });
    updateUser.mockResolvedValue({ data: { user: null }, error: err });

    await expect(updateAuthUserPassword({ password: "x" })).rejects.toBe(err);
  });

  it("propagates a genuinely rejected promise", async () => {
    updateUser.mockRejectedValue(new Error("network down"));

    await expect(updateAuthUserPassword({ password: "x" })).rejects.toThrow("network down");
  });

  it("resolves on success without returning user data", async () => {
    await expect(updateAuthUserPassword({ password: "new-secret-12" })).resolves.toBeUndefined();
  });

  it("contains no window, analytics, logger, toast, navigation, QC, or validation", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bwindow\b/);
    expect(src).not.toMatch(/trackEvent|identifyAnalyticsUser/);
    expect(src).not.toMatch(/\blogger\b|\btoast\b|captureAuthError|addDiagnosticBreadcrumb/);
    expect(src).not.toMatch(/navigate|useNavigate|signOut|getSession|refreshSession/);
    expect(src).not.toMatch(/QueryClient|useQueryClient|setQueryData/);
    expect(src).not.toMatch(/localStorage|\.from\s*\(/);
    expect(src).not.toMatch(/from ["']react["']/);
    expect(src).not.toMatch(/password\.length|required/);
  });
});
