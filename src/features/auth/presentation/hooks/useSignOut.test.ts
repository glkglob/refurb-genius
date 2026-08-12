/**
 * AO-1S1 / IOS-READINESS-2B-4 — useSignOut platform delegation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signOutSession = vi.fn();
const signOutNativeAuthIdentityFromBoundClient = vi.fn();
const isNativePlatform = vi.fn();

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("../../infrastructure/signOutSession", () => ({
  signOutSession: (...args: unknown[]) => signOutSession(...args),
}));

vi.mock("../nativeAuthIdentityLifecycle", () => ({
  signOutNativeAuthIdentityFromBoundClient: (...args: unknown[]) =>
    signOutNativeAuthIdentityFromBoundClient(...args),
}));

import { useSignOut } from "./useSignOut";

const SRC = join(__dirname, "useSignOut.ts");

beforeEach(() => {
  signOutSession.mockReset();
  signOutNativeAuthIdentityFromBoundClient.mockReset();
  isNativePlatform.mockReset();
  isNativePlatform.mockReturnValue(false);
  signOutSession.mockResolvedValue(undefined);
  signOutNativeAuthIdentityFromBoundClient.mockResolvedValue(undefined);
});

describe("useSignOut", () => {
  it("returns a callable signOut", () => {
    const { result } = renderHook(() => useSignOut());
    expect(typeof result.current.signOut).toBe("function");
  });

  it("web: delegates to signOutSession exactly once with no arguments", async () => {
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut();
    });

    expect(signOutSession).toHaveBeenCalledTimes(1);
    expect(signOutSession).toHaveBeenCalledWith();
    expect(signOutNativeAuthIdentityFromBoundClient).not.toHaveBeenCalled();
  });

  it("native: delegates to bound-client native sign-out", async () => {
    isNativePlatform.mockReturnValue(true);
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut();
    });

    expect(signOutNativeAuthIdentityFromBoundClient).toHaveBeenCalledTimes(1);
    expect(signOutSession).not.toHaveBeenCalled();
  });

  it("propagates the same thrown error", async () => {
    const err = new Error("session clear failed");
    signOutSession.mockRejectedValue(err);
    const { result } = renderHook(() => useSignOut());

    await expect(
      act(async () => {
        await result.current.signOut();
      }),
    ).rejects.toBe(err);
  });

  it("exposes no invented pending or mutation lifecycle", () => {
    const { result } = renderHook(() => useSignOut());
    expect(result.current).toEqual({ signOut: expect.any(Function) });
    expect(result.current).not.toHaveProperty("isPending");
    expect(result.current).not.toHaveProperty("mutate");
  });

  it("does not use useQueryClient, navigate, toast, or bare setQueryData", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).not.toMatch(
      /\buseMutation\b|\buseQueryClient\b|\binvalidateQueries\b|\bsetQueryData\b/,
    );
    expect(src).not.toMatch(/useNavigate|navigate\s*\(|window\.location/);
    expect(src).not.toMatch(/toast|trackEvent|auth\.signOut|@\/lib\/auth/);
    expect(src).toMatch(/signOutSession/);
    expect(src).toMatch(/signOutNativeAuthIdentityFromBoundClient/);
  });
});
