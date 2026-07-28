/**
 * AO-1E1.3 — Magic-link OTP Auth primitive contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signInWithOtp = vi.fn();

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
    },
  },
}));

import { sendMagicLinkEmail } from "./sendMagicLinkEmail";

const SRC = join(__dirname, "sendMagicLinkEmail.ts");

beforeEach(() => {
  signInWithOtp.mockReset();
  signInWithOtp.mockResolvedValue({ data: { user: null, session: null }, error: null });
});

describe("sendMagicLinkEmail", () => {
  it("uses platform browser Auth client via @/platform/supabase/browser", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/@\/platform\/supabase\/browser/);
    expect(src).toMatch(/supabase\.auth\.signInWithOtp/);
  });

  it("calls signInWithOtp with exact email and emailRedirectTo only", async () => {
    await sendMagicLinkEmail({
      email: "user@example.com",
      emailRedirectTo: "https://app.example/auth/callback?redirect_to=%2Fprojects",
    });

    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: {
        emailRedirectTo: "https://app.example/auth/callback?redirect_to=%2Fprojects",
      },
    });
    const call = signInWithOtp.mock.calls[0][0] as {
      email: string;
      options: Record<string, unknown>;
    };
    expect(Object.keys(call.options)).toEqual(["emailRedirectTo"]);
    expect(call.options).not.toHaveProperty("data");
    expect(call.options).not.toHaveProperty("shouldCreateUser");
    expect(call.options).not.toHaveProperty("captchaToken");
  });

  it("throws returned Auth error unchanged", async () => {
    const err = Object.assign(new Error("otp rate limited"), { status: 429 });
    signInWithOtp.mockResolvedValue({ data: { user: null, session: null }, error: err });

    await expect(
      sendMagicLinkEmail({
        email: "user@example.com",
        emailRedirectTo: "https://app.example/auth/callback",
      }),
    ).rejects.toBe(err);
  });

  it("propagates a genuinely rejected promise", async () => {
    signInWithOtp.mockRejectedValue(new Error("network down"));

    await expect(
      sendMagicLinkEmail({
        email: "user@example.com",
        emailRedirectTo: "https://app.example/auth/callback",
      }),
    ).rejects.toThrow("network down");
  });

  it("resolves on success without returning session data", async () => {
    await expect(
      sendMagicLinkEmail({
        email: "user@example.com",
        emailRedirectTo: "https://app.example/auth/callback",
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
