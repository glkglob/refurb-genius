/**
 * Dashboard onboarding-goal selection orchestration (AO-1D2).
 *
 * Local storage write and React state update run before the best-effort
 * Auth metadata mirror. Empty goals clear local storage and skip Auth.
 * Returned Auth errors are uninspected; thrown failures are swallowed.
 */
import { useCallback, useState } from "react";
import { readOnboardingGoal, writeOnboardingGoal } from "../../onboardingStorage";
import { updateAuthOnboardingGoal } from "../../infrastructure/updateAuthOnboardingGoal";

export interface UseOnboardingGoalSelectionResult {
  onboardingGoal: string;
  isSaving: boolean;
  hydrateOnboardingGoal: () => void;
  applyOnboardingGoal: (goal: string) => Promise<void>;
}

export function useOnboardingGoalSelection(): UseOnboardingGoalSelectionResult {
  const [onboardingGoal, setOnboardingGoal] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const hydrateOnboardingGoal = useCallback(() => {
    setOnboardingGoal(readOnboardingGoal());
  }, []);

  const applyOnboardingGoal = useCallback(async (goal: string): Promise<void> => {
    const next = writeOnboardingGoal(goal);
    setOnboardingGoal(next);

    if (!next) {
      return;
    }

    setIsSaving(true);
    try {
      await updateAuthOnboardingGoal(next);
    } catch {
      // Intentionally silent for runtime parity with prior dashboard handler.
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    onboardingGoal,
    isSaving,
    hydrateOnboardingGoal,
    applyOnboardingGoal,
  };
}
