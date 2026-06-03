# Analysis Paths Strategy

**Date:** 2026 (post Railway decommissioning)
**Status:** Pure TypeScript + OpenAI is the single source of truth for all AI analysis.

## Current State: Pure TS Server Functions

All AI analysis (photo vision, scope of works, cost estimates, redesign concepts) is implemented exclusively via TanStack `createServerFn` + direct OpenAI (gpt-4o) calls in the main app.

- **Location:** `src/core/ai/serverFns.ts`, `src/core/ai/server/*.server.ts` (openAiVision, openAiScopeAnalysis, openAiEstimate, openAiRedesign).
- **Used by:** Project photo upload flows (`useScopeAnalysis`, `useAIEstimate`, AIEstimateBuilder in `projects.$id.*` routes). Deal Copilot uses `useGenerateEstimate` (native TS) for optional AI suggestions.
- **Characteristics:**
  - Synchronous `createServerFn` with Zod input validation + `requireServerAuth()`.
  - Direct fetch to OpenAI with `response_format: { type: "json_object" }` (plus Zod post-validation + coercion).
  - Retries on transient errors (via platform helpers), timeouts, structured fallbacks to mocks.
  - Strong normalization for estimates: AI suggestions blended with deterministic `@repo/services` pricing authority (`normalizeAIEstimate`).
  - Runs on Vercel (Nitro server functions).
- **Best for:** All current use cases — interactive photo analysis, scope, editable estimates, redesign. No separate backend required.

**Railway Python backend has been fully decommissioned and removed** (backend/, property-intel/, the TS railway client/hook files, dual-path conditional logic, and any VITE_API_BASE_URL usage for analysis). The former `analysis_jobs` table is legacy and no longer referenced by application code.

## Why Pure TS?

- Simpler architecture (no split deployment, no polling, no service-role bypass for AI).
- All AI behind serverFns (keys never client-side; uniform auth).
- Easier strengthening with shared validation, retry/cache, and tight integration to deterministic pricing/ROI.
- The former async "heavy" use case in Deal Copilot is now served by direct calls to `generateEstimateServerFn`.

## Integration Points

- **Projects:** Photo upload → `runPhotoAnalysisServerFn` (vision) → `runScopeAnalysisServerFn` (photo+tags → costed scope) → `generateEstimateServerFn` (or AIEstimateBuilder with normalization).
- **Deal Copilot:** Deterministic `analyzeDeal` (pricing + ROI from @repo/services) is authoritative. Optional "Run AI Property Estimate" button uses native `useGenerateEstimate` / `generateEstimateServerFn` (replaces former Railway heavy demo).
- **Reports:** Persisted AI analysis + redesign + deterministic pricing/ROI (AI only for narrative/suggestions).
- **Financial invariants:** AI never bypasses pricing engine. AI line items are normalized (category mapping + risk uplift from condition/scope) before use; ROI/score always use `runPricingEngine().mid_total`.

## Fallbacks & Error Handling

- Every server path: try/catch → classify (timeout/rate/parse/api) → counters + Sentry → safe mock/fallback result (never crashes UI).
- `source` on results: "ai" | "mock" | "fallback" | "persisted".
- Client hooks surface loading/error.
- Mocks always available (dev + no OPENAI_API_KEY).

## Related

- `docs/architecture/ai-platform.md` (detailed AI platform doc, Phase 0 historical analysis of dual-path era, current improvements)
- `CLAUDE.md` (serverFns, auth)
- `src/core/ai/` (implementation + platform helpers for validation/retry/normalize)
- Archive: `docs/archive/2026-05-legacy-ai-guidance-railway/` (historical)

This single-path strategy keeps AI advisory while strictly protecting deterministic financial authority (pricing, ROI, deal scoring).
