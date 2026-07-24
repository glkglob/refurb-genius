/**
 * Living Architecture Migration Register — single source of truth (Phase 9).
 *
 * Status vocabulary: Proposed | Planned | Selected | In Progress | Completed | Deferred | Cancelled | Reclassified
 * Scoring: candidate-scoring.ts (frozen)
 *
 * Evidence overrides this file when implementation reality differs; update status after each phase.
 */

export type {
  ArchitectureObjective,
  BlastRadiusTier,
  MigrationCandidate,
  MigrationCandidateStatus,
} from "./migration-register.types.ts";

import type { ArchitectureObjective, MigrationCandidate } from "./migration-register.types.ts";

export const MIGRATION_REGISTER_META = {
  lastUpdated: "2026-07-24",
  phase: 9,
  purpose: "living-architecture-migration-register",
  scoringSourceOfTruth: "tests/invariants/config/candidate-scoring.ts",
  policySourceOfTruth: "docs/architecture/overview.md",
} as const;

export const MIGRATION_CANDIDATES: MigrationCandidate[] = [
  {
    id: "C1",
    title: "Trades Ownership Migration",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "Trades marketplace persistence lived under transitional src/services/trades with route deep imports.",
    currentOwner: "src/services/trades (removed)",
    targetOwner: "src/features/trades public API + infrastructure repositories",
    dependencies: [],
    dependents: ["C6"],
    evidence: {
      commit: "9d7a8d5",
      notes:
        "Phase 6 C1 closed; freeze −3; baseline −9 services/trades edges; zero legacy trades imports.",
    },
  },
  {
    id: "C2",
    title: "Estimate Public API Seal",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "Eight production modules import @/features/estimate/infrastructure instead of the feature public API.",
    currentOwner: "Consumers of estimate/infrastructure barrel",
    targetOwner: "@/features/estimate public API (re-export browser-safe infrastructure surface)",
    dependencies: [],
    dependents: ["C7"],
    evidence: {
      productionImporters: 0,
      notes:
        "Completion Phase 9C. Evidence: Phase 9A implementation; Phase 9B independent verification PASS; estimate-public-api.invariant; eight production imports migrated to @/features/estimate; zero external infrastructure imports; full validation passed.",
    },
  },
  {
    id: "C3",
    title: "DealChat Realtime Ownership",
    status: "Planned",
    blastRadius: "T2",
    problem:
      "DealChat presentation owns supabase.channel / postgres_changes lifecycle on deal_messages.",
    currentOwner: "src/components/deal-copilot/DealChat.tsx",
    targetOwner:
      "Narrow channel-lifecycle ownership (hook or assistant infrastructure — TBD at impl)",
    dependencies: [],
    dependents: [],
    evidence: {
      notes:
        "Scope narrowed to channel lifecycle only — not full Deal Copilot multi-root isolation. Realtime regression risk.",
    },
  },
  {
    id: "C4",
    title: "Projects Ownership Migration",
    status: "Planned",
    blastRadius: "T3",
    problem:
      "Project domain/persistence still concentrated in frozen src/lib/projects with multi-layer fan-out.",
    currentOwner: "src/lib/projects + core/hooks/serverFns",
    targetOwner: "Feature or staged seams (must split before execution)",
    dependencies: [],
    dependents: ["C5"],
    evidence: {
      productionImporters: 11,
      notes:
        "Split into C4a types / C4b store / C4c hooks-routes before implementation. Do not ship monolithic C4.",
    },
  },
  {
    id: "C5",
    title: "Photos / Storage Ownership Migration",
    status: "Planned",
    blastRadius: "T3",
    problem: "src/lib/photos mixed with ai-upload and UI consumers; object storage concerns split.",
    currentOwner: "src/lib/photos (+ ai-upload infrastructure partial)",
    targetOwner: "Clear media ownership (split before execution)",
    dependencies: ["C4"],
    dependents: [],
    evidence: {
      productionImporters: 9,
      notes:
        "Split C5a ai-upload ownership clarity / C5b remaining consumers. Should follow project seams.",
    },
  },
  {
    id: "C6",
    title: "Services Facade Retirement",
    status: "Completed",
    blastRadius: "T0",
    problem: "Unused src/services/projects and storage facades with zero production importers.",
    currentOwner: "src/services (retired empty freeze)",
    targetOwner: "N/A — facades deleted; live code remains lib/core/features",
    dependencies: ["C1"],
    dependents: [],
    evidence: {
      commit: "7aac73c",
      notes: "SERVICES_ALLOWLIST empty; README-only path retained for registry pathExists.",
    },
  },
  {
    id: "C7",
    title: "AI Upload Public API Seal",
    status: "In Progress",
    blastRadius: "T1",
    problem: "External imports of @/features/ai-upload/infrastructure (e.g. analysisStore).",
    currentOwner: "ai-upload infrastructure barrel consumers",
    targetOwner: "@/features/ai-upload public API",
    dependencies: ["C2"],
    dependents: [],
    evidence: {
      productionImporters: 0,
      notes:
        "Phase 10B implementation. Baseline external importers: 2 (src/core/ai/index.ts, src/features/ai-design/presentation/redesign.provider.ts) → 0. Public API: src/features/ai-upload/index.ts re-exports browser-safe infrastructure (export * from ./infrastructure; server-only Vision adapters excluded from infrastructure barrel). Invariant: tests/invariants/ai-upload-public-api.invariant.test.ts (probe-proven). Depends on C2 (Completed). Completion pending independent verification, commit, push, CI.",
    },
  },
  {
    id: "C8",
    title: "Presentation Supabase Boundary",
    status: "Reclassified",
    blastRadius: "T3",
    problem: "Many presentation/route modules import browser Supabase directly.",
    currentOwner: "mixed presentation + routes",
    targetOwner: "Superseded by AO-1 — Presentation Layer Owns No Infrastructure",
    dependencies: [],
    dependents: [],
    evidence: {
      notes:
        "Reclassified (not Cancelled). Architectural objective remains valid. Implementation strategy changed from a single migration candidate to incremental long-term objective AO-1.",
    },
  },
];

/** Architecture objectives achieved incrementally (not single migrations). */
export const ARCHITECTURE_OBJECTIVES: ArchitectureObjective[] = [
  {
    id: "AO-1",
    title: "Presentation Layer Owns No Infrastructure",
    status: "Active",
    description:
      "Presentation and routes must not own Supabase clients, channels, or persistence. Supersedes former single-migration framing of C8. Achieved via multiple focused migrations (e.g. C3 channel lifecycle), not one large refactor.",
    relatedCandidates: ["C3", "C8"],
  },
];

export function candidatesByStatus(status: MigrationCandidate["status"]): MigrationCandidate[] {
  return MIGRATION_CANDIDATES.filter((c) => c.status === status);
}
