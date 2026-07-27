/**
 * Auth onboarding-goal metadata mirror (AO-1D2).
 *
 * Best-effort user_metadata write. Returned Auth errors are intentionally
 * uninspected so callers retain the prior silent no-op behaviour.
 * Presentation-free (no React, client persistence helpers, UI feedback,
 * or session refresh).
 */
import { supabase } from "@/platform/supabase/browser";

/**
 * Mirror a non-empty onboarding goal into Supabase Auth user metadata.
 * Caller owns browser persistence and empty-goal short-circuit.
 */
export async function updateAuthOnboardingGoal(goal: string): Promise<void> {
  await supabase.auth.updateUser({
    data: {
      onboarding_goal: goal,
    },
  });
}
