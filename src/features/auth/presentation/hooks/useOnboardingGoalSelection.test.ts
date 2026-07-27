/**
 * AO-1D2 — onboarding goal selection hook contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const writeOnboardingGoal = vi.fn();
const readOnboardingGoal = vi.fn();
const updateAuthOnboardingGoal = vi.fn();

vi.mock("../../onboardingStorage", () => ({
  writeOnboardingGoal: (...args: unknown[]) => writeOnboardingGoal(...args),
  readOnboardingGoal: (...args: unknown[]) => readOnboardingGoal(...args),
}));

vi.mock("../../infrastructure/updateAuthOnboardingGoal", () => ({
  updateAuthOnboardingGoal: (...args: unknown[]) => updateAuthOnboardingGoal(...args),
}));

import { useOnboardingGoalSelection } from "./useOnboardingGoalSelection";

const SRC = join(__dirname, "useOnboardingGoalSelection.ts");

beforeEach(() => {
  writeOnboardingGoal.mockReset();
  readOnboardingGoal.mockReset();
  updateAuthOnboardingGoal.mockReset();
  writeOnboardingGoal.mockImplementation((g: string) => {
    const trimmed = g.trim();
    return trimmed;
  });
  readOnboardingGoal.mockReturnValue("");
  updateAuthOnboardingGoal.mockResolvedValue(undefined);
});

describe("useOnboardingGoalSelection — hydration", () => {
  it("starts with empty goal and not saving", () => {
    const { result } = renderHook(() => useOnboardingGoalSelection());
    expect(result.current.onboardingGoal).toBe("");
    expect(result.current.isSaving).toBe(false);
  });

  it("hydrateOnboardingGoal reads storage and does not call Auth", () => {
    readOnboardingGoal.mockReturnValue("Run my first feasibility study");
    const { result } = renderHook(() => useOnboardingGoalSelection());

    act(() => {
      result.current.hydrateOnboardingGoal();
    });

    expect(readOnboardingGoal).toHaveBeenCalledTimes(1);
    expect(result.current.onboardingGoal).toBe("Run my first feasibility study");
    expect(updateAuthOnboardingGoal).not.toHaveBeenCalled();
    expect(writeOnboardingGoal).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });
});

describe("useOnboardingGoalSelection — non-empty selection", () => {
  it("writes storage first, updates state before Auth resolves, then clears saving", async () => {
    let resolveAuth!: () => void;
    updateAuthOnboardingGoal.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAuth = resolve;
        }),
    );
    writeOnboardingGoal.mockReturnValue("Run my first feasibility study");

    const { result } = renderHook(() => useOnboardingGoalSelection());

    let applyPromise: Promise<void>;
    act(() => {
      applyPromise = result.current.applyOnboardingGoal("  Run my first feasibility study  ");
    });

    // Storage + state before Auth completes
    expect(writeOnboardingGoal).toHaveBeenCalledWith("  Run my first feasibility study  ");
    expect(result.current.onboardingGoal).toBe("Run my first feasibility study");
    expect(result.current.isSaving).toBe(true);
    expect(updateAuthOnboardingGoal).toHaveBeenCalledWith("Run my first feasibility study");

    await act(async () => {
      resolveAuth();
      await applyPromise!;
    });

    expect(result.current.isSaving).toBe(false);
    expect(result.current.onboardingGoal).toBe("Run my first feasibility study");
  });

  it("Auth receives the trimmed value returned by storage", async () => {
    writeOnboardingGoal.mockReturnValue("trimmed-goal");
    const { result } = renderHook(() => useOnboardingGoalSelection());

    await act(async () => {
      await result.current.applyOnboardingGoal("  trimmed-goal  ");
    });

    expect(updateAuthOnboardingGoal).toHaveBeenCalledWith("trimmed-goal");
  });
});

describe("useOnboardingGoalSelection — empty selection", () => {
  it("clears storage, sets empty state, skips Auth, and leaves saving false", async () => {
    writeOnboardingGoal.mockReturnValue("");
    const { result } = renderHook(() => useOnboardingGoalSelection());

    // Seed a prior goal
    act(() => {
      result.current.hydrateOnboardingGoal();
    });
    readOnboardingGoal.mockReturnValue("prior");
    act(() => {
      result.current.hydrateOnboardingGoal();
    });
    expect(result.current.onboardingGoal).toBe("prior");

    await act(async () => {
      await result.current.applyOnboardingGoal("   ");
    });

    expect(writeOnboardingGoal).toHaveBeenCalledWith("   ");
    expect(result.current.onboardingGoal).toBe("");
    expect(updateAuthOnboardingGoal).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });
});

describe("useOnboardingGoalSelection — Auth soft failures", () => {
  it("returned { error } from primitive (resolved) keeps local value and clears saving", async () => {
    // Primitive resolves without throwing even when Auth returns { error }.
    updateAuthOnboardingGoal.mockResolvedValue(undefined);
    writeOnboardingGoal.mockReturnValue("reduce-costs");

    const { result } = renderHook(() => useOnboardingGoalSelection());

    await act(async () => {
      await result.current.applyOnboardingGoal("reduce-costs");
    });

    expect(result.current.onboardingGoal).toBe("reduce-costs");
    expect(result.current.isSaving).toBe(false);
    await expect(result.current.applyOnboardingGoal("reduce-costs")).resolves.toBeUndefined();
  });

  it("thrown Auth failure is swallowed; local value and selection retained", async () => {
    writeOnboardingGoal.mockReturnValue("reduce-costs");
    updateAuthOnboardingGoal.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useOnboardingGoalSelection());

    await act(async () => {
      await expect(result.current.applyOnboardingGoal("reduce-costs")).resolves.toBeUndefined();
    });

    expect(result.current.onboardingGoal).toBe("reduce-costs");
    expect(result.current.isSaving).toBe(false);
  });

  it("source has no toast, logger, useMutation, or QueryClient", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).not.toMatch(/toast|logger|useMutation|useQueryClient|invalidateQueries/);
    expect(src).not.toMatch(/@\/platform\/supabase/);
  });
});

describe("useOnboardingGoalSelection — ordering", () => {
  it("state is updated before Auth promise settles", async () => {
    const order: string[] = [];
    writeOnboardingGoal.mockImplementation((g: string) => {
      order.push("write");
      return g.trim();
    });
    let resolveAuth!: () => void;
    updateAuthOnboardingGoal.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          order.push("auth-started");
          resolveAuth = () => {
            order.push("auth-done");
            resolve();
          };
        }),
    );

    const { result } = renderHook(() => useOnboardingGoalSelection());

    let applyPromise: Promise<void>;
    act(() => {
      applyPromise = result.current.applyOnboardingGoal("goal-a");
    });

    // After sync portion (write + setState + setSaving), state is visible and Auth started.
    expect(result.current.onboardingGoal).toBe("goal-a");
    expect(result.current.isSaving).toBe(true);
    order.push("state-visible");
    expect(order.indexOf("write")).toBeLessThan(order.indexOf("auth-started"));
    expect(order.indexOf("write")).toBeLessThan(order.indexOf("state-visible"));

    await act(async () => {
      resolveAuth();
      await applyPromise!;
    });

    expect(order).toContain("auth-done");
    expect(result.current.isSaving).toBe(false);
  });
});
