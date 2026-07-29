/**
 * AO-1S1 — useSignOut: infrastructure delegation, no navigation/QC lifecycle.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signOutSession = vi.fn();

vi.mock("../../infrastructure/signOutSession", () => ({
  signOutSession: (...args: unknown[]) => signOutSession(...args),
}));

import { useSignOut } from "./useSignOut";

const SRC = join(__dirname, "useSignOut.ts");

beforeEach(() => {
  signOutSession.mockReset();
  signOutSession.mockResolvedValue(undefined);
});

describe("useSignOut", () => {
  it("returns a callable signOut", () => {
    const { result } = renderHook(() => useSignOut());
    expect(typeof result.current.signOut).toBe("function");
  });

  it("delegates to signOutSession exactly once with no arguments", async () => {
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut();
    });

    expect(signOutSession).toHaveBeenCalledTimes(1);
    expect(signOutSession).toHaveBeenCalledWith();
  });

  it("resolves void on success", async () => {
    const { result } = renderHook(() => useSignOut());

    let settled: unknown = "unset";
    await act(async () => {
      settled = await result.current.signOut();
    });

    expect(settled).toBeUndefined();
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
    expect(result.current).not.toHaveProperty("isError");
    expect(result.current).not.toHaveProperty("error");
    expect(result.current).not.toHaveProperty("mutate");
    expect(result.current).not.toHaveProperty("mutateAsync");
    expect(result.current).not.toHaveProperty("status");
  });

  it("does not navigate, touch QueryClient, toast, or analytics", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).not.toMatch(
      /\buseMutation\b|\buseQueryClient\b|\binvalidateQueries\b|\bsetQueryData\b/,
    );
    expect(src).not.toMatch(/useNavigate|navigate\s*\(|window\.location/);
    expect(src).not.toMatch(/toast|trackEvent|auth\.signOut|@\/lib\/auth/);
    expect(src).toMatch(/signOutSession/);
  });
});
