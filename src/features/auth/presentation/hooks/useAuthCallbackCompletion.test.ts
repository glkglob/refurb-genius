/**
 * AO-1F1 — Auth callback presentation hook contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const completeAuthCallback = vi.fn();
const setQueryData = vi.fn();
const navigate = vi.fn();

vi.mock("../../application/completeAuthCallback", () => ({
  completeAuthCallback: (input: unknown) => completeAuthCallback(input),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ setQueryData }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/hooks/useAuth", () => ({
  AUTH_USER_QUERY_KEY: ["auth", "currentUser"],
}));

import { useAuthCallbackCompletion } from "./useAuthCallbackCompletion";

const SRC = join(__dirname, "useAuthCallbackCompletion.ts");

beforeEach(() => {
  completeAuthCallback.mockReset();
  setQueryData.mockReset();
  navigate.mockReset();
  navigate.mockResolvedValue(undefined);
});

describe("useAuthCallbackCompletion", () => {
  it("seeds AUTH_USER_QUERY_KEY then navigates on authenticated result", async () => {
    const order: string[] = [];
    setQueryData.mockImplementation(() => {
      order.push("seed");
    });
    navigate.mockImplementation(async () => {
      order.push("navigate");
    });
    completeAuthCallback.mockResolvedValue({
      kind: "authenticated",
      user: { id: "u1", email: "a@b.com" },
      destination: "/projects",
    });

    const { result } = renderHook(() => useAuthCallbackCompletion());

    let outcome: { ok: true } | { ok: false; error: string } | undefined;
    await act(async () => {
      outcome = await result.current.complete({
        code: "pkce",
        redirectTo: "/projects",
      });
    });

    expect(completeAuthCallback).toHaveBeenCalledWith({
      code: "pkce",
      redirectTo: "/projects",
    });
    expect(setQueryData).toHaveBeenCalledWith(["auth", "currentUser"], {
      id: "u1",
      email: "a@b.com",
    });
    expect(navigate).toHaveBeenCalledWith({
      to: "/projects",
      replace: true,
    });
    expect(order).toEqual(["seed", "navigate"]);
    expect(outcome).toEqual({ ok: true });
  });

  it("seeds null user when mapper returned null", async () => {
    completeAuthCallback.mockResolvedValue({
      kind: "authenticated",
      user: null,
      destination: "/dashboard",
    });

    const { result } = renderHook(() => useAuthCallbackCompletion());

    await act(async () => {
      await result.current.complete({ code: "pkce" });
    });

    expect(setQueryData).toHaveBeenCalledWith(["auth", "currentUser"], null);
    expect(navigate).toHaveBeenCalledWith({
      to: "/dashboard",
      replace: true,
    });
  });

  it("navigates to reset without seeding on recovery", async () => {
    completeAuthCallback.mockResolvedValue({ kind: "recovery" });

    const { result } = renderHook(() => useAuthCallbackCompletion());

    await act(async () => {
      await result.current.complete({ code: "pkce", type: "recovery" });
    });

    expect(setQueryData).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({
      to: "/auth",
      search: { mode: "reset" },
      replace: true,
    });
  });

  it("returns error without seed or navigation on error result", async () => {
    completeAuthCallback.mockResolvedValue({
      kind: "error",
      message: "invalid grant",
    });

    const { result } = renderHook(() => useAuthCallbackCompletion());

    let outcome: { ok: true } | { ok: false; error: string } | undefined;
    await act(async () => {
      outcome = await result.current.complete({ code: "bad" });
    });

    expect(outcome).toEqual({ ok: false, error: "invalid grant" });
    expect(setQueryData).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("propagates rejected completeAuthCallback (no-code getSession parity)", async () => {
    completeAuthCallback.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useAuthCallbackCompletion());

    await expect(
      act(async () => {
        await result.current.complete({});
      }),
    ).rejects.toThrow("network down");
    expect(setQueryData).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not own toast, logger, loading state, or retry", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\blogger\b|\btoast\b/);
    expect(src).not.toMatch(/setError|Loader2|retry|AbortController|didRun/);
    expect(src).not.toMatch(/@\/platform\/supabase/);
    expect(src).not.toMatch(/exchangeCodeForSession|getSession/);
  });
});
