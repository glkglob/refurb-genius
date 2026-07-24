/**
 * Frozen candidate scoring methodology (Phase 9 programme update).
 *
 * All future reassessments MUST use these criteria and scales.
 * Do not invent alternate weight schemes without an explicit programme change.
 *
 * @see migration-register.ts
 */

/** Score each category 1–5 (higher is better for positive dimensions). */
export const SCORING_CATEGORIES = [
  {
    id: "architectural_value",
    label: "Architectural value",
    min: 1,
    max: 5,
    guide: "1 minor cleanliness · 3 meaningful ownership · 5 major structural violation removed",
  },
  {
    id: "boundary_clarity",
    label: "Boundary clarity",
    min: 1,
    max: 5,
    guide: "1 target unclear · 3 mostly clear · 5 unambiguous source and target",
  },
  {
    id: "runtime_safety",
    label: "Runtime safety",
    min: 1,
    max: 5,
    guide: "1 high behavioural risk · 3 moderate · 5 effectively runtime-neutral",
  },
  {
    id: "scope_control",
    label: "Scope control",
    min: 1,
    max: 5,
    guide: "1 broad/hard to isolate · 3 manageable · 5 narrow and independently verifiable",
  },
  {
    id: "validation_strength",
    label: "Validation strength",
    min: 1,
    max: 5,
    guide: "1 weak automated coverage · 3 partial · 5 strong tests + enforceable invariants",
  },
  {
    id: "dependency_readiness",
    label: "Dependency readiness",
    min: 1,
    max: 5,
    guide: "1 blocked by priors · 3 some prerequisites · 5 ready now",
  },
  {
    id: "migration_leverage",
    label: "Migration leverage",
    min: 1,
    max: 5,
    guide: "1 little future benefit · 3 useful local · 5 unlocks later migrations",
  },
] as const;

export type ScoringCategoryId = (typeof SCORING_CATEGORIES)[number]["id"];

/** Risk 1–5: higher = worse. Effort 1–5: higher = larger. */
export const RISK_SCALE = {
  min: 1,
  max: 5,
  guide: "1 minimal risk · 5 major regression risk",
} as const;

export const EFFORT_SCALE = {
  min: 1,
  max: 5,
  guide: "1 very small · 2 small · 3 medium · 4 large · 5 very large",
} as const;

/**
 * selectionScore = sum(positive categories) − risk − effort
 * Maximum positive sum = 35.
 */
export function selectionScore(
  positives: Record<ScoringCategoryId, number>,
  risk: number,
  effort: number,
): number {
  const sum = SCORING_CATEGORIES.reduce((acc, c) => acc + positives[c.id], 0);
  return sum - risk - effort;
}

/** Blast-radius tiers for process ceremony (meta-review). */
export const BLAST_RADIUS_TIERS = {
  T0: "Zero-importer deletes / allowlist shrink only",
  T1: "Import-path / public API seal / docs + invariant (runtime-neutral)",
  T2: "Behaviour-adjacent (realtime, auth lifecycle) — full verify + smoke",
  T3: "Multi-root ownership moves — split plan required",
} as const;
