# Phase 0: Full Code Audit & Analysis — Refurb Genius (Final Pre-Launch)

**Date of audit:** Current session (post f84c290 "final production hardening...")
**State:** Working tree clean after previous launch prep. Pre-commit clean, build succeeds.

This is a fresh, comprehensive audit following the orchestrator prompt. It builds upon but is not limited to prior PHASE0-FINDINGS.md and RELEASE-READINESS-REPORT.md.

## 1. Codebase Structure Overview

- Monorepo (pnpm + Turborepo): root app (TanStack Start) + 8 packages with strict one-way deps (`@repo/types` → `@repo/core` → `@repo/services` → root + `@repo/ui` + `@repo/supabase`).
- `src/routes/`: File-based TanStack Router (~26 files). Public + `_authed` layout for protected.
- `src/core/`: Domain (ai/, dealCopilot/, pricing/, projects/, roi/, reports/, trades/).
- `src/core/ai/`: Pipeline (serverFns + server/\*.server.ts + platform/ + validation + mocks).
- `packages/services/`: Canonical deterministic engines (pricing, roi, deal-analysis).
- Supabase: migrations with RLS, Edge Functions (limited use now).
- Tests: only `tests/invariants/` (53 strong contract tests).
- UI: Mix of local shims + `@repo/ui` (progress on migration per CLAUDE.md).
- Other: lib/ (logger, analytics/PostHog, sentry, timeout, rate-limit), hooks/, serverFns/, components/.

**Docs:** Excellent (architecture/, route-map, dependency-rules, mobile-readiness, previous audit reports).

## 2. Analysis of Major Functions & Flows

### Authentication & Protected Routes

- `_authed.tsx`: `beforeLoad` calls `getCurrentUserServerFn()` (createServerFn), redirects to /auth with `redirect` param preserving full path+search. Returns `{ user }` in context. Excellent SSR/hard-refresh safety.
- `serverFns/auth.ts`: Central, well-documented primitives (`requireUser`, `getCurrentUserServerFn`, `createSupabaseServerClient`). Dynamic imports only. Maps Supabase User to AuthUser.
- Client: `lib/auth.ts` + `useAuth` hook (for reactive UI), `RequireAuth` component (secondary client guard + loading).
- Public routes: index, auth, callback, trades (public listing), privacy/terms/support.
- Strengths: No client-only writes for auth-sensitive ops. Cookies authoritative on server.
- Minor: `RequireAuth` still present in AppLayout (double protection, but client-only).

### Dashboard

- Fetches trades jobs (local state + services), interests, projects (via useProjects / React Query).
- Stats with loading "…" handling.
- Quick actions (4 cards).
- Sections: My Trades Jobs (table with update), My Interests, My Projects (grid of ProjectCard or EmptyState; now has explicit `projectsLoading` guard from recent work).
- "Coming soon" roadmap card at bottom.
- Polish already applied: live data, loading states, empty state.
- Observations: Uses custom local state machines for jobs/interests (not RQ). Functional.

### Deal Copilot (Core Flow)

- **new.tsx** + **DealIntakeForm.tsx** (large ~560 lines component):
  - Form state (title, urls, money strings, region, condition).
  - `parseMoney` + validation helpers.
  - `scoreInput` memo → `scoreDealOpportunity` (deterministic from @repo/services) → `analyzeDeal`.
  - Real-time DealMetricsGrid, DealRiskFlags, DealEstimateSection (from pricing).
  - Optional AI estimate: `useGenerateEstimate` (serverFn) → normalize with regional multiplier + `calculate*` from pricing → compact (recently improved) preview with rooms in bordered sections, totals, strong "ADVISORY ONLY" + guidance.
  - Save: creates domain object, calls `saveDealOpportunity` (serverFn path), shows saved state + toast (recent).
  - Telemetry on score/AI.
- **index.tsx / $opportunityId.\* **: List of saved opportunities (useOpportunities), view/edit. Lighter UX than intake.
- Strengths: Scoring/ROI always deterministic. AI is optional text-only estimate (no photos here). ServerFn for save. Good progressive disclosure.
- Polish done: AI preview now more scannable with mini room cards + grid items.

### Project Lifecycle

- **new.tsx**: Controlled form + client validation (postcode regex, ranges) + `useCreateProject` (serverFn) + track + navigate. Error display.
- **$id/index.tsx**: Project detail with progress checklist (photos/analysis/estimate/report), links to steps. Good visual flow.
- **upload.tsx**: Drag/drop + input, file guards (10MB image), useUploadPhotos, "Ready for analysis" (recent label), stage advance.
- **analysis.tsx**: Load persisted or `runPhotoAnalysis` (serverFn), then async `generateRedesignConcepts`. Uses AnalysisCard + RedesignCard. Error handling for redesign improved (toast + inline).
- **estimate.tsx**: Controls (region/condition/finish/categories) drive `runPricingEngine` + `runRoiEngine` (pure). Optional AIEstimateBuilder (complex editable + normalize + save via useSaveAIEstimate). Scope handoff via sessionStorage.
- **scope.tsx**: Photo-based scope via `useScopeAnalysis` serverFn.
- **report.tsx**: `buildReport` (deterministic from core/reports + engines), PDF export (progress, trackReportExported), handles missing estimate gracefully. Loading for persisted estimate.
- Strengths: Stage flags persisted. Mix of deterministic pricing + optional AI. Good error/loading/empty states.
- Observations: sessionStorage handoff is a bit hacky but isolated. Report engine central.

### Trades (Post Job, Browse Marketplace)

