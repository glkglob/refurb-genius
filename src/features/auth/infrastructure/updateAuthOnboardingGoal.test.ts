/**
 * AO-1D2 — Auth onboarding-goal metadata mirror contracts.
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

import { updateAuthOnboardingGoal } from "./updateAuthOnboardingGoal";

const SRC = join(__dirname, "updateAuthOnboardingGoal.ts");

beforeEach(() => {
  updateUser.mockReset();
  updateUser.mockResolvedValue({ data: { user: null }, error: null });
});

describe("updateAuthOnboardingGoal", () => {
  it("uses platform browser Auth client via @/platform/supabase/browser", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/@\/platform\/supabase\/browser/);
    expect(src).toMatch(/supabase\.auth\.updateUser/);
  });

  it("calls auth.updateUser exactly once with only onboarding_goal", async () => {
    await updateAuthOnboardingGoal("reduce-costs");

    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith({
      data: {
        onboarding_goal: "reduce-costs",
      },
    });

    const payload = updateUser.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(Object.keys(payload)).toEqual(["data"]);
    expect(Object.keys(payload.data)).toEqual(["onboarding_goal"]);
  });

  it("ignores returned Auth data and resolves when data is present", async () => {
    updateUser.mockResolvedValue({
      data: { user: { id: "u1", user_metadata: { onboarding_goal: "x" } } },
      error: null,
    });

    await expect(
      updateAuthOnboardingGoal("Run my first feasibility study"),
    ).resolves.toBeUndefined();
    expect(updateUser).toHaveBeenCalledTimes(1);
  });

  it("resolves without throwing when Auth returns { error }", async () => {
    updateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "forbidden", status: 403 },
    });

    await expect(updateAuthOnboardingGoal("reduce-costs")).resolves.toBeUndefined();
    expect(updateUser).toHaveBeenCalledTimes(1);
  });

  it("propagates a genuinely rejected promise", async () => {
    updateUser.mockRejectedValue(new Error("network down"));

    await expect(updateAuthOnboardingGoal("reduce-costs")).rejects.toThrow("network down");
  });

  it("contains no table writes, session refresh, logger, or toast", () => {
    // Strip comments so docstrings do not false-positive purity bans.
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\.from\s*\(/);
    expect(src).not.toMatch(/refreshSession|getSession|getUser\s*\(/);
    expect(src).not.toMatch(/\blogger\b|\btoast\b/);
    expect(src).not.toMatch(/localStorage|writeOnboardingGoal|readOnboardingGoal/);
    expect(src).not.toMatch(/useMutation|useQuery|QueryClient|from ["']react["']/);
  });
});
