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
    status: "Completed",
    blastRadius: "T2",
    problem:
      "DealChat presentation owns supabase.channel / postgres_changes lifecycle on deal_messages.",
    currentOwner: "src/components/deal-copilot/DealChat.tsx",
    targetOwner: "src/core/dealCopilot/realtime/useDealMessagesChannel.ts",
    dependencies: [],
    dependents: [],
    evidence: {
      commit: "0d6fc84",
      notes:
        "Completion Phase 11G. Implementation complete: deal_messages Realtime lifecycle ownership moved to src/core/dealCopilot/realtime/useDealMessagesChannel.ts; DealChat presentation consumes the hook. Runtime contract preserved (channel name, INSERT/postgres_changes filter, removeChannel cleanup; callback-stable). Invariant active: tests/invariants/dealchat-channel-lifecycle.invariant.test.ts (inv-dealchat-channel-lifecycle). Phase 11D independent verification PASS. Implementation commit 0d6fc84c445fe2e4b8555b0761c148313937a51f. Push completed; required CI success (CI run 30128815482: ci + invariant-tests; Security run 30128815490: gitleaks, server-only-boundary, client-bundle-secret-smoke, dependency-audit). Excluded: MessagingInbox, opportunityStore, SQL/schema/RLS, serverFns/AI. AO-1 remains Active and unaffected (C3 is one incremental step only).",
    },
  },
  {
    id: "C4",
    title: "Projects Ownership Migration",
    status: "Completed",
    blastRadius: "T3",
    problem:
      "Resolved: Project domain, store dual-path, and live client runtime were concentrated across lib/core/hooks; now pure domain + React Query ownership (C4a→C4b→C4c).",
    currentOwner:
      "src/core/projects/domain (pure) + React Query (src/hooks/useProjects, src/lib/queries/projects) + createProjectServerFn; lib/projects domain-only compat",
    targetOwner:
      "Same as currentOwner — C4a domain, C4b store relocation (historical), C4c RQ sole cache + store retirement",
    dependencies: [],
    dependents: ["C4a", "C4b", "C4c", "C5"],
    evidence: {
      commit: "6f57a02",
      notes:
        "Umbrella completed via staged seams: C4a pure domain (5b561fd); C4b projectStore ownership relocation to core (5b04d0e); C4c live hooks/RQ + store retirement + list authority (4e37136…6f57a02). Final architecture: pure Projects domain under src/core/projects/domain; product list/detail via projectKeys + projectsListQueryOptions/projectQueryOptions; create via createProjectServerFn; no Projects singleton store; lib/projects domain-only. C5 Photos/Storage is a separate Planned candidate — C4 completion does not complete C5, photoStore, media RLS, or storage paths. Deferred outside C4: optional stage hardening, full auth unification, mutation-cache isolation, browser E2E.",
    },
  },
  {
    id: "C4a",
    title: "Projects Domain Types & Pure Helpers",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "Project domain types/constants/pure helpers were co-defined with browser projectStore in src/lib/projects.",
    currentOwner:
      "src/core/projects/domain (pure; historical phase also left store on lib/projects until C4b/C4c-5)",
    targetOwner: "src/core/projects/domain (re-exports @repo/types + pure helpers)",
    dependencies: ["C4"],
    dependents: ["C4b", "C4c"],
    evidence: {
      commit: "5b561fd",
      notes:
        "Completion Phase 12G. Implementation complete: pure Projects domain at src/core/projects/domain (types/constants re-export @repo/types; estimatedRefurbCost/estimatedProfit helpers; barrel index). At C4a close, lib/projects remained store + compatibility re-export with projectStore body preserved (store retirement is C4c-5, not C4a). Domain invariant active: tests/invariants/projects-domain-purity.invariant.test.ts. Phase 12D independent verification PASS. Implementation commit 5b561fdaa34b7d9693142f6e056f85e89f775017 (24 files). Push Phase 12F: de6295a..5b561fd main -> main. Required CI success (CI run 30131858639; Security 30131858614). Supabase Preview external non-required. Excludes: projectStore redesign (C4b), useProjects behaviour (C4c), Photos/C5, SQL/schema/RLS. Historical: C4 umbrella was still Planned at C4a close; later completed with C4c.",
    },
  },
  {
    id: "C4b",
    title: "Project Store Ownership / Deprecation",
    status: "Completed",
    blastRadius: "T2",
    problem:
      "Browser projectStore lived in src/lib/projects with dual cache vs React Query (phase problem at C4b start).",
    currentOwner:
      "Historical phase target was src/core/projects/projectStore.ts; store runtime later deleted by C4c-5 — no current projectStore owner",
    targetOwner:
      "Historical: core projectStore + lib re-export only. Superseded: C4c-5 retired the store; live cache is React Query only",
    dependencies: ["C4a"],
    dependents: ["C4c"],
    evidence: {
      commit: "5b04d0e",
      notes:
        "Completion Phase 13G. Ownership inversion complete for that phase: projectStore runtime body lived only in src/core/projects/projectStore.ts; src/lib/projects.ts re-export-only (domain + store). No dual store instance; no reverse core→@/lib/projects edge. Behaviour-preserving relocation (import-path adjustments only). This phase did not delete the store — deletion is C4c-5 (b0455b0). Domain purity + store ownership invariant evolved with C4c-5 retirement. Implementation commit 5b04d0ef1c7769d01d8ae4ddd1babf1baea1d4af. Push Phase 13F: f76ef73..5b04d0e. Required CI success (CI 30133888553; Security 30133888444). Excludes at phase close: hooks/RQ convergence (C4c), Photos/C5, SQL/schema/RLS. Historical sequence only.",
    },
  },
  {
    id: "C4c",
    title: "Live Project Hooks & Runtime Ownership",
    status: "Completed",
    blastRadius: "T2",
    problem:
      "Resolved: dual Projects client paths (store + RQ), non-canonical detail/list ownership, dual list keys, and missing identity-boundary query isolation.",
    currentOwner:
      "React Query sole Projects client cache: src/hooks/useProjects + src/lib/queries/projects (projectKeys, projectsListQueryOptions, projectQueryOptions); createProjectServerFn; root applyAuthQueryCacheTransition; useProjectCatalog presentation adapter",
    targetOwner:
      "Same as currentOwner — hooks + RQ sole cache; projectKeys.all list; projectKeys.byId detail; catalog adapter; no projectStore",
    dependencies: ["C4a"],
    dependents: ["C5"],
    evidence: {
      commit: "6f57a02",
      notes:
        'C4c Completed. Final definition: all live Projects client reads/mutations use canonical React Query hooks and projectKeys; ProjectStore removed; product list consumers share one query authority; identity-boundary cache isolation enforced; compatibility surfaces expose no mutable Projects store APIs; create uses createProjectServerFn; remaining auth platform, Photos/Storage (C5), optional stage hardening, mutation-cache isolation, and browser E2E are outside C4c. Phases: C4c-1 (4e37136) projectKeys.all list baseline; C4c-2 (3b544d7) useProject → projectQueryOptions/byId; C4c-3 (b154abd) list/detail mutation sync (create seeds byId + exact list invalidate; stage dual-cache optimism); C4c-4 (cf62a20) root auth/query-cache lifecycle isolation; C4c-5 (b0455b0) projectStore + store helpers retired; C4c-6 (6f57a02) projectsListQueryOptions sole list authority, useProjectCatalog adapter, ["project-catalog"] removed. Architecture: projectKeys.all sole product list key; projectsListQueryOptions()/fetchProjectsList sole full-list authority; projectQueryOptions/byId detail; stage mutates canonical list+detail RQ caches (browser Supabase write retained); auth-boundary non-auth purge via AuthProvider bridge. Deferred non-blocking: optional stage onSuccess/serverFn (C4c-7 never required); broader rename-resistant list enforcement; browser create-to-Analyze E2E. Out of scope (not claimed): full auth unification, mutation-cache isolation, photoStore/C5, SQL/schema/RLS. Invariants: inv-projects-query-keys, inv-projects-domain-purity, inv-auth-query-cache-lifecycle. Remote: C4c-6E CI/Security/Pages/Vercel success on 6f57a02; Supabase Preview external non-blocking.',
    },
  },
  {
    id: "C5",
    title: "Photos / Storage Ownership Migration",
    status: "In Progress",
    blastRadius: "T3",
    problem:
      "src/lib/photos mixed with ai-upload and UI consumers; dual photo list reads (RQ product UI vs photoStore.list for AI); dual upload writers (hooks vs BulkPhotoUpload); object storage concerns split.",
    currentOwner:
      "Product-UI + AI source-photo list: photosQueryOptions / fetchProjectPhotosList / projectKeys.photosByProject (C5-1/C5-2). Writes + memory: photoStore + BulkPhotoUpload (C5-3).",
    targetOwner:
      "Clear media ownership: single product-UI list authority (C5-1 done); AI catalog on same fetch (C5-2 done); unified write path (C5-3); retire photoStore + Projects barrel photo re-exports; optional storage/server hardening",
    dependencies: ["C4", "C4c"],
    dependents: [],
    evidence: {
      productionImporters: 9,
      notes:
        "C5 In Progress. C5-1: authenticated product-UI photo list sealed — projectKeys.photosByProject; photosQueryOptions; fetchProjectPhotosList; usePhotos + route prefetch/fetchQuery; inv-photos-query-keys. C5-2: AI source-photo list reads converged — BrowserPhotoCatalogRepository.listPhotos and room-analysis runMock/buildFromProjectPhotos use fetchProjectPhotosList; PhotoCatalogPort.listPhotos is async; makeAnalyzePhotos awaits catalog; zero production photoStore.list call sites outside store definition. Claim is list-read convergence only — not write convergence or photoStore retirement. Pending: C5-3 upload/delete convergence (photoStore + BulkPhotoUpload); later store auth-listener cleanup, photoStore retirement, Projects barrel photo re-export retirement, optional storage/server hardening. Out of scope: SQL/RLS rewrite, public gallery merge, photo-analysis key consolidation, photos_done. C4/C4c remain Completed. C5 is not complete.",
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
    status: "Completed",
    blastRadius: "T1",
    problem: "External imports of @/features/ai-upload/infrastructure (e.g. analysisStore).",
    currentOwner: "ai-upload infrastructure barrel consumers",
    targetOwner: "@/features/ai-upload public API",
    dependencies: ["C2"],
    dependents: [],
    evidence: {
      commit: "9055a09",
      productionImporters: 0,
      notes:
        "Completion Phase 10F. Implementation commit 9055a090efb83614621031124bc1ef43967fb9be. Baseline external importers 2 → 0. Public API re-exports browser-safe infrastructure; server-only Vision adapters excluded. Invariant: tests/invariants/ai-upload-public-api.invariant.test.ts. CI: workflow CI run 30114102808 success (ci + invariant-tests); Security run 30114102803 success (gitleaks, server-only-boundary, client-bundle-secret-smoke, dependency-audit). Vercel deployment status success. Pages build success. Supabase Preview external check failed (postgres dial timeout; not a repo workflow; branch unprotected; no schema change in C7) — non-blocking for C7 architecture seal.",
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
