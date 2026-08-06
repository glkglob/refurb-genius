/**
 * P0-AUTH-1 — Email-access presentation hook contracts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sendMagicLinkEmail = vi.fn();
const requestPasswordResetEmail = vi.fn();
const updateAuthUserPassword = vi.fn();

vi.mock("../../infrastructure/sendMagicLinkEmail", () => ({
  sendMagicLinkEmail: (input: unknown) => sendMagicLinkEmail(input),
}));

vi.mock("../../infrastructure/requestPasswordResetEmail", () => ({
  requestPasswordResetEmail: (input: unknown) => requestPasswordResetEmail(input),
}));

vi.mock("../../infrastructure/updateAuthUserPassword", () => ({
  updateAuthUserPassword: (input: unknown) => updateAuthUserPassword(input),
}));

import { useAuthEmailAccess } from "./useAuthEmailAccess";

const SRC = join(__dirname, "useAuthEmailAccess.ts");
const originalLocation = window.location;

beforeEach(() => {
  sendMagicLinkEmail.mockReset();
  requestPasswordResetEmail.mockReset();
  updateAuthUserPassword.mockReset();
  sendMagicLinkEmail.mockResolvedValue(undefined);
  requestPasswordResetEmail.mockResolvedValue(undefined);
  updateAuthUserPassword.mockResolvedValue(undefined);
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, origin: "https://app.example" },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

describe("useAuthEmailAccess — magic link", () => {
  it("preserves origin and always includes flow=magiclink", async () => {
    const { result } = renderHook(() => useAuthEmailAccess());

    await act(async () => {
      await result.current.sendMagicLink("user@example.com");
    });

    expect(sendMagicLinkEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      emailRedirectTo: "https://app.example/auth/callback?flow=magiclink",
    });
  });

  it("encodes a safe internal redirect_to with flow=magiclink", async () => {
    const { result } = renderHook(() => useAuthEmailAccess());

    await act(async () => {
      await result.current.sendMagicLink("user@example.com", "/projects");
    });

    expect(sendMagicLinkEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      emailRedirectTo: "https://app.example/auth/callback?flow=magiclink&redirect_to=%2Fprojects",
    });
  });

  it("does not propagate external redirect input", async () => {
    const { result } = renderHook(() => useAuthEmailAccess());

    await act(async () => {
      await result.current.sendMagicLink("user@example.com", "https://evil.example");
    });

    expect(sendMagicLinkEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      emailRedirectTo: "https://app.example/auth/callback?flow=magiclink",
    });
  });

  it("does not propagate protocol-relative redirect input", async () => {
    const { result } = renderHook(() => useAuthEmailAccess());

    await act(async () => {
      await result.current.sendMagicLink("user@example.com", "//evil.example");
    });

    expect(sendMagicLinkEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      emailRedirectTo: "https://app.example/auth/callback?flow=magiclink",
    });
  });

  it("does not place token_hash on the initiating redirect URL", async () => {
    const { result } = renderHook(() => useAuthEmailAccess());

    await act(async () => {
      await result.current.sendMagicLink("user@example.com", "/projects");
    });

    const redirect = String(sendMagicLinkEmail.mock.calls[0]?.[0]?.emailRedirectTo ?? "");
    expect(redirect).not.toMatch(/token_hash/);
  });

  it("propagates primitive errors", async () => {
    sendMagicLinkEmail.mockRejectedValue(new Error("otp denied"));
    const { result } = renderHook(() => useAuthEmailAccess());

    await expect(
      act(async () => {
        await result.current.sendMagicLink("user@example.com");
      }),
    ).rejects.toThrow("otp denied");
  });
});

describe("useAuthEmailAccess — password reset request", () => {
  it("builds recovery callback URL exactly (unchanged)", async () => {
    const { result } = renderHook(() => useAuthEmailAccess());

    await act(async () => {
      await result.current.requestPasswordReset("user@example.com");
    });

    expect(requestPasswordResetEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      redirectTo: "https://app.example/auth/callback?type=recovery",
    });
  });

  it("propagates reset request errors", async () => {
    requestPasswordResetEmail.mockRejectedValue(new Error("reset denied"));
    const { result } = renderHook(() => useAuthEmailAccess());

    await expect(
      act(async () => {
        await result.current.requestPasswordReset("user@example.com");
      }),
    ).rejects.toThrow("reset denied");
  });
});

describe("useAuthEmailAccess — password update", () => {
  it("delegates password to updateAuthUserPassword", async () => {
    const { result } = renderHook(() => useAuthEmailAccess());

    await act(async () => {
      await result.current.updatePassword("new-secret-12");
    });

    expect(updateAuthUserPassword).toHaveBeenCalledWith({ password: "new-secret-12" });
  });

  it("propagates password update errors", async () => {
    updateAuthUserPassword.mockRejectedValue(new Error("update denied"));
    const { result } = renderHook(() => useAuthEmailAccess());

    await expect(
      act(async () => {
        await result.current.updatePassword("x");
      }),
    ).rejects.toThrow("update denied");
  });
});

describe("useAuthEmailAccess — source boundary", () => {
  it("does not log, toast, navigate, or set loading", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/sendMagicLinkEmail/);
    expect(src).toMatch(/requestPasswordResetEmail/);
    expect(src).toMatch(/updateAuthUserPassword/);
    expect(src).toMatch(/auth\/callback/);
    expect(src).toMatch(/redirect_to/);
    expect(src).toMatch(/flow/);
    expect(src).toMatch(/type=recovery/);
    expect(src).not.toMatch(/\blogger\b|\btoast\b|captureAuthError/);
    expect(src).not.toMatch(/useNavigate|navigate\s*\(/);
    expect(src).not.toMatch(/setMagicLinkLoading|setForgotPasswordLoading|setSubmitting|useState/);
    expect(src).not.toMatch(/@\/platform\/supabase/);
  });
});
