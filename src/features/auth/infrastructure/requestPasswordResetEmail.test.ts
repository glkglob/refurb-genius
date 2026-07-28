/**
 * AO-1E1.3 — Password-reset request Auth primitive contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const resetPasswordForEmail = vi.fn();

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmail(...args),
    },
  },
}));

import { requestPasswordResetEmail } from "./requestPasswordResetEmail";

const SRC = join(__dirname, "requestPasswordResetEmail.ts");

beforeEach(() => {
  resetPasswordForEmail.mockReset();
  resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
});

describe("requestPasswordResetEmail", () => {
  it("uses platform browser Auth client via @/platform/supabase/browser", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/@\/platform\/supabase\/browser/);
    expect(src).toMatch(/supabase\.auth\.resetPasswordForEmail/);
  });

  it("calls resetPasswordForEmail with exact email and redirectTo", async () => {
    await requestPasswordResetEmail({
      email: "user@example.com",
      redirectTo: "https://app.example/auth/callback?type=recovery",
    });

    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
      redirectTo: "https://app.example/auth/callback?type=recovery",
    });
  });

  it("throws returned Auth error unchanged", async () => {
    const err = Object.assign(new Error("reset failed"), { status: 400 });
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: err });

    await expect(
      requestPasswordResetEmail({
        email: "user@example.com",
        redirectTo: "https://app.example/auth/callback?type=recovery",
      }),
    ).rejects.toBe(err);
  });

  it("propagates a genuinely rejected promise", async () => {
    resetPasswordForEmail.mockRejectedValue(new Error("network down"));

    await expect(
      requestPasswordResetEmail({
        email: "user@example.com",
        redirectTo: "https://app.example/auth/callback?type=recovery",
      }),
    ).rejects.toThrow("network down");
  });

  it("resolves on success without returning data", async () => {
    await expect(
      requestPasswordResetEmail({
        email: "user@example.com",
        redirectTo: "https://app.example/auth/callback?type=recovery",
      }),
    ).resolves.toBeUndefined();
  });

  it("contains no window, analytics, logger, toast, navigation, or QC", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bwindow\b/);
    expect(src).not.toMatch(/trackEvent|identifyAnalyticsUser/);
    expect(src).not.toMatch(/\blogger\b|\btoast\b|captureAuthError|addDiagnosticBreadcrumb/);
    expect(src).not.toMatch(/navigate|useNavigate/);
    expect(src).not.toMatch(/QueryClient|useQueryClient|setQueryData/);
    expect(src).not.toMatch(/localStorage|\.from\s*\(/);
    expect(src).not.toMatch(/from ["']react["']/);
  });
});