- Public `/trades` + `$jobId`: Browse + details.
- Authed: post new, edit, profile, interests.
- Uses services/trades stores, local state in dashboard.
- Functional per prior QA docs (trades-marketplace-qa.md).
- Less focus in this audit but no obvious breakage.

### AI Pipeline (src/core/ai/\* + serverFns)

- **serverFns.ts**: 4 createServerFns with Zod inputValidator. `requireServerAuth` (now returns user id) + `checkRateLimit` (per "ai-vision" etc., 10/min default, in-memory) before delegating to secure impls. Excellent.
- Individual servers (openAi\*.server.ts):
  - Vision, Estimate, Scope, Redesign: prompts, fetch to gpt-4o (json mode), timeout, withRetry (transient only), parse + coerce + Zod safeParse + manual fallback paths.
  - Explicit `buildMock*` / `staticFallback` when no key or failure.
  - Source tagging, Sentry captureAiError + breadcrumbs, provider-diagnostics counters.
- platform/: retry.ts (good classification), orchestrator (stubbed — flows call fns directly), cache.
- normalizers, validation, mockAnalysis, photoAnalysis, redesignConcepts.
- Strengths: Very defensive. Fallbacks always available. Rate limit early. No Railway left.
- Concerns: Orchestrator not wired (per comments). In-memory rate limit (documented limitation).

### Pricing & ROI Engines (@repo/services — canonical)

- **pricing/pricingEngine.ts**: `runPricingEngine` — pure, multipliers from @repo/core/utilities/pricingData (REGION, CONDITION, FINISH), size clamp, line items, contingency/VAT, low/mid/high, assumptions/warnings/confidence. Returns full result.
- Helpers: `getRegionalMultiplier`, `calculateLineItem`, `calculateEstimateTotals`.
- **roi/roiEngine.ts**: `runRoiEngine` — pure, total cost/profit, ROI, yield, rental uplift, investment_score (1-10), risk_level. Uses regional rent strength + condition risk.
- **deal-analysis/dealScore.ts**: `scoreDealOpportunity` + `getMissingDealFields` — wraps ROI + maps to recommendation bands + reasons.
- Strengths: Invariant tests (pricing-authority, pricing, dealScore, scoring) rigorously protect determinism, mid_total authority, no fallbacks in engines. AI only provides inputs or advisory suggestions (normalized against engine).
- Shim in src/core/pricing for compat (re-exports).

## 3. Identified Issues (Code Smells, Duplication, Performance, Maintainability)

**Duplication (biggest maintainability item):**

- rowTo\* mappers (e.g. rowToOpportunity / rowToDealOpportunity) duplicated across opportunityStore.ts, useOpportunities.ts, and inlined (with comments) in serverFns/dealCopilot.ts. Same pattern likely for projects/estimates. Trade-off explicitly for "no browser Supabase in server modules."
- Pricing shims (src/core/pricing re-exports @repo/services).

**Component Size / Complexity:**

- DealIntakeForm.tsx (~560 lines): mixes form, derived scoring/AI, side panel.
- AIEstimateBuilder.tsx: rich but long (editable rooms, normalization logic, multiple handlers).
- Some route pages (analysis, report, estimate) have significant local state + effects + sessionStorage.

**Loading / Empty States:**

- Basic but functional. Used in many places. Recent improvements (dashboard projects loading).
- No rich skeleton variants for lists/tables (text "Loading..." or full card).

**Mobile / UX Polish Areas:**

- MobileTopBar: functional but compact stacked buttons (improved in this session for targets).
- Sidebar: desktop only, still local (not migrated).
- ProjectCard, QuickActionCard: good hover, added active:scale in this audit.
- AI estimate preview in Copilot (pre-this-session dense; improved here with room "cards" + grid + CTA).
- Some "Coming soon" placeholders.

**Other:**

- useEffect heavy in stateful pages (expected for data loading + side effects like analytics, redesign trigger).
- No raw `console` in app code (logger only).
- Very few `any`.
- Performance: heavy use of useMemo/useEffect appropriate; engines pure so cheap. No obvious expensive renders in loops.
- Accessibility: Relies on Radix + good labels. Some custom buttons/links could use more aria (easy wins possible).
- Tests: Invariants excellent for architecture/financials/routes. Gap in component/E2E tests (noted as post-launch).
- Rate limit: in-memory (process local) — best effort on Vercel.

**Visual/Current State:**

- Modern, trustworthy property-tech: Tailwind v4, rounded-xl, accent, shadows, lucide icons.
- Recent hardening/polish already landed (rate limit errors, advisory badges, toasts on save/export, dashboard live projects).
- Consistent disclaimer footer on authed pages.
- Good progressive enhancement (instant score before AI).

## 4. Strengths (Launch-Ready Foundations)

- Deterministic financials never compromised.
- Server-first auth + writes.
- Defensive AI with fallbacks everywhere + rate limiting.
- Strong invariants + architecture docs.
- Error handling, loading, empty states present and improving.
- PWA manifest, mobile meta, responsive.
- Analytics for key funnels.
- Build/pre-commit always clean in this session.

## 5. Summary for This Audit

The app is in excellent shape for public launch. Most "Phase 0" concerns from earlier audits have been addressed (serverFns, rate limits, dashboard reality, error surfacing). Remaining items are mostly maintainability (mapper duplication — accepted trade-off) and polish opportunities (which are addressed in Phase 1 of this run).

No blocking bugs, performance cliffs, or architecture violations found.

(Full prior detailed findings in docs/PHASE0-FINDINGS.md and RELEASE-READINESS-REPORT.md.)

---

_Audit performed via systematic file reads, greps, structure listing, and flow tracing._
