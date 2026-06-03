# Analysis Paths Strategy

**Date:** 2026 (post auth + UI migration)
**Status:** Primary path defined; unification in progress

## Dual Paths (Current)

Refurb Genius has two complementary AI analysis implementations:

### 1. TS Server Functions (Vercel / "light / fast" path)
- Location: `src/core/ai/serverFns.ts`, `src/core/ai/server/*.server.ts` (openAiVision, openAiScopeAnalysis, openAiEstimate, openAiRedesign).
- Used by: Project photo upload flows (`useScopeAnalysis`, `useAIEstimate`, AIEstimateBuilder in `projects.$id.*` routes).
- Characteristics:
  - Synchronous `createServerFn` + direct OpenAI (gpt-4o / structured outputs).
  - Low latency, request-scoped.
  - Falls back to mocks in `core/ai/mockAnalysis.ts` on error.
  - Runs on Vercel (edge/functions).
- Best for: Instant feedback during photo upload / scope generation in active project.

### 2. Railway Python FastAPI (PRIMARY for "heavy" property/deal analysis)
- Location: `backend/main.py` (FastAPI + background tasks + OpenAI direct), `src/lib/api/railwayAnalysis.ts`, `src/hooks/useRailwayPropertyAnalysis.ts`.
- Storage: `analysis_jobs` table (Supabase, RLS by user_id).
- Used by: Currently prepared but lightly integrated (hook + api ready; see archive docs and comments).
- Characteristics:
  - Async job creation + polling (start → pending/processing → completed/failed).
  - Offloads heavy/longer-running work from Vercel.
  - Uses service-role for writes, basic JWT verification on `Authorization: Bearer` (preferred) or `X-User-Id` fallback.
  - Currently implements property intel report via gpt-4o-mini JSON (summary, estimates, findings).
- Best for: Heavy analysis (full property intel, batch deals, when photos + detailed scope/estimate/redesign combined).

**Decision (Phase 2):** Railway Python path is the **PRIMARY** for heavy property/deal analysis involving photo + scope + estimate + redesign. TS serverFns remain for **fast/light cases, previews, and fallbacks**.

## Strategy & Unification Plan

1. **Primary = Railway for heavy**:
   - New or heavy flows (esp. Deal Copilot when address/postcode + financials provided, or full project analysis) should prefer `useRailwayPropertyAnalysis` + the job model.
   - TS path used for immediate UI responsiveness (e.g. while job runs, show cached/TS light result).

2. **Fallbacks & Error Handling** (strengthened):
   - Hook supports optional `fallbackToSync` behavior (if Railway unreachable, can invoke light TS equivalent where exists).
   - Backend: always attempt JWT validation first; only use fallback X-User-Id if no/invalid token. Jobs for unauthenticated users are rejected or marked with dummy (logged).
   - On poll error/timeout in hook: surface clear error + option to retry or use TS fallback.
   - ServerFns (TS): on OpenAI failure, still return `source: "fallback"` result (never crash).

3. **Integration**:
   - Deal Copilot intake now has a "Run Heavy Property Intel (Primary Railway path)" action (when sufficient data).
   - Project photo flows keep TS for speed but can trigger a background Railway job for "full intel" enrichment.
   - Unified result shape where possible (via mappers).

4. **Auth**:
   - All Railway calls must carry the Supabase access_token (hook does via `getSession()` + forward as Bearer).
   - Backend `verify_user_from_token` (or equivalent) is the source of truth for `user_id` on jobs.

5. **Docs & Comments**:
   - This file is the single source of truth.
   - `// PRIMARY PATH` and `// FALLBACK / LIGHT` comments throughout code.
   - See also `backend/main.py` header and `src/lib/api/railwayAnalysis.ts`.

## Files to Watch

- Primary heavy: `useRailwayPropertyAnalysis`, `startAnalysis` / `pollAnalysisResult`, `backend/main.py` endpoints + `run_property_analysis`.
- Light/fast: `src/core/ai/serverFns.ts` (runScopeAnalysisServerFn etc.), `useScopeAnalysis`, `AIEstimateBuilder`.
- Deterministic (always primary, non-AI): `analyzeDeal` / pricing / ROI engines in `@repo/services` and `src/lib/deal-copilot/dealAnalysis.ts`.

## Migration Notes (for future)

- When adding photo upload to Deal Copilot or new "Property Intel" product surface, default to Railway job + optimistic TS preview.
- Eventually, the TS photo analysis serverFns can become thin wrappers that enqueue to Railway (or keep for ultra-low-latency previews only).
- Monitor costs/latency: Vercel for interactive, Railway for batch/heavy.

This strategy respects the deterministic financial authority (AI is always advisory; pricing/ROI/score engines are authoritative).

## Related

- `docs/architecture.md` (core principles)
- `CLAUDE.md` (serverFns, auth patterns)
- Previous RAILWAY_SETUP.md (archive)