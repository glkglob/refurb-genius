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
  lastUpdated: "2026-07-27",
  phase: 9,
  purpose: "living-architecture-migration-register",
  scoringSourceOfTruth: "tests/invariants/config/candidate-scoring.ts",
  policySourceOfTruth: "docs/architecture/overview.md",
} as const;
// AO-1G1 EstimateBuilder Save Mutation and QueryClient Ownership Extraction Completed (2e77407 + required CI)
// AO-1F1 Auth Callback Auth and QueryClient Ownership Extraction Completed (68a3eb7 + required CI)
// AO-1E1.3 AuthExperience Magic Link and Password Recovery Extraction Completed (ba442e3 + required CI)
// AO-1E1.2 AuthExperience OAuth Extraction Completed (ce4384a + required CI)
// AO-1E1.1 AuthExperience Password Credential Extraction Completed (8bdf817 + required CI)
// AO-1D2 Dashboard Onboarding Auth Extraction Completed (9b4da54 + required CI)
// C5 Photos/Storage ownership Completed (76cf1c8 + required CI)

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
    status: "Completed",
    blastRadius: "T3",
    problem:
      "src/lib/photos mixed with ai-upload and UI consumers; dual photo list reads (RQ product UI vs photoStore.list for AI); dual upload writers (hooks vs BulkPhotoUpload); object storage concerns split.",
    currentOwner:
      "Reads: fetchProjectPhotosList / photosQueryOptions / projectKeys.photosByProject (+ authorised gallery/audit readers). Writes: src/lib/photos-write.ts via hooks + BulkPhotoUpload. Types: src/lib/photos-types.ts. Helpers: formatFileSize in src/lib/file-utils.ts. List cache: React Query. Auth identity isolation: applyAuthQueryCacheTransition. photoStore and src/lib/photos.ts retired.",
    targetOwner:
      "Clear media ownership: list authority (C5-1); AI catalog (C5-2); unified writes (C5-3); photoStore + barrel retired (C5-4); optional storage/server hardening deferred as separate work",
    dependencies: ["C4", "C4c"],
    dependents: [],
    evidence: {
      commit: "76cf1c8",
      productionImporters: 0,
      notes:
        "C5 Completed. Ownership result: project-photo reads, writes, types, list-cache and Auth-transition responsibilities have explicit canonical owners. Phases: C5-1 list authority sealed (projectKeys.photosByProject + fetchProjectPhotosList + photosQueryOptions). C5-2 AI catalog + room-analysis on fetchProjectPhotosList. C5-3B1 (068f7107e0d030c4de180474b23eaed5166658d4) photos-write primitives. C5-3B2 (c967715b334798603e91158511f0fdae758e4ce1) hooks → uploadProjectPhotos/removeProjectPhoto. C5-3B3 (729be74037676ce07ae9c4ca0d1d74dc080aaa35) BulkPhotoUpload → uploadProjectPhotos; write seal. C5-4 (76cf1c8b17998efb7f8a8ee2b8a1be973d7eb4c6) ProjectPhoto → photos-types; formatFileSize → file-utils; src/lib/photos.ts deleted; photoStore + module-load Auth listener removed; Projects barrel no longer exports photoStore/ProjectPhoto/formatFileSize; PHOTOS_TABLE_ALLOWLIST without photos.ts; no-store/no-import/no-listener seals (lexical). Invariant: tests/invariants/photos-query-keys.invariant.test.ts. Remote C5-4E on 76cf1c8: CI 30193646150 success (ci + invariant-tests); Security 30193646151 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30193645902 success; Vercel success; Supabase Preview success. Out of scope (not required for C5 ownership completion): SQL/RLS rewrite, public gallery merge, photo-analysis key consolidation, photos_done, optional storage/server hardening. C4/C4c remain Completed.",
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
  {
    id: "AO-1B1",
    title: "Marketplace favorites mutation extraction",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "TradepersonCard imported platform Supabase and auth.getUser, inserted/deleted trade_favorites, and owned optimistic React Query coordination in presentation.",
    currentOwner:
      "Writes: src/lib/marketplace-write.ts (addTradeFavorite/removeTradeFavorite). Mutation + optimistic cache: useToggleTradeFavorite. Presentation: TradepersonCard via useAuth + useToggleTradeFavorite. Reads: tradeFavoritesQueryOptions / marketplaceKeys.favoritesByUser. React Query list-cache authority retained.",
    targetOwner:
      "Presentation free of Supabase for favorites; canonical write primitive + presentation-safe hook; React Query remains favorites list-cache authority",
    dependencies: ["C1", "C5"],
    dependents: [],
    evidence: {
      commit: "322156a",
      productionImporters: 0,
      notes:
        "AO-1B1 Completed. One child slice of Active AO-1 (does not complete AO-1). Implementation commit 322156a1a4162f4820b40b4348189fd94aea01eb (parent 72bec16); subject refactor(marketplace): extract favorite mutations; 12 files. Outcomes: TradepersonCard direct Supabase/auth.getUser/trade_favorites insert-delete removed; writes in marketplace-write; optimistic cancel/snapshot/rollback/exact invalidate in useToggleTradeFavorite; reads/keys tradeFavoritesQueryOptions + marketplaceKeys.favoritesByUser preserved; public props and marketplace consumers unchanged; lexical seal tests/invariants/marketplace-favorites-presentation.invariant.test.ts. Push: fast-forward origin/main to 322156a. CI on exact SHA: CI 30217079372 success (ci + invariant-tests); Security 30217079353 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30217078901 success (build/deploy/report-build-status); Vercel success; Supabase Preview success. Accepted non-blocking: multi-card snapshot rollback (F-M1), lexical invariant bypasses (F-M3), dual userId shape (F-L2). Deferred (not AO-1B1): QuoteRequestDialog, MessagingInbox Realtime, floorplan, photo-analysis, admin metrics, dashboard Auth update, Auth UI isolation.",
    },
  },
  {
    id: "AO-1B2",
    title: "Marketplace quote-request creation extraction",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "QuoteRequestDialog imports platform Supabase and auth.getUser, builds quote_requests insert payload, and owns mutation + project-scoped invalidation in presentation.",
    currentOwner:
      "Writes: src/lib/marketplace-write.ts createQuoteRequest. Mutation + exact project invalidation: useCreateQuoteRequest. Presentation: QuoteRequestDialog via useAuth + useCreateQuoteRequest (form/toasts/reset/close only). Reads: quoteRequestsByProjectQueryOptions / marketplaceKeys.quoteRequestsByProject.",
    targetOwner:
      "Presentation free of Supabase for quote create; canonical write primitive + presentation-safe hook; React Query remains project quote-list cache authority",
    dependencies: ["AO-1B1"],
    dependents: [],
    evidence: {
      commit: "fcc13b6",
      productionImporters: 0,
      notes:
        "AO-1B2 Completed. One child slice of Active AO-1 (does not complete AO-1). Implementation commit fcc13b6be7ed323f820ddb3e015e541117b06036 (parent 6dc0e4a); subject refactor(marketplace): extract quote request creation; 11 files. Outcomes: QuoteRequestDialog direct Supabase/auth.getUser/quote_requests insert/useMutation/QueryClient invalidation removed; createQuoteRequest in marketplace-write preserves project_id including empty string, status pending, title template, optional proposed_price without pence conversion; useCreateQuoteRequest owns retry:false + exact marketplaceKeys.quoteRequestsByProject invalidation when projectId truthy; public dialog props and sole marketplace consumer preserved; lexical seal tests/invariants/marketplace-quote-request-presentation.invariant.test.ts. Push: fast-forward origin/main to fcc13b6. CI on exact SHA: CI 30220461945 success (ci + invariant-tests); Security 30220461988 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30220461675 success (build/deploy/report-build-status); Vercel success; Supabase Preview success. Accepted non-blocking: lexical invariant bypasses (F-M1), jsdom price-branch gap (F-M2), dual logging (F-L1), empty project_id pre-existing FK risk (F-I1), generated-type drift cast (F-I2). Deferred: MessagingInbox send/Realtime, floorplan, photo-analysis, admin metrics, Auth UI. AO-1 remains Active; AO-1B1 remains Completed.",
    },
  },
  {
    id: "AO-1B3.1",
    title: "Marketplace message send mutation extraction",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "MessagingInbox owns trade_messages insert, auth.getUser identity, and send-mutation invalidation of marketplaceKeys.messagesByQuote in presentation; Realtime channel lifecycle is co-located but independently separable.",
    currentOwner:
      "Writes: src/lib/marketplace-write.ts sendTradeMessage. Mutation + exact messagesByQuote invalidation: useSendTradeMessage. Recipient: resolveTradeMessageRecipient (exact formula). Presentation: MessagingInbox via useAuth + hook (composer/toasts/reset). Realtime channel lifecycle extracted under AO-1B3.2 (useTradeMessagesRealtime).",
    targetOwner:
      "Canonical send write in marketplace-write; presentation-safe useSendTradeMessage hook; MessagingInbox retains composer UI/toasts; Realtime owned by AO-1B3.2 hook",
    dependencies: ["AO-1B2"],
    dependents: ["AO-1B3.2"],
    evidence: {
      commit: "fa12ccc",
      productionImporters: 0,
      notes:
        "AO-1B3.1 Completed. One child slice of Active AO-1 (does not complete AO-1 or parent AO-1B3 messaging migration). Implementation commit fa12ccc2e50d4c090b3332422d765e3b37d77522 (parent 070823a); subject refactor(marketplace): extract message send mutation; 13 files. Independent verification: PASS WITH NON-BLOCKING FINDINGS. Outcomes: MessagingInbox direct trade_messages insert and auth.getUser removed; sendTradeMessage in marketplace-write (body/recipient_id payload; no .select(); void return); useSendTradeMessage owns retry:false + exact marketplaceKeys.messagesByQuote invalidation once on success; resolveTradeMessageRecipient preserves exact formula (owner → quote.tradesperson_id profile id; other → quote.user_id); public MessagingInbox props (projectId?) and sole marketplace route consumer preserved; no success toast; error toast Failed to send message; Realtime effect intentionally remains byte-identical in MessagingInbox. Lexical seal tests/invariants/marketplace-message-send-presentation.invariant.test.ts. Push: fast-forward origin/main to fa12ccc. CI on exact SHA: CI 30223638835 success (ci + invariant-tests); Security 30223638861 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30223638396 success (build/deploy/report-build-status); Vercel success; Supabase Preview success. Accepted non-blocking: dual logging (F-L1), same-tick double-submit theory (F-L2), test gaps (F-L3), recipient profile-ID semantics (F-I1), foundation content vs body schema drift (F-I2), Realtime co-location (F-I3), Auth-loading send gate (F-I4). Deferred: MessagingInbox Realtime (AO-1B3.2), floorplan, photo-analysis, admin metrics, Auth UI. AO-1 remains Active; AO-1B1/B2 remain Completed.",
    },
  },
  {
    id: "AO-1B3.2",
    title: "Marketplace messaging Realtime lifecycle extraction",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "MessagingInbox still owns Supabase Realtime channel creation, postgres_changes INSERT subscription, messagesByQuote invalidation callback, subscription logging, and removeChannel cleanup for trade_messages.",
    currentOwner:
      "Realtime: useTradeMessagesRealtime (channel trade-messages-${id}; postgres_changes INSERT; filter quote_request_id=eq.${id}; invalidate marketplaceKeys.messagesByQuote; SUBSCRIBED log; removeChannel). Presentation: MessagingInbox retains UI, reads, send path (AO-1B3.1); no Supabase client or useQueryClient in MessagingInbox.",
    targetOwner:
      "Presentation-safe useTradeMessagesRealtime owns channel lifecycle and Realtime invalidation; MessagingInbox retains UI, reads, and send path (AO-1B3.1); no Supabase client or useQueryClient in MessagingInbox after extraction",
    dependencies: ["AO-1B3.1"],
    dependents: [],
    evidence: {
      commit: "d407cc6",
      productionImporters: 0,
      notes:
        "AO-1B3.2 Completed. One child slice of Active AO-1 (does not complete AO-1; no parent AO-1B3 entry introduced). Implementation commit d407cc602bfc433ff07706830ea398bd15ebbc88 (parent 601d8f7); subject refactor(marketplace): extract messaging realtime lifecycle; 9 files. Independent verification: PASS WITH NON-BLOCKING FINDINGS (F-L1–F-I5). Outcomes: Realtime useEffect removed from MessagingInbox; platform Supabase import and useQueryClient removed from MessagingInbox; useTradeMessagesRealtime established as canonical Realtime authority (channel trade-messages-${id}; postgres_changes INSERT; schema public; table trade_messages; filter quote_request_id=eq.${id}; invalidate marketplaceKeys.messagesByQuote; SUBSCRIBED log with selectedQuoteId metadata; removeChannel cleanup; deps [quoteRequestId, queryClient]; falsy ID → no channel); send path unchanged (AO-1B3.1); read path unchanged (tradeMessagesQueryOptions / quoteRequestsByProjectQueryOptions); public MessagingInbox contract (projectId?) and sole marketplace route consumer preserved. Lexical seal tests/invariants/marketplace-messaging-realtime-presentation.invariant.test.ts; AO-1B3.1 send invariant corrected to stop requiring Realtime ownership in MessagingInbox. Push: successful fast-forward origin/main to d407cc6. CI on exact SHA: CI 30225709375 success (ci + invariant-tests); Security 30225709386 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30225709151 success (build/deploy/report-build-status); Vercel success; Supabase Preview success (no schema/migration/RLS change). Marketplace messaging ownership workstream (send + Realtime) complete for MessagingInbox; component retains authorised UI/selection/read orchestration. Accepted non-blocking: F-L1 lexical bypasses, F-L2 theoretical late callback, F-I1 StrictMode cleanup/resubscribe, F-I2 no reconnect/retry, F-I3 unused payload removed, F-I4 logger/query baseline edges retained, F-I5 component tests mock Realtime hook. Deferred outside messaging: floorplan multi-table mutations, photo-analysis writes, admin metrics reads, dashboard onboarding Auth update, Auth presentation isolation. AO-1 remains Active; AO-1B1/B2/B3.1 remain Completed.",
    },
  },
  {
    id: "AO-1C1",
    title: "PhotoAnalysisViewer write extraction",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "PhotoAnalysisViewer owned direct Supabase UPDATE of photo_analysis_results, useMutation orchestration, and optimistic React Query patch/invalidation of photoAnalysisByProjectQueryOptions in presentation.",
    currentOwner:
      "Writes: src/lib/photo-analysis-write.ts updatePhotoAnalysisResult. Mutation + optimistic analysis cache + success-only invalidation: useUpdatePhotoAnalysisResult(projectId). Presentation: PhotoAnalysisViewer via hook (toasts/dialog/pending). Apply-to-Estimate cache extracted under AO-1C2. Reads: photoAnalysisByProjectQueryOptions / src/lib/queries/photo-analysis.ts.",
    targetOwner:
      "Canonical write primitive in photo-analysis-write; presentation-safe useUpdatePhotoAnalysisResult owns optimistic analysis cache; PhotoAnalysisViewer retains UI, toasts, dialog for analysis edit; no platform Supabase or useMutation for analysis edit in the component",
    dependencies: ["C5"],
    dependents: ["AO-1C2"],
    evidence: {
      commit: "0802bcc",
      productionImporters: 0,
      notes:
        "AO-1C1 Completed. One child slice of Active AO-1 (does not complete AO-1; no parent umbrella introduced). Implementation commit 0802bcca465703d26740d49292db7172546e072a (parent a49dd0c); subject refactor(photo-analysis): extract viewer write ownership; 12 files. Independent verification: PASS WITH NON-BLOCKING FINDINGS (F-L1–F-I5). Outcomes: direct photo_analysis_results UPDATE removed from PhotoAnalysisViewer; component edit useMutation removed; updatePhotoAnalysisResult established as canonical UPDATE authority (seven-field payload: category, condition_report, detected_defects, material_estimates, cost_suggestions, confidence_score, updated_at; .eq(id) only; no .select(); no Auth); useUpdatePhotoAnalysisResult established as canonical edit mutation and optimistic-cache authority (retry:false; cancel/snapshot/matching-row patch without optimistic updated_at; rollback; success-only invalidate photoAnalysisByProjectQueryOptions(projectId).queryKey); room/category quirk intentionally preserved (UI room field; persisted category from newData.category); exact toasts (Failed to save edits / Analysis updated) and onSettled dialog close retained in component; Apply-to-Estimate residual useQueryClient retained at completion of AO-1C1 (later extracted under AO-1C2); public props projectId/photos/analyses and sole projects.$id.index consumer unchanged. Lexical seal tests/invariants/photo-analysis-viewer-write-presentation.invariant.test.ts. Push: successful fast-forward origin/main to 0802bcc. CI on exact SHA: CI 30230258095 success (ci + invariant-tests); Security 30230258114 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30230257674 success (build/deploy/report-build-status); Vercel success; Supabase Preview success (no schema/migration/RLS change). Accepted non-blocking: F-L1–F-I5. AO-1 remains Active; AO-1B1/B2/B3.1/B3.2 remain Completed; C5 remains Completed.",
    },
  },
  {
    id: "AO-1C2",
    title: "PhotoAnalysisViewer Apply-to-Estimate Cache Extraction",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "PhotoAnalysisViewer owned useQueryClient, estimateQueryOptions, setQueryData, and invalidateQueries for Apply-to-Estimate client-only estimate cache mutation in presentation.",
    currentOwner:
      "Mapping: mapPhotoAnalysesToEstimateRooms. Cache: useApplyPhotoAnalysesToEstimate(projectId) on estimateQueryOptions(projectId).queryKey (append-only rooms; fire-and-forget invalidate). Presentation: PhotoAnalysisViewer (selection resolve, empty/success toasts, clear selection). Query key factory: estimateQueryOptions / projectKeys.estimateByProject. Estimate DB save remains EstimateBuilder / saveAIEstimate.",
    targetOwner:
      "Pure mapping helper + presentation-safe useApplyPhotoAnalysesToEstimate owns estimate cache; PhotoAnalysisViewer retains selection, toasts, and AO-1C1 edit path; no useQueryClient in PhotoAnalysisViewer",
    dependencies: ["AO-1C1", "C5"],
    dependents: [],
    evidence: {
      commit: "fe28f25",
      productionImporters: 0,
      notes:
        "AO-1C2 Completed. One child slice of Active AO-1 (does not complete AO-1; no parent umbrella introduced). Implementation commit fe28f25baaf7a20dbb443487d492dbfd5a5eb49a (parent 39b7929); subject refactor(estimate): extract photo-analysis apply cache ownership; 12 files. Independent verification: PASS WITH NON-BLOCKING FINDINGS (F-L1–F-I5). Outcomes: useQueryClient and estimateQueryOptions removed from PhotoAnalysisViewer; direct getQueryData/setQueryData/invalidateQueries removed from viewer; mapPhotoAnalysesToEstimateRooms established as pure mapping authority (category→room; General / Unspecified fallback; within-apply grouping; first-seen room order; defects then materials; crypto.randomUUID room IDs; sugg-/sugg-mat- item IDs; exact cost/quantity/category/confidence/note formulas; UUID side effect only); useApplyPhotoAnalysesToEstimate established as canonical Apply cache authority (estimateQueryOptions(projectId).queryKey only → [projects, projectId, estimate]; getQueryData once; append-only merge; truthy current preserves fields; null/undefined → { rooms }; setQueryData before void fire-and-forget invalidateQueries; no useMutation; no toast; no Auth/Supabase; no room-estimate key; returns { analysisCount, roomCount }); PhotoAnalysisViewer retains selection, empty guard (No analyses selected), success toast and description, clear selection after success, single/bulk shared applyToEstimate, AO-1C1 useUpdatePhotoAnalysisResult edit path; public props projectId/photos/analyses and sole projects.$id.index consumer unchanged; no pending state; no server/database write; append-only rooms with no existing-room name dedupe. Lexical seal tests/invariants/photo-analysis-viewer-apply-estimate-presentation.invariant.test.ts; AO-1C1 write seal retained (residual QC expectation removed only). Push: successful fast-forward origin/main to fe28f25. CI on exact SHA: CI 30245273944 success (ci + invariant-tests); Security 30245274019 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30245273257 success (build/deploy/report-build-status); Vercel success; Supabase Preview success (no schema/migration/RLS change). Accepted non-blocking: F-L1 empty bulk UI path not e2e (bar hidden when none selected), F-L2 component tests mock Apply hook, F-I1 lexical bypasses, F-I2 vestigial async removed, F-I3 explicit void invalidateQueries, F-I4 explicit mapper item/room types, F-I5 DialogContent a11y warning. Deferred outside AO-1C2: dual estimate query keys, EstimateBuilder saveAIEstimate ownership, FloorplanViewer multi-table mutations and estimate sync, admin metrics reads, dashboard onboarding Auth update, Auth presentation isolation, DealChat residual mutation/QueryClient. PhotoAnalysisViewer has no remaining direct QueryClient, Supabase, mutation, or cache infrastructure ownership. AO-1 remains Active; AO-1B1/B2/B3.1/B3.2/C1 remain Completed; C5 remains Completed.",
    },
  },
  {
    id: "AO-1D1",
    title: "Admin Metrics Read Extraction",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "Admin route owned direct platform Supabase reads for platform stats counts, seven-day activity row length, recent projects list, and users list via inline loaders and local useEffect orchestration.",
    currentOwner:
      "Reads: src/features/admin/infrastructure/adminMetricsRead.ts (fetchAdminPlatformStats / fetchAdminRecentProjects / fetchAdminUsers). Query options: adminKeys + admin*QueryOptions (mount-once). Hooks: useAdminPlatformStats, useAdminRecentProjects, useAdminUsers. Presentation: admin route maps independent query states; RequireAdmin and AIMetricsDashboard unchanged.",
    targetOwner:
      "Feature-owned admin metrics reads and three independent React Query authorities; admin route retains UI, section mapping, and RequireAdmin gate; no platform Supabase in the route",
    dependencies: ["AO-1"],
    dependents: [],
    evidence: {
      commit: "d3cab3f",
      productionImporters: 0,
      notes:
        "AO-1D1 Completed. One child slice of Active AO-1 (does not complete AO-1; no parent umbrella introduced). Implementation commit d3cab3f6c87d1778a1123a05d71b4ed03aa27642 (parent 9bf7c46); subject refactor(admin): extract metrics read ownership; 17 files. Independent verification: PASS WITH NON-BLOCKING FINDINGS (F-L1–F-I4). Outcomes: direct platform Supabase removed from admin.tsx; direct .from calls removed; inline loadPlatformStats/loadRecentProjects/loadUsers and useEffect loaders removed; logger import removed from route. fetchAdminPlatformStats established as R1–R3 read authority (projects count exact/head; profiles count exact/head; projects select id + gte created_at now−7d evaluated at call time + data?.length||0; returned PostgREST errors ignored → zeros; Promise.all concurrency). fetchAdminRecentProjects established as R4 (projects select id,name,address,status,created_at; order created_at desc; limit 5; error → logger.warn + []). fetchAdminUsers established as R5 (profiles select id,full_name,email,role,created_at; order created_at desc; limit 10; error → RLS warn + []). adminKeys established without projectKeys reuse ([admin], [admin,platform-stats], [admin,recent-projects], [admin,users]). Three independent admin*QueryOptions (retry:false; refetchOnWindowFocus:false; refetchOnReconnect:false; staleTime:Infinity; no polling). Three independent hooks (useAdminPlatformStats/useAdminRecentProjects/useAdminUsers; one useQuery each; no useQueries/useMutation/useQueryClient/combined hook). Three independent section lifecycles preserved (stats/projects/users loading/error/ready without global blocking). Soft failures remain soft; genuine thrown exceptions produce section-only error UI. Route path /admin, head Admin — Refurb Genius, labels, empty states, fallbacks, badges, toLocaleDateString, section order (Platform Stats → AI Operations → Recent Projects → Users) unchanged. RequireAdmin and parent _authed access control unchanged; AIMetricsDashboard unchanged. No writes, Auth ownership, schema, migration, RLS, or Storage change. Lexical seal tests/invariants/admin-metrics-presentation.invariant.test.ts. Push: successful fast-forward origin/main to d3cab3f. CI on exact SHA: CI 30298227222 success (ci + invariant-tests); Security 30298227253 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30298225865 success (build/deploy/report-build-status); Vercel success; Supabase Preview success (no schema/migration/RLS change). Accepted non-blocking: F-L1 internal barrels beyond root public API, F-L2 route tests mock hooks, F-L3 17-path vs provisional 14, F-I1 remount may serve RQ cache under Infinite staleTime, F-I2 lexical invariant bypasses, F-I3 threshold helper exported internally, F-I4 root barrel comment mismatch. Admin metrics read AO-1 work COMPLETE for /admin; route retains authorised presentation orchestration only. Deferred outside AO-1D1: FloorplanViewer multi-table mutations and estimate sync, dashboard onboarding Auth update, AuthExperience presentation isolation, EstimateBuilder save mutation/QueryClient, DealChat residual mutation/QueryClient, BulkPhotoUpload QueryClient invalidation, auth_.callback Auth/QueryClient, dual estimate query keys. AO-1 remains Active; AO-1B1/B2/B3.1/B3.2/C1/C2 remain Completed; C5 remains Completed.",
    },
  },
  {
    id: "AO-1D2",
    title: "Dashboard Onboarding Auth Extraction",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "Dashboard route owned direct platform Supabase Auth metadata mirror for onboarding_goal via supabase.auth.updateUser after local onboarding-goal selection.",
    currentOwner:
      "Auth mirror: src/features/auth/infrastructure/updateAuthOnboardingGoal.ts. Selection orchestration: useOnboardingGoalSelection (writeOnboardingGoal first, then Auth). Storage: onboardingStorage.ts. Presentation: dashboard route retains card, select, mount consume/hydrate, and UI.",
    targetOwner:
      "Feature-owned Auth metadata mirror and presentation hook; dashboard retains UI, new-user card, first-study hydration, and local mount orchestration; no platform Supabase in the route",
    dependencies: ["AO-1"],
    dependents: [],
    evidence: {
      commit: "9b4da54",
      productionImporters: 0,
      notes:
        "AO-1D2 Completed. One child slice of Active AO-1 (does not complete AO-1; no parent umbrella introduced). Implementation commit 9b4da54e5080de71361afa2b725e667fa7d627cc (parent fb3ec89); subject refactor(auth): extract dashboard onboarding goal mirror; 11 files. Independent verification: PASS WITH NON-BLOCKING FINDINGS (F-L1–F-I4). Outcomes: direct platform Supabase removed from dashboard.tsx; direct supabase.auth ownership removed; direct auth.updateUser removed; route-owned onboarding_goal Auth payload removed. updateAuthOnboardingGoal established as Auth metadata mirror authority (client @/platform/supabase/browser; method supabase.auth.updateUser; payload { data: { onboarding_goal: goal } } only; returned Auth errors uninspected; genuine rejections propagate; no metadata read/spread; no session/profile refresh; no React/localStorage/QueryClient/toast/logger/database). useOnboardingGoalSelection established as onboarding selection orchestration authority (onboardingGoal + isSaving; hydrateOnboardingGoal local-only; applyOnboardingGoal: writeOnboardingGoal → setOnboardingGoal → empty return skips Auth → non-empty setIsSaving true → await updateAuthOnboardingGoal → silent catch → finally setIsSaving false; local value retained on failure; no useMutation/QueryClient/invalidation/retry). onboardingStorage.ts remains localStorage authority (NEW_USER_ONBOARDING_KEY consume-once; ONBOARDING_GOAL_KEY read/write/trim; empty write clears local only; FIRST_STUDY_CELEBRATION_KEY read on dashboard). Mount remains local-only (consumeNewUserOnboarding, hydrateOnboardingGoal, first-study read; no Auth). Empty/whitespace selection clears local state and never calls Auth or clears remote metadata. Non-empty selection remains user-triggered only (select change). Dashboard route /dashboard, head Dashboard — Refurb Genius, parent _authed access, goal select/options/labels/helper/IDs/saving UX, welcome card, checklist, projects, trades feature consumption, statistics, AppLayout, and useAuth welcome display unchanged. AuthExperience, auth_.callback, sign-in/signup/OAuth/OTP/reset/password flows unchanged. No schema, migration, RLS, Storage, or generated-type change. Lexical seal tests/invariants/dashboard-onboarding-auth-presentation.invariant.test.ts. Push: successful fast-forward origin/main to 9b4da54. CI on exact SHA: CI 30305362483 success (ci + invariant-tests); Security 30305362451 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30305360729 success (build/deploy/report-build-status); Vercel success; Supabase Preview success (no schema/migration/RLS change). Accepted non-blocking: F-L1 route tests mock hook, F-L2 lexical invariant bypasses, F-L3 act() warnings from trades effects, F-I1 stable hydrate dependency, F-I2 returned-error layering, F-I3 root auth index unchanged, F-I4 primitive not root-exported. Dashboard onboarding Auth AO-1 work COMPLETE for /dashboard onboarding path; route retains authorised presentation orchestration only. Deferred outside AO-1D2: AuthExperience direct Auth ops, auth_.callback Auth/QueryClient, EstimateBuilder save mutation/QueryClient, DealChat residual mutation/QueryClient, FloorplanViewer multi-table mutations and estimate sync, BulkPhotoUpload residual QueryClient invalidation, dual estimate query keys. AO-1 remains Active; AO-1B1/B2/B3.1/B3.2/C1/C2/D1 remain Completed; C5 remains Completed.",
    },
  },
  {
    id: "AO-1E1.1",
    title: "AuthExperience Password Credential Extraction",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "AuthExperience owned direct platform Supabase Auth password sign-in (signInWithPassword) and email/password signup (signUp with full_name/company_name metadata), plus AUTH_USER_QUERY_KEY seeding, password-flow analytics, and session-present onboarding flag in the presentation component.",
    currentOwner:
      "Password Auth: src/features/auth/infrastructure/signInWithPasswordEmail.ts and signUpWithPasswordEmail.ts. Orchestration (cache seed, analytics, markNewUserOnboarding): useAuthPasswordCredentials. Presentation: AuthExperience retains validation, lockout, toast, navigation, submitting state, OAuth/OTP/recovery residuals.",
    targetOwner:
      "Feature-owned password credential Auth primitives and presentation hook; AuthExperience retains UI, validation, lockout, toast, and navigation for password flows; OAuth/OTP/recovery remain until AO-1E1.2/E1.3",
    dependencies: ["AO-1"],
    dependents: [],
    evidence: {
      commit: "8bdf817",
      productionImporters: 0,
      notes:
        "AO-1E1.1 Completed. One child slice of Active AO-1 / AuthExperience workstream AO-1E1 (does not complete AO-1 or full AuthExperience isolation; no parent AO-1E1 register entry required). Implementation commit 8bdf817a54167d6cfcb32e886b364c857ae1e09a (parent 969d8ac); subject refactor(auth): extract AuthExperience password credentials; 13 files. Independent verification: PASS WITH NON-BLOCKING FINDINGS (F-L1–F-I4). Outcomes: direct supabase.auth.signInWithPassword removed from AuthExperience; direct supabase.auth.signUp removed; AUTH_USER_QUERY_KEY setQueryData, fromSupabaseUser, markNewUserOnboarding, identifyAnalyticsUser, and trackSignupCompleted removed from component for password flows. signInWithPasswordEmail established as password sign-in Auth authority (client @/platform/supabase/browser; raw email/password; if (error) throw error; return { user }; no trim/lowercase; no QC/analytics/toast/nav/storage/tables). signUpWithPasswordEmail established as password signup Auth authority (payload options.data full_name/company_name only; no emailRedirectTo/company/role/onboarding_goal; throw returned errors; return { user, session }). useAuthPasswordCredentials established as password credential orchestration authority: sign-in order Auth → fromSupabaseUser → setQueryData(AUTH_USER_QUERY_KEY) → identifyAnalyticsUser → trackEvent user_signed_in provider email; signup order Auth → identifyAnalyticsUser → trackSignupCompleted email userId → session: markNewUserOnboarding + setQueryData then session outcome, no-session: awaiting_verification without mark/seed; rethrows for component lockout. AuthExperience retains validation (terms, password length ≥6, confirm match), MAX_ATTEMPTS=3 LOCKOUT_MS=60s rate-limit mapping, toast, destinationAfterAuth (reject /auth* → /dashboard), navigate replace true, submitting state, formDisabled omits appleLoading, verification card, modes, layout, copy, icons, accessibility. Residual OAuth signInWithOAuth Google/Apple deferred AO-1E1.2; residual signInWithOtp magic link, auth.resetPasswordForEmail, auth.updatePassword reset-mode deferred AO-1E1.3; auth_.callback separate. No schema/migration/RLS/Storage/provider/CAPTCHA change. Lexical progressive seal tests/invariants/auth-experience-password-presentation.invariant.test.ts. Push: successful fast-forward origin/main to 8bdf817. CI on exact SHA: CI 30310084621 success (ci + invariant-tests); Security 30310084630 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30310083801 success (build/deploy/report-build-status); Vercel success; Supabase Preview success (no schema/migration/RLS change). Accepted non-blocking: F-L1 component tests mock hook, F-L2 lexical invariant bypasses, F-L3 narrowed primitive result objects, F-I1 root auth index unchanged, F-I2 QueryClient removed from AuthExperience (password-only former use), F-I3 string signup outcome, F-I4 DOM email whitespace pre-existing. AUTH EXPERIENCE PASSWORD CREDENTIAL WORK COMPLETE; further password credential slice not required. Deferred: AO-1E1.2 OAuth, AO-1E1.3 magic link and recovery, auth_.callback, EstimateBuilder, DealChat, FloorplanViewer, BulkPhoto residual QC, dual estimate keys. AO-1 remains Active; AO-1B1/B2/B3.1/B3.2/C1/C2/D1/D2 remain Completed; C5 remains Completed.",
    },
  },
  {
    id: "AO-1E1.2",
    title: "AuthExperience OAuth Extraction",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "AuthExperience owned direct platform Supabase Auth OAuth initiation for Google and Apple via supabase.auth.signInWithOAuth, including callback URL construction, redirect_to query forwarding, and oauth_sign_in_initiated analytics.",
    currentOwner:
      "OAuth Auth: src/features/auth/infrastructure/startOAuthSignIn.ts. Initiation orchestration (callback URL, redirect_to, analytics): useOAuthSignIn. Presentation loading/logger/error copy/buttons: AuthExperience. Browser redirect: Supabase. Completion: auth_.callback.tsx.",
    targetOwner:
      "Feature-owned OAuth initiation primitive and presentation hook; AuthExperience retains provider loading flags, logger, error copy, and UI; callback remains separate; OTP/recovery remain until AO-1E1.3",
    dependencies: ["AO-1", "AO-1E1.1"],
    dependents: [],
    evidence: {
      commit: "ce4384a",
      productionImporters: 0,
      notes:
        "AO-1E1.2 Completed. One child slice of Active AO-1 / AuthExperience workstream AO-1E1 (does not complete AO-1 or full AuthExperience isolation; no parent AO-1E1 register entry required). Implementation commit ce4384ac1bb14cc7b0a18928db5386aabc90f084 (parent fee8f3f); subject refactor(auth): extract AuthExperience OAuth initiation; 12 files. Independent verification: PASS WITH NON-BLOCKING FINDINGS (F-L1–F-I3). Outcomes: direct supabase.auth.signInWithOAuth removed from AuthExperience; oauth_sign_in_initiated analytics removed from component. startOAuthSignIn established as Google and Apple OAuth Auth authority (client @/platform/supabase/browser; providers google|apple only; options redirectTo + queryParams; if (error) throw error; void return; no window/analytics/logger/toast/nav/QC/localStorage/tables). useOAuthSignIn established as OAuth initiation orchestration authority: callback URL ${window.location.origin}/auth/callback; redirect ? { redirect_to: redirect } : undefined (no initiation-side validation, no password /auth guard); trackEvent oauth_sign_in_initiated { provider } before startOAuthSignIn; rethrows. AuthExperience retains oauthLoading/appleLoading (success leaves true; failure clears only provider flag), formDisabled omits appleLoading (Google-pending disables form+both buttons; Apple-pending may leave Google clickable), logger [auth] google|apple auth failed with { error: String(err) }, fallback Google|Apple sign in failed., provider buttons/icons/copy. No toast, app navigation, retry, or cancellation on OAuth initiation. Browser redirect: Supabase. Code exchange, session/cache seed, redirect_to validation, post-callback navigation: auth_.callback.tsx (unchanged). Password AO-1E1.1 unchanged. Residual signInWithOtp magic link, auth.resetPasswordForEmail, auth.updatePassword reset-mode deferred AO-1E1.3; platform Supabase import retained for OTP. No schema/migration/RLS/Storage/provider/CAPTCHA/generated-type change. Lexical progressive seal tests/invariants/auth-experience-oauth-presentation.invariant.test.ts; password seal residual OAuth assertion updated to ban direct signInWithOAuth. Push: successful fast-forward origin/main to ce4384a. CI on exact SHA: CI 30312856862 success (ci + invariant-tests); Security 30312856823 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30312856350 success (build/deploy/report-build-status); Vercel success; Supabase Preview non-blocking external Postgres dial timeout (context deadline exceeded; no migration/schema/generated-type failure; no DB change in commit). Accepted non-blocking: F-L1 component tests mock useOAuthSignIn, F-L2 lexical invariant bypasses, F-L3 component coverage gaps (non-Error fallback, Apple success loading, falsy redirect, concurrency asymmetry), F-I1 trackEvent inside component try via awaited hook, F-I2 root auth index unchanged, F-I3 AO-1E1.3 and callback outside scope. AUTH EXPERIENCE OAUTH INITIATION WORK COMPLETE; further OAuth initiation slice not required. Deferred: AO-1E1.3 magic link and password recovery, auth_.callback, EstimateBuilder, DealChat, FloorplanViewer, BulkPhoto residual QC, dual estimate keys. AO-1 remains Active; AO-1E1.1 remains Completed; AO-1B1/B2/B3.1/B3.2/C1/C2/D1/D2 remain Completed; C5 remains Completed.",
    },
  },
  {
    id: "AO-1E1.3",
    title: "AuthExperience Magic Link and Password Recovery Extraction",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "AuthExperience owned residual direct platform Supabase Auth magic-link OTP (signInWithOtp), password-reset email via src/lib/auth.resetPasswordForEmail, and reset-mode password update via src/lib/auth.updatePassword, including redirect construction and presentation side effects mixed with Auth commands.",
    currentOwner:
      "Magic-link Auth: sendMagicLinkEmail. Password-reset request Auth: requestPasswordResetEmail. Password update Auth: updateAuthUserPassword. Email-access orchestration (callback URL, type=recovery redirect): useAuthEmailAccess. Presentation validation/loading/logger/toast/navigation: AuthExperience. Callback completion: auth_.callback.tsx.",
    targetOwner:
      "Feature-owned email-access Auth primitives and presentation hook; AuthExperience retains UI, validation, loading, toast, logger, and navigation; callback remains separate",
    dependencies: ["AO-1", "AO-1E1.1", "AO-1E1.2"],
    dependents: [],
    evidence: {
      commit: "ba442e3",
      productionImporters: 0,
      notes:
        "AO-1E1.3 Completed. One child slice of Active AO-1 / AuthExperience workstream AO-1E1 (does not complete AO-1 or full AuthExperience isolation; no parent AO-1E1 register entry required). Implementation commit ba442e367ffae9ac30e671a9afc9d77167fc6fe1 (parent a55a5b1); subject refactor(auth): extract AuthExperience email access flows; 17 files. Independent verification: PASS WITH NON-BLOCKING FINDINGS (F-L1–F-I4). Outcomes: direct supabase.auth.signInWithOtp removed from AuthExperience; direct resetPasswordForEmail removed; direct legacy auth.updatePassword removed; platform Supabase browser import removed from AuthExperience; @/lib/auth import removed from AuthExperience. sendMagicLinkEmail established as magic-link Auth authority (client @/platform/supabase/browser; signInWithOtp; payload { email, options: { emailRedirectTo } }; if (error) throw error; void return; no window/logger/Sentry/toast/nav/QC/tables). requestPasswordResetEmail established as password-reset request Auth authority (resetPasswordForEmail(email, { redirectTo }); throw returned errors; void). updateAuthUserPassword established as recovery-session password-update Auth authority (updateUser({ password }); throw returned errors; void; no validation/sign-out/session refresh/cache seed). useAuthEmailAccess established as email-access orchestration authority: magic callback ${window.location.origin}/auth/callback; truthy redirect → redirect_to via URLSearchParams; falsy redirect → no redirect_to; recovery exact ${origin}/auth/callback?type=recovery (redirect prop not forwarded); updatePassword thin delegation; rethrows. AuthExperience retains empty-email gates (magic: Enter your email first to receive a magic link.; forgot: Enter your email first to reset your password.), magicLinkLoading/forgotPasswordLoading (finally reset on success and failure), submitting for reset branch (shared finally), formDisabled = submitting || oauthLoading || magicLinkLoading || forgotPasswordLoading (appleLoading still omitted), toast copy (Magic link sent. Check your inbox. / Password reset email sent. / Password updated. Please sign in with your new credentials.), logger [auth] magic link failed / [auth] forgot password failed with { error: String(error) }, fallbacks Could not send magic link. / Could not send reset email., reset navigate { to: /auth, search: { mode: signin, redirect }, replace: true }, reset validation quirks (email + password required only; no min length; no confirm equality), password AO-1E1.1 and OAuth AO-1E1.2 hooks. Magic success: no navigation; awaitingVerification unchanged; fields/mode unchanged. Forgot success: no navigation; mode/email unchanged. Accepted micro-deltas: primitives throw Auth errors unchanged (not lib/auth new Error wrap); helper-layer logger/Sentry/breadcrumbs no longer execute on AuthExperience reset paths; user-visible error.message parity retained. Callback auth_.callback.tsx unchanged (still owns magic code exchange, cache seed, redirect_to consumption, recovery type branch, reset-mode routing). src/lib/auth.ts unchanged (helpers remain for other legacy consumers). No schema/migration/RLS/Storage/provider/CAPTCHA/generated-type change. Lexical progressive seal tests/invariants/auth-experience-email-access-presentation.invariant.test.ts; password and OAuth residual OTP assertions updated to ban direct OTP and require useAuthEmailAccess. Push: successful fast-forward origin/main to ba442e3. CI on exact SHA: CI 30318588334 success (ci + invariant-tests); Security 30318588352 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30318587627 success (build/deploy/report-build-status); Vercel success; Supabase Preview non-blocking external Postgres dial timeout (context deadline exceeded; no migration/schema/generated-type failure; no DB change in commit). Accepted non-blocking: F-L1 component tests mock useAuthEmailAccess, F-L2 lexical invariant bypasses, F-L3 coverage gaps, F-I1 root auth index unchanged, F-I2 monitoring micro-delta accepted, F-I3 reset validation quirks preserved, F-I4 forgot-password redirect prop intentionally unused. AUTH EXPERIENCE DIRECT AUTH COMMAND EXTRACTION COMPLETE; further AuthExperience direct-command slice not required. Deferred outside AO-1E1.3: auth_.callback Auth/QueryClient ownership, EstimateBuilder save mutation/QueryClient, DealChat residual mutation/QueryClient, FloorplanViewer multi-table mutations and estimate sync, BulkPhoto residual QC, dual estimate keys, optional src/lib/auth cleanup for non-AuthExperience consumers. AO-1 remains Active; AO-1E1.1 remains Completed; AO-1E1.2 remains Completed; AO-1B1/B2/B3.1/B3.2/C1/C2/D1/D2 remain Completed; C5 remains Completed.",
    },
  },
  {
    id: "AO-1F1",
    title: "Auth Callback Auth and QueryClient Ownership Extraction",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "auth_.callback.tsx owned direct platform Supabase Auth code exchange (exchangeCodeForSession), no-code getSession, fromSupabaseUser mapping, AUTH_USER_QUERY_KEY setQueryData, redirect_to destination resolution, and success navigation in the route component.",
    currentOwner:
      "Auth exchange: exchangeAuthCode. Browser session: getBrowserAuthSession. Destination: resolveAuthCallbackDestination. Orchestration: completeAuthCallback. QueryClient seed + navigation: useAuthCallbackCompletion. Route: search validation, loading UI, error UI, effect entry.",
    targetOwner:
      "Feature-owned Auth callback primitives, pure application orchestration, and presentation hook; route retains search, loading/error presentation, and effect entry only",
    dependencies: ["AO-1", "AO-1E1.1", "AO-1E1.2", "AO-1E1.3"],
    dependents: [],
    evidence: {
      commit: "68a3eb7",
      productionImporters: 0,
      notes:
        "AO-1F1 Completed. One child slice of Active AO-1 (does not complete AO-1 or full Auth architecture; no parent umbrella introduced). Implementation commit 68a3eb77d49a86dda1594090bd712ec9a3ff2077 (parent 234a181); subject refactor(auth): extract Auth callback Auth and QueryClient ownership; 18 files. Independent verification: PASS WITH NON-BLOCKING FINDINGS (F-L1–F-I3). Outcomes: direct exchangeCodeForSession removed from auth_.callback.tsx; direct getSession removed; direct fromSupabaseUser removed; direct AUTH_USER_QUERY_KEY setQueryData removed; platform Supabase browser import removed; @/lib/auth import removed; useQueryClient removed; useNavigate success ownership removed from route. exchangeAuthCode established as authorization-code exchange Auth authority (client @/platform/supabase/browser; exchangeCodeForSession(code); if (error) throw error; return { user }; no map/QC/nav/logger). getBrowserAuthSession established as no-code browser-session authority (getSession; session → { user }; no session → null; returned error field ignored; rejections propagate). resolveAuthCallbackDestination established as destination authority (exact redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard'; preserves protocol-relative //evil.example acceptance and /auth acceptance as adjacent security/product debt). completeAuthCallback established as callback orchestration authority: urlError → errorDescription ?? urlError; no-code getBrowserAuthSession map via fromSupabaseUser; code exchange; type===recovery without mapping/seed fields; exchange failures → Error.message or Auth callback failed.; getSession rejections propagate (no catch). useAuthCallbackCompletion established as presentation seed/navigation authority: AUTH_USER_QUERY_KEY setQueryData before await navigate on authenticated (null user still seeded); recovery navigate { to: /auth, search: { mode: reset }, replace: true } without seed; error → { ok: false, error }. Route retains zod search (code, type, error, error_description, redirect_to), head Signing in…, effect entry without didRun/abort/retry/mutex, loading Completing sign in… with aria-busy/aria-live, error Authentication failed + ← Back to sign in → /auth. OAuth and magic-link completion share one path. AUTH_USER_QUERY_KEY remains @/hooks/useAuth. fromSupabaseUser remains canonical browser mapper via application (src/lib/auth.ts unchanged). Route-to-@/lib/auth legacy baseline edge retired. AuthExperience and AO-1E1.1–E1.3 unchanged. No schema/migration/RLS/Storage/provider/CAPTCHA/generated-type change. Lexical progressive seal tests/invariants/auth-callback-presentation.invariant.test.ts. Push: successful fast-forward origin/main to 68a3eb7. CI on exact SHA: CI 30387646821 success (ci + invariant-tests); Security 30387644897 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30387642336 success (build/deploy/report-build-status); Vercel success; Supabase Preview success (no DB change in commit). Local pre-push: focused 46 unit; focused inv 8; full inv 316; UI 484/68; lint/typecheck/build. Accepted non-blocking: F-L1 lexical invariant bypasses, F-L2 no dedicated route component tests, F-I1 await navigate vs original void navigate, F-I2 effect deps collapsed through complete, F-I3 dynamic destination type assertion. AUTH CALLBACK DIRECT AUTH, SESSION, CACHE, MAPPER, AND SUCCESS-NAVIGATION EXTRACTION COMPLETE; further callback direct-ownership slice not required. Adjacent unrepaired: protocol-relative open-redirect acceptance, callback/AuthExperience redirect-rule split, recovery no AUTH_USER_QUERY_KEY seed, forgot-password redirect not forwarded, getSession rejection uncaught, no StrictMode idempotency. Deferred outside AO-1F1: EstimateBuilder save mutation/QueryClient, DealChat residual mutation/QueryClient, FloorplanViewer multi-table mutations and estimate sync, BulkPhoto residual QC, dual estimate keys, optional src/lib/auth cleanup. AO-1 remains Active; AO-1E1.1 remains Completed; AO-1E1.2 remains Completed; AO-1E1.3 remains Completed; AO-1B1/B2/B3.1/B3.2/C1/C2/D1/D2 remain Completed; C5 remains Completed.",
    },
  },
  {
    id: "AO-1G1",
    title: "Extract EstimateBuilder Save Mutation and QueryClient Ownership",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "EstimateBuilder owned direct useMutation, useQueryClient, saveAIEstimate invocation, one-shot estimate cache seed (getQueryData), optimistic setQueryData/rollback, estimate and financials invalidation, save toasts, and draft localStorage cleanup mixed into the presentation component.",
    currentOwner:
      "Save-input mapping: buildEstimateBuilderSaveInput. Manual-save mutation + product estimate cache + toasts + draft clear + onSaved: useSaveEstimateBuilder. Persistence: saveAIEstimate (unchanged). Product estimate key: estimateQueryOptions / projectKeys.estimateByProject. Editor state, calculations, PDF, save trigger: EstimateBuilder.",
    targetOwner:
      "Feature-owned pure save-input mapper and presentation save hook; EstimateBuilder retains editor UI, calculations, PDF, and thin handleSave boundary",
    dependencies: ["AO-1", "AO-1F1"],
    dependents: [],
    evidence: {
      commit: "2e77407",
      productionImporters: 0,
      notes:
        'AO-1G1 Completed. One child slice of Active AO-1 (does not complete AO-1; does not consolidate dual estimate query keys; does not migrate AIEstimateBuilder/useSaveAIEstimate). Implementation commit 2e7740772dda7ebd045bed96c5e7ca31c7933912 (parent 7f24746); subject refactor(estimate): extract EstimateBuilder save mutation and QueryClient ownership; 11 files. Independent verification: PASS WITH NON-BLOCKING FINDINGS (F-L1–F-I3). Outcomes: direct useMutation removed from EstimateBuilder; direct useQueryClient removed; direct saveAIEstimate invocation removed; direct getQueryData/setQueryData/cancelQueries/invalidateQueries removed; direct estimateQueryOptions/projectKeys ownership removed. buildEstimateBuilderSaveInput established as pure payload authority (title `${projectName||Property} Refurbishment Estimate`; vat_rate 20; notes Manual estimate built with drag & drop builder; item labour/materials/weeks 0; is_ai_suggested false in input; totals passed through). useSaveEstimateBuilder established as canonical manual-save authority (saveAIEstimate; onMutate cancel+snapshot+optimistic product key with editor item spread + base_unit_cost; onError truthy previous rollback + toast Save failed; onSuccess estimateByProject then financialsByProject invalidate, localStorage remove estimate-draft, toast Estimate saved, onSaved; getSeededEstimate one-shot product key only; no room-estimate key). One-shot hydration preserved: draft localStorage → product estimate cache → default Kitchen template (accepted micro-delta area_sqm??undefined / name??"" / notes??undefined). Public props projectId/project/onSaved and consumers projects.$id.estimate + projects.$id.index unchanged; import @/components/EstimateBuilder retained. EstimateBuilder retains editor state, room/item CRUD, drag-and-drop, dialogs, calculations, PDF export/toasts/logger, save trigger and button UI. AIEstimateBuilder and useSaveAIEstimate unchanged; estimate repository and insert-only saveAIEstimate unchanged; dual product/AI estimate keys preserved without consolidation. Lexical seal tests/invariants/estimate-builder-save-presentation.invariant.test.ts. Legacy edge EstimateBuilder|@/lib/queries/projects retired. Push: successful fast-forward origin/main to 2e77407. CI on exact SHA: CI 30392684046 success (ci + invariant-tests); Security 30392684010 success (gitleaks, dependency-audit, server-only-boundary, client-bundle-secret-smoke); Pages 30392680800 success (build/deploy/report-build-status); Vercel success; Supabase Preview success (no schema/migration/RLS change). Local: focused 13 unit; focused inv 8; full inv 324; UI 494/70; lint/typecheck/build. Accepted non-blocking: F-L1 mapper multi-room/missing-area test gaps, F-L2 no component tests, F-L3 hydration null-coalesce micro-delta, F-I1 optimistic from mutation variables, F-I2 dead import cleanup, F-I3 dual keys and adjacent persistence quirks deferred. ESTIMATEBUILDER DIRECT SAVE MUTATION AND QUERYCLIENT OWNERSHIP EXTRACTION COMPLETE; further EstimateBuilder direct-ownership slice not required. Adjacent unrepaired: dual estimate query keys, AI save invalidates only room-estimate, draft localStorage never written, manual saves ai_generated in repository, item is_ai_suggested forced true in repository, contingency display not persisted to contingency column. Deferred outside AO-1G1: DealChat residual mutation/QueryClient, FloorplanViewer multi-table mutations and estimate sync, BulkPhoto residual QC, dual estimate keys, optional src/lib/auth cleanup. AO-1 remains Active; AO-1E1.1 remains Completed; AO-1E1.2 remains Completed; AO-1E1.3 remains Completed; AO-1F1 remains Completed; AO-1B1/B2/B3.1/B3.2/C1/C2/D1/D2 remain Completed; C5 remains Completed.',
    },
  },
  {
    id: "AO-1H1",
    title: "Extract FloorplanViewer Auth and Persistence Mutations",
    status: "Completed",
    blastRadius: "T1",
    problem:
      "FloorplanViewer owned direct auth.getUser, platform Supabase table writes for floorplan_models/annotations/measurements, Storage upload/delete orchestration, six useMutation blocks, floorplanKeys invalidations, Refresh invalidation, mutation toasts, and isUploading pending state mixed into the presentation component.",
    currentOwner:
      "Table writes: floorplanWrite. Auth + Storage orchestration + six mutations + floorplan invalidations + Refresh + mutation toasts + isUploading: useFloorplanViewerMutations. Storage helpers: @/lib/floorplan (unchanged). Estimate tag sync, estimate QueryClient, floorplan read queries, editor UI: FloorplanViewer (estimate sync deferred to AO-1H2).",
    targetOwner:
      "Feature-owned table-write primitives and presentation mutation hook; FloorplanViewer retains scene, editor state, reads, exports, validation, confirmation, and estimate tag sync until AO-1H2",
    dependencies: ["AO-1", "AO-1G1"],
    dependents: [],
    evidence: {
      commit: "b97654d",
      productionImporters: 0,
      notes:
        "AO-1H1 Completed. One child slice of Active AO-1 (does not complete AO-1; does not extract estimate tag sync; does not consolidate dual estimate query keys). Implementation commit b97654d158c8d09fc772c5bf6f304044746d4484 (parent ad21713); subject refactor(floorplan): extract viewer auth and persistence mutations; 12 files. Independent verification: PASS WITH NON-BLOCKING FINDINGS (F-L1–F-I4). Outcomes: FloorplanViewer direct auth.getUser removed from write paths; direct platform Supabase and floorplan table writes removed; direct persistence useMutation blocks removed; direct Storage mutation orchestration (uploadFloorplanModel/deleteFloorplanStorage) removed; direct floorplanKeys ownership removed. Six table-write primitives established in floorplanWrite (create/delete floorplan_models with select/single on create; create/delete floorplan_annotations; create/delete floorplan_measurements with measurement_type distance; throw Supabase errors unchanged; no Auth/React/QC/toast/logger/Storage). useFloorplanViewerMutations established as write Auth + mutation + Storage orchestration + floorplan invalidation + toast + isUploading authority. FloorplanViewer retains read query factories, estimateQueryOptions read, scene, dialogs, exports, validation, confirm, selection/UI-reset callbacks; public prop projectId and import @/components/floorplan preserved. Estimate tag sync subsequently extracted under AO-1H2. Lexical seal tests/invariants/floorplan-viewer-persistence-presentation.invariant.test.ts. Push: successful fast-forward origin/main to b97654d. CI 30399470909; Security 30399470970; Pages 30399469722; Vercel success; Supabase Preview non-blocking dial timeout. FLOORPLANVIEWER DIRECT AUTH, PERSISTENCE MUTATION, STORAGE ORCHESTRATION, AND FLOORPLAN INVALIDATION OWNERSHIP EXTRACTION COMPLETE. AO-1 remains Active; AO-1G1 remains Completed.",
    },
  },
  {
    id: "AO-1H2",
    title: "Extract FloorplanViewer Estimate Tag Sync Cache Ownership",
    status: "In Progress",
    blastRadius: "T1",
    problem:
      "FloorplanViewer owned product-estimate cache get/set/invalidate for annotation tag sync (syncTagsToEstimate), unique-label mapping, Date.now placeholder room IDs, and sync toasts mixed into the presentation component after AO-1H1 persistence extraction.",
    currentOwner:
      "Annotation-to-placeholder mapping: mapFloorplanAnnotationsToEstimateRooms. Product-estimate cache sync + toasts: useSyncFloorplanTagsToEstimate. Product estimate key: estimateQueryOptions / projectKeys.estimateByProject. Sync button, estimate/floorplan read queries, scene, dialogs, exports, validation: FloorplanViewer. Persistence mutations: useFloorplanViewerMutations (AO-1H1).",
    targetOwner:
      "Feature-owned pure mapper and presentation sync hook; FloorplanViewer retains sync trigger UI and read queries only for this concern",
    dependencies: ["AO-1", "AO-1H1"],
    dependents: [],
    evidence: {
      productionImporters: 0,
      notes:
        "AO-1H2 In Progress — implemented locally, pending independent verification. One child slice of Active AO-1 (does not complete AO-1; does not consolidate dual estimate query keys; does not introduce estimate DB write). Outcomes (local): mapFloorplanAnnotationsToEstimateRooms established as pure mapping authority (unique Set first-seen; typeof string && !!label; no trim; case-sensitive exact name compare; id fp-${now()}-${label} with now once per new room; shape {id,name,items:[]}). useSyncFloorplanTagsToEstimate established as product-estimate cache sync authority (estimateQueryOptions key only; silent empty annotations/labels; getQueryData; set truthy spread or rooms-only cold cache; void invalidateQueries; toast.info All tags already in Estimate; toast.success Synced N room tags from 3D to Estimate Builder; no useMutation/pending; no room-estimate; no financials; no saveAIEstimate). FloorplanViewer: useQueryClient and inline syncTagsToEstimate removed; Sync to Estimate button retained; useQuery(estimateQueryOptions) read retained for tag linking; H1 mutations hook unchanged. Lexical seal tests/invariants/floorplan-viewer-estimate-sync-presentation.invariant.test.ts. Legacy edge FloorplanViewer|@/lib/queries/projects retained for estimate read. No commit/push yet. AO-1 remains Active; AO-1H1 remains Completed; dual keys preserved.",
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
      "Presentation and routes must not own Supabase clients, channels, or persistence. Supersedes former single-migration framing of C8. Progressed via focused child slices (C3 channel lifecycle Completed; AO-1B1 marketplace favorites Completed at 322156a; AO-1B2 quote-request creation Completed at fcc13b6; AO-1B3.1 marketplace message send Completed at fa12ccc; AO-1B3.2 MessagingInbox Realtime lifecycle Completed at d407cc6; AO-1C1 PhotoAnalysisViewer write extraction Completed at 0802bcc; AO-1C2 PhotoAnalysisViewer Apply-to-Estimate cache extraction Completed at fe28f25; AO-1D1 Admin Metrics Read Extraction Completed at d3cab3f; AO-1D2 Dashboard Onboarding Auth Extraction Completed at 9b4da54; AO-1E1.1 AuthExperience Password Credential Extraction Completed at 8bdf817; AO-1E1.2 AuthExperience OAuth Extraction Completed at ce4384a; AO-1E1.3 AuthExperience Magic Link and Password Recovery Extraction Completed at ba442e3; AO-1F1 Auth Callback Auth and QueryClient Ownership Extraction Completed at 68a3eb7; AO-1G1 EstimateBuilder Save Mutation and QueryClient Ownership Extraction Completed at 2e77407; AO-1H1 FloorplanViewer Auth and Persistence Mutations Extraction Completed at b97654d; AO-1H2 FloorplanViewer Estimate Tag Sync Cache Extraction In Progress). Not completed by a single child slice; remaining P2 surfaces include DealChat residual mutation/QueryClient ownership, BulkPhotoUpload residual QueryClient invalidation, dual estimate query-key cleanup, and other presentation-infrastructure debt.",
    relatedCandidates: [
      "C3",
      "C8",
      "AO-1B1",
      "AO-1B2",
      "AO-1B3.1",
      "AO-1B3.2",
      "AO-1C1",
      "AO-1C2",
      "AO-1D1",
      "AO-1D2",
      "AO-1E1.1",
      "AO-1E1.2",
      "AO-1E1.3",
      "AO-1F1",
      "AO-1G1",
      "AO-1H1",
      "AO-1H2",
    ],
  },
];

export function candidatesByStatus(status: MigrationCandidate["status"]): MigrationCandidate[] {
  return MIGRATION_CANDIDATES.filter((c) => c.status === status);
}
