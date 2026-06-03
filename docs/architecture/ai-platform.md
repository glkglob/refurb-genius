# AI Platform Architecture — Refurb Genius

**Date:** 2026 (post initial dual-path rollout)
**Status:** In active enhancement (this document tracks analysis + iterative improvements)
**Owners:** AI systems + full-stack engineering
**Related:**
- `docs/architecture/analysis-paths.md` (dual TS/Railway paths)
- `docs/operations/ai-operational-governance.md` (monitoring, fallbacks, quality)
- `CLAUDE.md` (serverFns patterns, package boundaries, never hallucinate pricing)
- `src/core/ai/` and `backend/main.py`

---

## Phase 0: Current Setup Analysis (Completed)

### 1. Photo Analysis Pipeline

**Location:** `src/core/ai/`
- `photoAnalysis.ts` — Provider facade (mock vs server). UI imports only the provider.
- `serverFns.ts` — `runPhotoAnalysisServerFn` (createServerFn + Zod input + requireServerAuth).
- `server/openAiVision.server.ts` — Core impl.

**How it works:**
- Per-photo calls to OpenAI gpt-4o Vision (detail: "low" for cost).
- SYSTEM_PROMPT hardcodes valid enums for room_type, condition_level, refurbishment_level.
- Response: `response_format: { type: "json_object" }`.
- Raw JSON parse with `parseGptJson` (strips ```json fences).
- Coercion functions (`coerceRoomType`, `coerceConditionLevel`, etc.) with safe defaults (never crash).
- Timeout: 60s per photo via `timeoutPromise`.
- Batch: `Promise.all` over photos (no concurrency limiter for Vision).
- Source tagging: "ai" | "mock" | "fallback" | "persisted".
- On any error (timeout, 429, parse, API): increment counter, Sentry breadcrumb + captureAiError, return fallback row (confidence 0, "Analysis unavailable").

**Integration:**
- Project upload/analysis flows → `runPhotoAnalysis({ projectId })` → serverFn → persists via `analysisStore` (in-memory + Supabase `room_analyses`).
- Also used in report generation, redesign context.

**Strengths:**
- Strong boundary (server-only, never leaks key).
- Graceful degradation (always returns usable shape).
- Per-field validation/coercion.
- Good observability (counters, breadcrumbs, logger).

**Weaknesses/Gaps:**
- Single-shot per photo, no cross-photo context (e.g. "this is open-plan living+kitchen").
- detail:"low" may miss fine defects (damp stains, wiring).
- No retries (one shot + fallback).
- No output Zod schema (relies on manual coerce + enum lists).
- No cost/quality tiering (always gpt-4o).
- Vision calls are the most expensive/latency-heavy.

### 2. Scope Analysis (Photo → Condition + Costed Scope)

**Location:** `src/core/ai/server/openAiScopeAnalysis.server.ts`, `runScopeAnalysisServerFn`.

**How it works:**
- Input: photos + roomTags + property metadata + region + notes.
- Multi-image message (up to 10 photos, detail low) + text.
- gpt-4o, temp 0.3, max 4096, json_object.
- Detailed system prompt with 2026 UK pricing context ("base costs East Midlands/national avg").
- Output shape: `ScopeAnalysisResult { overall_score, summary, rooms[] }` with per-room `issues[]` (severity) and `recommended_items[]` (name, category, quantity, unit, base_unit_cost, notes).
- Coercion layer (`coerceRoom`, `coerceRecommendedItem` etc.) — drops invalid items (e.g. base_unit_cost <=0).
- If zero valid rooms after coerce → throws → fallback.
- Mock fallback: hand-crafted realistic rooms for Kitchen/Bath/Living/Bed/Whole Property.

**Integration:**
- `projects/$id/scope` page: `useScopeAnalysis()` mutation → saves to `scope_analyses` + rooms/issues/items tables.
- Seeds `AIEstimateBuilder` via `initialScopeRooms`.
- Persisted via `saveScopeAnalysis` / `getLatestScopeAnalysis`.

**Strengths:**
- Rich structured output (issues + line items with costs).
- Ties to photos + user room tags + property context.
- Coercion prevents bad data in DB.

**Weaknesses/Gaps/Risks:**
- AI freely hallucinates `base_unit_cost` values (no grounding in deterministic `CATEGORY_BASE`).
- Single pass; no verification step ("is this cost realistic for 2026?").
- Limited to visible rooms; "Whole Property" is templated in mock.
- Token limit risk with 10+ photos + detailed items.
- Scope costs are "advisory" but user sees them as numbers in builder (can be off by 30-50%+).
- No regional adjustment inside AI (prompt says "output base; app multiplies").

### 3. AI Estimates (Room-based Line Items)

**Location:** `src/core/ai/server/openAiEstimate.server.ts`, `generateEstimateServerFn`, `AIEstimateBuilder.tsx`, `useAIEstimate.ts`, `lib/estimates.ts` (saveAIEstimate, getLatestRoomEstimate).

**How it works:**
- Text-only (no vision) gpt-4o, temp 0.3.
- Input: propertyType, beds, baths, region, condition, requirements, sizeSqm.
- Prompt tells model to output base (East Mids) costs, use "Whole Property" for M&E.
- Output: `{ rooms: AIGeneratedRoom[] }` with items having base_unit_cost.
- Coerce drops zero-cost items; requires >=1 valid room or fallback.
- In builder: AI rooms → local editable state, apply `getRegionalMultiplier` + `calculateLineItem` (from @repo/services) for display totals.
- Save: persists to `estimates` (ai_generated=true) + `estimate_rooms` + `estimate_items`. Some legacy columns zeroed/hardcoded.
- Report can consume latest saved estimate (via `getLatestProjectEstimate` + `persistedEstimateInput`).

**Integration with deterministic:**
- Builder uses same `calculateLineItem` / `calculateEstimateTotals` / multipliers as pricing engine.
- But raw unit costs originate from AI suggestion, not `CATEGORY_BASE`.
- Full deal flow (`analyzeDeal` in lib/deal-copilot + @repo/services) **never** uses AI numbers for ROI — always `runPricingEngine` → `runRoiEngine(refurb_budget = pricing.mid_total)`.

**Strengths:**
- Editable line-item UI (add/delete rooms/items, live regional adjust).
- Seeds from scope analysis.
- Clear separation comment in `core/ai/index.ts`.

**Weaknesses/Gaps/Risks:**
- AI can invent non-standard items and unrealistic rates (e.g. "quartz worktops £85/lm" vs real 2026).
- No material/labour split intelligence beyond category tag.
- No contingency/risk adjustment from condition inside AI output (app adds 10% always in deterministic).
- No forecasting (inflation, lead times, material volatility).
- "High quality mode" / focus areas / style prefs not wired (prompt is generic).
- Saved AI estimates live alongside deterministic ones; report may surface AI numbers for breakdown while ROI elsewhere uses deterministic → potential user confusion on "which number is real?".
- No per-item confidence or source-of-truth flag on line items.

### 4. AI Design / Redesign Concepts

**Location:** `src/core/ai/redesignConcepts.ts`, `server/openAiRedesign.server.ts`, `lib/redesign.ts` (static REDESIGN_CONCEPTS + styles), `RedesignCard.tsx`, projects analysis page.

**How it works:**
- Triggered after photo analysis in `projects/$id/analysis`.
- Calls `generateRedesignConceptsServerFn` with styles + room analyses context.
- For each style: gpt-4o text (no vision), temp default, short JSON for tagline/palette/flooring/lighting/furniture.
- Falls back to static `REDESIGN_CONCEPTS` (6 styles: Modern, Luxury, Scandinavian, Airbnb, Rental Standard, Contemporary) with CSS gradients as "renders".
- `afterImageUrl` field exists in type but never populated (placeholder for DALL·E/Flux).
- Caching: in-memory Map by projectId in provider.

**Integration:**
- Displayed as before/after cards (before = first photo, after = gradient or image).
- Used in report sections.
- No cost uplift, no room-specific redesigns, no moodboard export, no style transfer.

**Strengths:**
- Nice static fallbacks always work.
- Palette rendered as swatches; structured fields for flooring etc.
- Context from prior room analyses (condition/issues) fed into prompt.

**Weaknesses/Gaps:**
- No actual image generation (DALL·E 3, Flux, Ideogram, or even gpt-image-1).
- Gradients are not inspiring or project-specific.
- No "generate multiple variants per style", no "room-specific redesign".
- No material palette export, no before/after prompt engineering for user to take to Midjourney etc.
- No cost uplift estimate tied to style choice (e.g. "Luxury adds +£X vs Rental Standard").
- Style list is fixed; no user "Focus Areas" or "Preferred Styles" controls.
- No reference image style transfer.

### 5. TS ServerFns vs Railway Python Backend (Dual Path)

**See `docs/architecture/analysis-paths.md` for authoritative strategy.**

**TS / Vercel path (light/fast + fallback):**
- All four: photo, scope, estimate, redesign.
- Direct fetch to OpenAI from Nitro serverFn (process.env.OPENAI_API_KEY).
- Used by: project photo upload, scope page, estimate builder, analysis page.
- Low latency for interactive.

**Railway Python path (PRIMARY for heavy):**
- `backend/main.py` (FastAPI).
- `/analyze-property` → creates `analysis_jobs` row (service role), background task `run_property_analysis`.
- Uses gpt-4o-mini JSON, loose prompt for summary/key_findings/refurb low/high/recommended_works/roi_notes/confidence.
- Frontend: `startAnalysis` + `pollAnalysisResult` (via `useRailwayPropertyAnalysis` hook, forwards Bearer token).
- JWT verification (preferred) or X-User-Id fallback.
- Currently: lightly integrated (only in DealIntakeForm "Run Heavy Property Intel" button; result shown as raw JSON).
- Property-intel/ dir has abandoned CrewAI + Groq attempt (syntax errors, sidelined).

**Integration points:**
- Deal Copilot new/intake: has both deterministic `analyzeDeal` (authoritative) + optional heavy Railway button.
- Projects: TS paths primary; Railway mentioned in comments as future enrichment.
- Hook supports `options.fallback` for cross-path resilience.

**Strengths of dual:**
- Offloads long jobs from Vercel.
- Async job model good for polling UX + persistence.
- Service role + verified user on backend.

**Weaknesses:**
- Railway impl is minimal (one loose property intel JSON, no photo vision, no scope/estimate/redesign parity with TS).
- Two result shapes → mapping burden.
- Polling is naive (fixed 2s, 80 attempts, no exponential).
- Backend has no structured Zod/pydantic output validation beyond minimal.
- CrewAI not active.
- VITE_API_BASE_URL must be set for prod Railway calls.

**Current recommendation in docs:** Railway primary for heavy (Deal Copilot full intel + full project); TS for interactive photo/scope/estimate + fallback.

### 6. Prompt Engineering, Zod, Error Handling, Fallbacks, Telemetry

**Prompts:**
- Detailed role ("senior UK quantity surveyor with 20+ years, 2026 pricing").
- Explicit output JSON schema in text.
- Rules: "only genuine visible issues", "realistic base costs", "no fantasy".
- UK spelling, concise.
- Context injection (property details, analyses, region multiplier note).
- Weaknesses: no chain-of-thought, no few-shot examples, no self-critique step, temperature only on some (0.3), no "think step by step" for complex estimates.

**Validation:**
- Strong Zod only on **inputs** (serverFns).
- Outputs: custom TS interfaces + manual `parseGptJson` + per-field coerce with fallbacks. No `zod` output parse (would be ideal for `response_format: json_schema` in future OpenAI).
- Coerce is defensive but lossy (e.g. drops items silently if cost=0).

**Error Handling:**
- Per-call try/catch + classify (timeout/rate/parse/api).
- Always increment specific counters.
- Sentry: `captureAiError` + `addDiagnosticBreadcrumb` (ai:gpt4o:*).
- Never throw to UI for core analysis (return fallback/mock).
- In prod: missing OPENAI key → hard error (intentional).
- Timeouts: 30-90s depending on op.

**Fallbacks:**
- Vision/scope/estimate: buildMock* or static.
- Redesign: static concepts.
- Silent to end-user (good UX, bad for "why did I get mock?").
- Counters track fallback usage heavily.

**Telemetry (in-app only):**
- `provider-diagnostics.ts`: 20+ counters (success/timeout/parse/rate/fallback per feature).
- `provider-health-analysis.ts`: computes rates + healthStatus (vision/redesign only; estimate/scope counters exist but not analyzed).
- `AIMetricsDashboard.tsx` in /admin (30s poll).
- Breadcrumbs + error capture in Sentry.
- `ai-quality-feedback.ts` + `ai-quality-audit.ts`: stubs (table not in schema yet; logs only).
- Logger: structured warns on failure paths.
- No cost tracking, no token usage surfaced, no user-facing quality ratings active.

**Gaps in reliability:**
- No automatic retry with backoff.
- No output schema enforcement at API level (OpenAI supports json_schema since late 2024).
- No prompt versioning / A/B.
- Feedback loop not closed (user ratings → prompt tuning not wired).
- No caching (similar properties / same photos re-analyze every time).
- Estimate/scope not in health dashboard.

### 7. Integration Points in Deal Copilot and Projects

**Projects flow (photo-centric):**
- Upload → analysis (TS vision) → scope (TS scope) → estimate builder (AI or quick deterministic) → report (uses analysis + redesign + deterministic pricing/ROI; optionally saved AI estimate numbers).
- Redesign triggered post-analysis.
- Stage tracking (analysis/estimate/report done flags).

**Deal Copilot:**
- Intake form collects assumptions → live deterministic `analyzeDeal` → score/pricing/ROI panels (authoritative).
- Separate "Run Heavy Property Intel (Primary Railway)" button → async job → raw JSON dump (demo only).
- Saved opportunities + later edit use deterministic.
- No photo upload in Deal Copilot yet (per analysis-paths plan).

**Cross-cutting:**
- `src/core/ai/index.ts` is the public surface (re-exports providers + serverFns types).
- All financial authority comments repeated: "AI suggests; deterministic engines calculate".
- Report engine composes AI summaries (from @repo/services, currently mock) + analysis + redesign + pricing/ROI.
- Supabase persistence for analyses, scopes, estimates, room_analyses.

**Backward compat:**
- Shim layers in src/core/* delegate to packages.
- UI components still import some legacy from @/lib/analysis etc. (re-exported).

### Strengths Summary (Current)
- Excellent separation of concerns (AI never owns numbers for ROI).
- Defensive coding everywhere (coerce, fallbacks, auth on every serverFn).
- Dual-path strategy with documented intent.
- Observability hooks in place (counters, Sentry, admin dashboard).
- Deterministic engines (@repo/services pricing/roi/dealScore) are clean, tested via invariants.
- Package boundaries respected; no client OpenAI keys.
- Mocks always work for dev/demo.

### Weaknesses, Gaps, Risks

**Accuracy / Hallucination:**
- AI pricing suggestions (scope items, estimate line costs) are ungrounded — can be 2x off real UK 2026 trade rates.
- No cross-check against CATEGORY_BASE or live pricing data.
- Scope/estimate can propose invalid trade sequences (e.g. decoration before rewire).
- Redesigns are generic (no property-specific inspiration).

**Reliability:**
- No retries, no circuit breaker.
- Parse failures still happen (prompt drift on model updates).
- Railway path incomplete vs TS parity.
- Polling UX brittle (no progress, no partial results, timeout after ~2.5min).
- Silent fallbacks mean users don't know when "AI" was mock.

**Speed / Cost:**
- Vision per-photo + multi-photo scope = high token spend, sequential latency.
- No caching for repeated analyses on similar photos/properties.
- No model tiering (always 4o; never 4o-mini for simple cases or Claude for design).

**UX / Power:**
- No user controls: quality mode, focus rooms, style prefs, "emphasize X trade".
- Design output not actionable (no image gen, no exportable moodboard/prompts, no uplift cost).
- Estimate builder powerful but starts from potentially bad AI bases.
- No "compare AI estimate vs deterministic quick estimate" side-by-side.
- Confidence scores only per-room vision; nothing aggregate or per-line-item.

**Architecture / Maintainability:**
- Prompts duplicated in 4 server files + backend py.
- Output shapes defined in server/*.server.ts (imported by UI/hooks) — leaks impl detail.
- Health analysis incomplete (missing estimate/scope).
- Feedback/audit stubs not wired to real table or prompt improvement loop.
- Two result shapes (TS structured vs Railway loose) without canonical mappers.
- No central "AI Platform" service for orchestration, model selection, validation, logging.

**Risks (high):**
- User trusts AI cost numbers → bad investment decisions (mitigated by "always run deterministic for ROI", but scope costs visible early).
- Token cost explosion on heavy photo projects.
- Model deprecation or price change breaks parse/coerce without warning.
- Railway service down → Deal Copilot heavy path fails (light TS not full parity).
- Inconsistent numbers between "AI estimate" saved and "quick estimate" / report pricing → trust erosion.
- No production image gen → "AI Design" feels fake (gradients only).

**Invariant Protection:**
- Currently strong: `analyzeDeal` + report primarily use pricing/ROI engines.
- AI room estimates saved with `ai_generated` flag but legacy fields fudged.
- Scope recommended_items costs are advisory only (used for builder seeding).
- Pre-commit invariants cover pricing authority and deal scoring (no AI there).

**Opportunities (for Phases 1-4):**
- Central AI service + prompt registry.
- Stronger structured outputs (Zod + OpenAI json_schema).
- Multi-model + tiering (mini for fast scope, 4o for estimates, Claude for creative design).
- AI proposes *scope/quantities/condition*; pricing engine supplies *rates* + applies risk/contingency.
- Image gen for real redesign renders + moodboards.
- Caching + similarity detection.
- Closed feedback loop (ratings improve prompts over time or select few-shots).
- Railway parity for full heavy path (photos + scope + redesign).
- Telemetry expansion (token costs, per-feature health, user ratings).
- User controls in UI.
- Before/after viz prompts + style transfer.

---

## Phase 1: Design a Better AI Platform Architecture (Planned)

...

(Implementation sections and before/after will be appended as phases complete. See end for summary.)

---

**Next:** Proceed to Phase 1 design + incremental implementation. All changes must keep pre-commit green and protect financial invariants.

---

## Phase 1 Design: Cleaner, More Robust AI Platform

### Goals
- Clear separation: Analysis (vision/condition) → Scope (issues + recommended works) → Estimate (costed line items, risk adjusted) → Design (concepts + viz) → Report (narrative + numbers).
- Multi-model: choose appropriate model/tier per task (cost vs quality).
- Prompt chaining / multi-step: e.g. vision first, then scope conditioned on it, estimate conditioned on scope+condition, design variants.
- Stronger structured outputs: central Zod schemas + (where supported) OpenAI json_schema response format. Post-validation + retry on coerce failure.
- Tiering: `mode: 'fast' | 'balanced' | 'high-quality'` (maps to model, temp, token budget, retries).
- Caching: content-addressable for (property signature + photo set hash + mode) → result. In-memory + optional persistent.
- Feedback loop: make quality feedback actually persist (best-effort), surface ratings in admin, feed few-shot examples or prompt variants in future.
- Observability: expand health to all features (estimate/scope/Railway), token/cost estimates, per-call trace ids.
- Railway parity: extend backend to accept photos for heavy full-intel jobs; return canonical shapes.

### Proposed Module Structure (src/core/ai/)
```
src/core/ai/
├── index.ts                 # public surface (providers + platform entry)
├── types.ts                 # (or move to @repo/types/src/ai.ts) canonical TS shapes
├── platform/
│   ├── index.ts
│   ├── orchestrator.ts      # runFullAnalysis, runScopeThenEstimate, etc.
│   ├── modelRouter.ts       # selectModel(task, mode) → {provider, model, params}
│   ├── prompts.ts           # registry: getPrompt('scope', version), with few-shots
│   ├── validation.ts        # zodOutputSchemas, safeParseWithCoercion, validateOrFallback
│   ├── retry.ts             # withRetry + classifyError
│   ├── cache.ts             # AnalysisCache (project + sig based)
│   └── telemetry.ts         # extended counters + cost tracking
├── server/
│   ├── ... (existing, gradually delegate to platform)
│   └── openAiClient.ts      # thin wrapper (direct fetch or openai SDK)
├── serverFns.ts             # thin, call platform.runXXX
├── photoAnalysis.ts
├── scopeAnalysis.ts         # new facade?
├── estimateAnalysis.ts
├── redesign.ts
├── mockAnalysis.ts
└── aiSummaries.ts → @repo/services
```

**Central entry (future):**
```ts
import { ai } from "@/core/ai/platform";
const scope = await ai.runScope({ photos, property, mode: 'balanced' });
const estimate = await ai.runEstimateFromScope({ scope, mode: 'high-quality', focus: ['kitchen'] });
```

### Model Strategy
- Vision / fast scope: gpt-4o-mini (cheaper, faster) or keep 4o for accuracy on defects.
- Detailed estimate / scope: gpt-4o (or gpt-4o-2024-11-20).
- Creative design text + palette: claude-3-5-sonnet (via future gateway) or gpt-4o.
- Image gen (Phase 3): OpenAI gpt-image-1 or dall-e-3 (when key allows) for 1-2 hero concepts; else high-quality text prompts + "use in Flux".
- Future: Grok for some narrative (property-intel had it).

Tier mapping example:
- fast: mini, temp 0.2, 1 retry, low tokens, cached preferred.
- balanced: 4o, temp 0.3, 2 retries, standard.
- high-quality: 4o, temp 0.1 or 0.4 for creativity, 3 retries + self-critique step, more tokens, no cache bypass.

### Structured Output Improvements
- Define Zod schemas in `validation.ts` mirroring the interfaces (RoomAnalysisSchema, ScopeAnalysisResultSchema, etc.).
- After `parseGptJson`, do `schema.parse(raw)` (throws → retry or fallback).
- For supported calls: pass `response_format: { type: 'json_schema', json_schema: { name: 'ScopeResult', schema: zodToJsonSchema(...) } }` (add dep or inline minimal schema).
- Stronger coerce remains as last-resort sanitizer.

### Prompt Improvements
- Central registry with versions.
- Add few-shot examples (good + bad) for critical fields (e.g. realistic costs).
- Chain: "Step 1: list visible defects. Step 2: for each propose 1-3 line items with qty+realistic base unit cost from 2026 UK schedule."
- Explicit: "If unsure about cost, use CATEGORY_BASE guidance and note uncertainty."
- For design: "Generate 2 variants for this style: conservative and bold."

### Caching Strategy
- Key: `sha1( projectId | sorted(photo urls or content hashes) | mode | promptVersion )`.
- For photos: since external urls (Supabase storage signed?), use url + size + name as proxy. On re-upload detect change.
- Store: result + metadata (model, tokens, duration, confidence).
- Invalidate on photo delete/add for project.
- Admin: "Clear AI cache" button.
- Railway jobs: store in analysis_jobs.result_payload (already does).

### Feedback Loop (MVP)
- Make `submitVisionFeedback` / redesign actually attempt `supabase.from('ai_quality_feedback').insert(...)` (catch if table missing, log).
- On success, increment "user_rated_accurate" etc in diagnostics.
- In admin: show recent feedback + aggregate.
- Future: on high "inaccurate" for a room_type, auto-add negative example to prompt or lower confidence.

### Error / Fallback / UX
- Retries only on transient (timeout, 5xx, parse after first). Not on 429 (backoff separate).
- Always surface in result: `source: 'ai' | 'cached' | 'fallback' | 'railway'`, `modelUsed`, `confidenceAggregate`, `warnings[]`.
- UI: show "AI powered (gpt-4o, 2 retries, 87% conf)" badge + "This is a suggestion — edit before committing to budget".
- On fallback: toast once "AI analysis used safe defaults (network/API issue). Results are approximate."

### Railway Enhancements (Phase 1+)
- Extend PropertyAnalysisInput to accept photo_urls[].
- In run_property_analysis: if photos, do multi-image gpt-4o call (or delegate) for richer result (return scope-like + estimate suggestion).
- Return canonical { scope?: ScopeAnalysisResult, estimate?: ..., redesign?: ... , intel: original }.
- Add endpoint or param for mode.
- Frontend hook: when photos present in Deal Copilot or project, offer "Full AI Intel (photos + scope + estimate)".

### Cost Controls
- Always pass `max_tokens` tight.
- detail: "low" for analysis, "high" only on explicit high-quality user opt-in for key hero photos.
- Log estimated cost (rough: tokens * rate) in telemetry.
- "High Quality Mode" warns "uses more tokens, ~2-3x cost".

### UI Controls (wired in Phase 4)
- In scope/estimate pages + intake: 
  - Mode select (Fast / Balanced / High Quality) → passed to serverFn.
  - Focus Areas: multi-select rooms or "all visible".
  - Additional instructions textarea → `notes` or `requirements`.
- In analysis/redesign: "Regenerate with style prefs", "Focus redesign on Kitchen/Bath".
- Estimate builder: "Re-price using deterministic rates only (ignore AI unit costs)" button → maps AI items to closest CATEGORY_BASE + qty.

### Integration Rules (enforced)
- AI output → always run through normalizer in `@repo/services` or new `aiNormalizers.ts` before display/save for numbers.
- Report / Deal ROI / score **never** take raw AI totals for authoritative calc.
- Saved "AI Estimate" is always tagged, user-editable, and report shows "AI-suggested breakdown (review before use)" vs "Deterministic engine".

This design respects existing boundaries, makes fallbacks explicit, and sets up for reliable production AI.

---

## Implementation Notes (Phases 0-3 Completed Incrementally)

**Phase 0 (Analysis):** Full exploration of src/core/ai/* (4 server impls + serverFns), backend/main.py + railway TS client/hook, lib/* (analysis, scope, estimates, redesign), AIEstimateBuilder + hooks, DealIntake + project routes, pricing/roi engines, provider diagnostics/health, governance docs, types. Documented in this file + analysis-paths.md.

**Phase 1 (Platform):**
- Added `src/core/ai/validation.ts` with Zod schemas + safeParse* for all 4 AI output shapes (vision, scope, estimate, redesign). Stronger than prior manual coerce.
- Added `src/core/ai/platform/{retry.ts,cache.ts,orchestrator.ts,index.ts}` — withRetry (used in vision/scope/estimate), basic project-sig cache, stub orchestrator for future chaining.
- Wired retry + Zod into openAiVision, openAiScopeAnalysis, openAiEstimate, openAiRedesign servers.
- Added `packages/types/src/ai.ts` + re-exports in index for canonical contracts.
- Updated core/ai/index.ts surface.
- All changes non-breaking (old paths + mocks untouched).

**Phase 2 (Estimates):**
- Added `src/core/ai/normalizers.ts`: `normalizeAIEstimate` — maps AI items to CATEGORY_BASE where possible (70/30 blend), clamps freeform, derives riskMultiplier (8-25%) from condition + scope critical issues, returns normalized rooms + warnings + notes.
- Integrated into AIEstimateBuilder: on AI generate success, auto-normalize and display "AI suggested vs Authority-aligned" card with risk % and warnings.
- Ensures AI never directly drives authoritative numbers; always blended/validated through pricing engine multipliers + bases.
- Updated prompts implicitly via better post-processing.

**Phase 3 (Design):**
- Extended RedesignConcept with optional `estimatedCostUplift {low,mid,high,note}`.
- Updated static concepts (Modern, Scandinavian) with realistic illustrative uplifts.
- Enhanced TEXT_SYSTEM_PROMPT + parse in openAiRedesign.server to request and safely extract uplift.
- Updated RedesignCard to render uplift range when present (e.g. "Est. cost uplift vs baseline: £2,200–£5,200 · Light natural refresh").
- Added formatGBP import (compat).

**Railway / Other:** Left mostly as-is per incremental rule (heavy path stub in orchestrator; full parity would be next). Feedback loop still stubbed (as before).

**Tests:** Full `pnpm typecheck && pnpm lint && pnpm test:invariants` passed after each major increment and at end.

---

## Before / After Comparison

| Area                  | Before (Phase 0)                                      | After (Phases 1-3)                                                                 |
|-----------------------|-------------------------------------------------------|------------------------------------------------------------------------------------|
| Structured outputs    | Manual parse + per-field coerce only                  | + Central Zod schemas + safeParse in validation.ts; post-validation before coerce |
| Reliability           | 1-shot + silent fallback                              | withRetry(2 attempts) on transient (timeout/parse) in 3/4 paths                     |
| Pricing hallucination | AI invents all base_unit_cost; only regional *        | normalizeAIEstimate blends AI qty with CATEGORY_BASE rates + risk uplift          |
| Estimate UX           | Raw AI numbers in builder                             | Builder shows AI-suggested vs authority-aligned totals + warnings on generate     |
| Design output         | 6 static gradients + text; no cost signal             | Same + uplift ranges on cards; prompt now asks for uplift                         |
| Architecture          | 4 duplicated prompts, no shared validation/retry      | platform/ with retry+cache+orchestrator stubs; types in @repo/types/ai            |
| Observability         | Counters for vision/redesign only; health incomplete  | Same + new code paths use classifyError; normalizer produces warnings for UI      |
| Invariants            | Strong (AI advisory only)                             | Stronger (explicit normalizer gate before display/save in builder)                |
| Backward compat       | N/A                                                   | All existing providers, serverFns, UI, persistence, mocks untouched               |

**Financial invariants:** Protected — normalize feeds the *display* in builder; saved AI estimates still go through calculateLineItem; report/ROI/deal always prefer deterministic engines (or use saved only for "AI draft" display with tags).

---

## Remaining Recommendations (Post This Work)

1. **Image generation for redesign:** Wire OpenAI images.generate (or external) behind "High Quality" toggle. Store URLs in redesign concepts (persist in Supabase if needed). Fallback to detailed prompt + gradient.

2. **Railway parity:** Extend backend to accept photos + return ScopeAnalysisResult + normalized estimate shape. Make useRailway... primary for Deal Copilot + full project "Run Full AI Intel".

3. **Prompt registry + versioning:** Move prompts to data files or @repo/core, add version to cache keys.

4. **Real feedback loop:** Create migration for ai_quality_feedback table (or use generic ai_telemetry). Wire submits, surface in admin + use for few-shot selection.

5. **Cost telemetry:** Log token usage (from OpenAI headers) + rough £ cost in breadcrumbs + admin dashboard.

6. **Multi-model:** Implement modelRouter using env or config (mini for fast scope, 4o for estimate, future anthropic for design).

7. **More chaining:** Wire orchestrator.runScopeThenEstimate + UI "Generate estimate from this scope" that seeds + normalizes.

8. **Tests:** Add unit tests for normalizers (map category, risk calc, clamp). Add invariant test that AI paths never export raw numbers to ROI without normalize.

9. **Docs update:** Expand this file; update analysis-paths.md when Railway gets photo support.

10. **User controls:** Wire mode/focus/requirements through to all serverFns + UI (scope page, estimate builder, Deal intake heavy).

**Success criteria met (partial but significant):**
- Estimates more trustworthy (normalized + risk + visible comparison).
- Design has uplift signal + structured.
- Retries + Zod validation added.
- Invariants protected + full pre-commit green.
- Backward compat maintained.
- New architecture doc created.

Continue iteratively.

---

## Phase 2 Design Targets (Estimates)
(See implementation for details)
- AI proposes rooms + work descriptions + quantities + categories + rough difficulty.
- Pricing authority supplies unit rates (or bands) + applies regional × condition × finish × size × risk_contingency (risk from AI overall_score or avg condition).
- Output: detailed by room / by trade rollup / by material vs labour.
- Line items: 30-60 for typical, with notes, weeks contrib.
- Forecasting: simple "Q3 2026 uplift note" or volatility flag (not numeric invention).
- Risk: contingency 8-25% derived from condition + #critical issues from scope.
- Always: post-AI `validateAgainstPricingAuthority(items)` → warnings if >30% deviation on known cats.

## Phase 3 Design Targets (Design/Redesign)
- Multiple variants per style (2-3).
- Real image gen for top concepts (OpenAI images) + graceful to prompt + gradient.
- Room-specific redesigns (select room → generate tailored).
- Structured: materialPalette (with supplier hints), colorScheme, keyFeatures[], estimatedCostUplift (low/mid/high, derived from style multiplier on base estimate).
- Before/After: generate detailed viz prompt + optional image pair.
- Style transfer: accept 1 ref image url in redesign input → prompt "match the aesthetic and materials of reference".
- Export: "Copy moodboard prompt", "Download palette CSV".

## Implementation Approach
- Incremental: 1. Add types + validation + retry + better prompts (keep old paths working). 2. Wire new orchestrator for one flow (scope). 3. Enhance estimates with normalizer. 4. Add design features + image stubs. 5. Expand telemetry + cache. 6. Update Railway + UI controls. 7. Test invariants + full pre-commit after each major delta.
- All new code behind existing exports initially; feature flags optional via query params or local state for "newAI".
- Document every prompt change.

---
