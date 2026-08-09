/**
 * OBS-T1 — pure analytics identity transition planner.
 *
 * Distinguishes UNRESOLVED (auth not ready) from SIGNED OUT (null) and SIGNED IN (user id).
 * Callers must only invoke apply path after auth resolution; never treat initial loading as logout.
 */

export const ANALYTICS_IDENTITY_UNRESOLVED = "unresolved" as const;

/** Previous analytics identity observation. */
export type AnalyticsIdentityState = typeof ANALYTICS_IDENTITY_UNRESOLVED | string | null;

export type AnalyticsIdentityPlan =
  | { action: "noop"; next: AnalyticsIdentityState }
  | { action: "identify"; next: string; userId: string }
  | { action: "reset"; next: null }
  | { action: "reset_then_identify"; next: string; userId: string };

/**
 * Plan the next identify/reset actions for a resolved auth observation.
 *
 * @param previous - last applied analytics identity (unresolved until first settle)
 * @param nextUserId - resolved session user id, or null when signed out
 */
export function planAnalyticsIdentityTransition(
  previous: AnalyticsIdentityState,
  nextUserId: string | null,
): AnalyticsIdentityPlan {
  // First resolved observation: never reset (avoids reset on every cold load).
  if (previous === ANALYTICS_IDENTITY_UNRESOLVED) {
    if (nextUserId === null) {
      return { action: "noop", next: null };
    }
    return { action: "identify", next: nextUserId, userId: nextUserId };
  }

  if (previous === nextUserId) {
    return { action: "noop", next: previous };
  }

  // Anonymous → authenticated
  if (previous === null && nextUserId !== null) {
    return { action: "identify", next: nextUserId, userId: nextUserId };
  }

  // Authenticated → signed out
  if (previous !== null && nextUserId === null) {
    return { action: "reset", next: null };
  }

  // User A → User B (mandatory reset first)
  if (previous !== null && nextUserId !== null && previous !== nextUserId) {
    return { action: "reset_then_identify", next: nextUserId, userId: nextUserId };
  }

  return { action: "noop", next: previous };
}
