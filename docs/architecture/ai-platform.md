# AI Platform Architecture — Refurb Genius

**Date:** 2026 (post Railway decommissioning)
**Status:** Pure TypeScript serverFns + OpenAI is the single source of truth.
**Owners:** AI systems + full-stack engineering
**Related:**
- `docs/architecture/analysis-paths.md` (now pure TS)
- `CLAUDE.md` (serverFns patterns, package boundaries, never hallucinate pricing)
- `src/core/ai/` (implementation)

---

## Overview

Refurb Genius uses a pure TypeScript AI platform (no separate Python/Railway backend) for:

- Photo analysis (room type, condition, issues, recommendations via gpt-4o Vision)
- Scope of works (photo + metadata → structured issues + costed line items)
- Estimates (property details → room-by-room line items)
- Redesign concepts (style + context → palettes, materials, optional cost uplift)

All AI goes through `createServerFn` (with auth + Zod input), direct OpenAI calls (in `src/core/ai/server/*.server.ts`), strong output validation (Zod), retries, fallbacks, and normalization against the deterministic pricing engine in `@repo/services`.

**Key principle:** AI is always advisory/suggestive. Deterministic engines (`runPricingEngine`, `runRoiEngine`, `scoreDealOpportunity`) are authoritative for all financial numbers, ROI, scores, and timelines. AI estimates feed into the builder which normalizes them.

---

## Phase 0: Historical Analysis (Pre-Decommissioning Dual-Path Era)

(Archived for context — the dual-path experiment with Railway FastAPI + gpt-4o-mini for "heavy" intel and TS serverFns for interactive was fully removed.)

**Previous strengths:** Dual paths allowed offloading long jobs; good separation comments.
**Previous weaknesses:** Split deployment complexity, incomplete parity (Railway lacked full vision/scope/redesign), two result shapes, polling UX, VITE_API_BASE_URL, service role in backend, parse/coerce fragility, AI freely hallucinating unit costs without grounding, silent fallbacks, incomplete health telemetry, no image gen, no user controls.

**Decommissioning completed:** backend/, property-intel/, railwayAnalysis.ts, useRailwayPropertyAnalysis.ts, all dual-path conditionals, Railway comments in active code, and related docs references cleaned. `analysis_jobs` table is now legacy only (migration left for DB history).

See git history and `docs/archive/2026-05-legacy-ai-guidance-railway/` for old artifacts.

---

## Current TS + OpenAI Pipeline (Single Source of Truth)

### Core Files
- `src/core/ai/serverFns.ts`: createServerFn wrappers (runPhotoAnalysisServerFn, runScopeAnalysisServerFn, generateEstimateServerFn, generateRedesignConceptsServerFn) + auth + input Zod.
- `src/core/ai/server/openAiVision.server.ts`: per-photo gpt-4o Vision + SYSTEM_PROMPT with enums + timeout + classify + fallback.
- `src/core/ai/server/openAiScopeAnalysis.server.ts`: multi-photo gpt-4o → ScopeAnalysisResult (rooms, issues with severity, recommended_items with base costs).
- `src/core/ai/server/openAiEstimate.server.ts`: text gpt-4o → AIGeneratedRoom[] line items (base costs).
- `src/core/ai/server/openAiRedesign.server.ts`: text gpt-4o per style → tagline/palette/flooring/lighting/furniture + uplift.
- `src/core/ai/validation.ts` (Phase 1): shared Zod schemas + safeParse* helpers for strong post-JSON validation.
- `src/core/ai/platform/retry.ts`: withRetry for transient failures.
- `src/core/ai/normalizers.ts` (Phase 2): `normalizeAIEstimate` — maps to CATEGORY_BASE where possible, risk uplift from condition/scope criticals, clamps, warnings.
- Providers in `photoAnalysis.ts`, `redesignConcepts.ts` etc. abstract mock vs real.
- `useScopeAnalysis`, `useGenerateEstimate`, `useAIEstimate` etc. for React.

### Strengths (Current)
- Single deployment, uniform serverFns + auth.
- Output validation + retries + rich diagnostics (counters, health in admin).
- Pricing never hallucinated raw: AI suggests work/qty/notes; normalizer + `calculateLineItem` + engine provide rates + regional × condition × risk.
- Graceful fallbacks always usable; `source` tagging.
- Direct integration in builder/report (normalized results).
- Deal Copilot "AI Estimate" uses same native path.

### Error Handling / UX
- Server: timeout (60-90s), rate, parse → fallback + telemetry.
- Client: mutations expose isPending, isError, data; toasts on failure.
- No silent "AI" that is actually mock without trace (diagnostics + source badge).

---

## Phase 1-3 Work Completed (in prior increments + this cleanup)

(See previous commits for details; this task focused on final Railway removal.)

- Validation + retry platform added and wired.
- Estimate normalizer + UI feedback in AIEstimateBuilder.
- Redesign uplift support.
- Deal Copilot heavy button replaced with native `useGenerateEstimate` call (TS AI suggestion based on form data).
- All Railway files/dirs/refs/comments removed.
- Docs updated (this file + analysis-paths.md).

---

## Phase 2 Notes: Strengthening the Pipeline (Ongoing)

- Error/loading/fallback already improved (retries, classify, source tags, normalize warnings).
- AI estimates always go through normalization before affecting user-visible numbers or saved estimates that may be shown in reports.
- For future: add mode tiering, better photo context in prompts, image gen for redesign, closed feedback loop.

---

## Verification Steps Performed

- Deleted: backend/ (incl subfiles), property-intel/, src/lib/api/railwayAnalysis.ts, src/hooks/useRailwayPropertyAnalysis.ts
- Updated: DealIntakeForm (now uses native TS estimate hook), serverFns.ts (clean comment), orchestrator stub, analysis-paths.md (full rewrite), ai-platform.md (this file).
- Removed references in code/comments/docs.
- No remaining imports of old modules.
- No VITE_API_BASE_URL usage for analysis paths left in src/.

---

## Related / Future

- Full pre-commit must pass (see Phase 3).
- If analysis_jobs table cleanup desired in DB, do via separate migration (not in app code).
- Future enhancements stay inside `src/core/ai/` + `@repo/services` pricing.

This is now a clean, maintainable, single-stack AI platform.
