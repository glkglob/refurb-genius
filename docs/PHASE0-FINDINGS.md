# Phase 0: Final Assessment Findings — Refurb Genius Public Launch Prep

**Date:** Current session (post `feat/enhanced-ai-estimates-and-design` partial work)  
**Branch:** feat/enhanced-ai-estimates-and-design (dirty: rate limiting, env validation, dashboard/projects polish, security headers)  
**Pre-commit baseline:** ✅ typecheck + lint + 53/53 invariants all clean.

## Executive Summary
The app is in a strong state after full Railway decommissioning: pure TS + OpenAI serverFns, server-side auth everywhere for writes, deterministic pricing/ROI engines in `@repo/services`, good RLS, Zod on inputs, retries/fallbacks in AI, root error boundary + route errors, PWA manifest + mobile meta. Core flows (dashboard now live with projects, Deal Copilot, project photo→analysis→estimate→report, trades) are functional.

Many Phase 3 items (rate limits on AI, env validation on startup, security headers, some analytics) are **already partially implemented** in the uncommitted tree.

Focus areas per prompt (Deal Copilot, project creation, AI, error handling, mobile, empty states) are mostly solid but have polish and a few consistency gaps.

**No critical data-loss or security bypass bugs found.** All high-severity historical issues (hard-refresh auth on create/save) appear addressed via serverFns.

## 1. Bugs & Stability Issues Found
- **Opportunity delete path inconsistency** (`src/hooks/useOpportunities.ts:117`): `useDeleteOpportunity` does direct `supabase.from("deal_opportunities").delete(...)` (client-only). Save path correctly uses `saveDealOpportunityServerFn` (via opportunityStore patch). RLS protects it, but violates the "all writes via serverFn for SSR/hard-refresh safety" pattern used for projects and deal saves. Low risk but should be fixed for consistency.
- **Redesign generation silent failure** (`src/routes/_authed/projects.$id/analysis.tsx:64`): `generateRedesignConcepts(...).catch(() => { setConceptsLoading(false); })` — user sees stale static concepts with no feedback or retry.
- **AI rate limit errors surface as raw `Error` messages** from serverFn throws. Clients (e.g. `DealIntakeForm`, `AIEstimateBuilder`) show `error?.message`. Works but not polished (no dedicated "rate limited" UI/toast with countdown).
- **No success feedback on Deal Copilot "Save opportunity"**: Only `saveError` state + inline display. Success just sets local `savedOpportunity` silently (user may not notice).
- **Project create submit button** (`projects.new.tsx`): No `isPending` disable or spinner on the primary action while `createProject.mutate` runs (validation prevents double, but UX laggy).
- Minor: Some admin.tsx direct supabase counts (acceptable for admin surface).
- No evidence of pricing/ROI drift or AI overriding deterministic engines (all analysis confirms AI advisory only; invariants + re-exports via shims protect this).

**AI pipeline robustness (good overall):**
- All 4 serverFns (vision, redesign, estimate, scope) have:
  - Zod `.inputValidator()`
  - `requireServerAuth()` returning user (now + rate limit check)
  - `withRetry` (transient: timeout/parse/5xx only, 2 attempts)
  - Timeout wrappers
  - Coercion + Zod safeParse + manual fallback parsing
  - Explicit `buildMock*` or `staticFallback` when no OPENAI key or failure paths
  - Sentry `captureAiError` + diagnostics counters + breadcrumbs
- Vision, estimate, scope, redesign all have production fallbacks (mock data).
- Orchestrator is stubbed ("not wired yet") — current flows call serverFns directly (acceptable per comments).

**Auth/RLS (strong):**
- _authed layout `beforeLoad` + server client cookies for every protected route.
- All create/save serverFns use `requireUser()` / server supabase.
- RLS "xxx_all_own" policies on projects, photos, estimates/estimate_items/estimate_rooms, room_analyses, deal_opportunities, trades tables + storage bucket policies scoped to `auth.uid()` or folder prefix.
- Admin policies via `is_admin()`.
- Invariant tests cover key env + client/server separation.

## 2. UX Friction Points & Polish Opportunities
**Deal Copilot (high attention area):**
- Intake form good: real-time score via deterministic `scoreDealOpportunity` + `analyzeDeal` (from @repo/services), validation, money parsers.
- AI estimate integration (recent): calls `generateEstimateServerFn`, normalizes with regional multiplier + pricing calcs, shows compact advisory box. **Presentation is raw and cramped** (text list, truncated items, no structure/cards, weak "advisory only" emphasis). Compare to rich editable `AIEstimateBuilder` + `EstimateTable` in project estimate flow — big inconsistency.
- No toast on successful save. "Save" button has no pending state in UI (only `isSaving` guard).
- Results (metrics, risks, estimate section) appear only after valid inputs — good progressive disclosure.
- Telemetry: `trackDealAnalyzed` wired for score ready + AI estimate.

**Projects flow:**
- Creation: solid client validation + serverFn mutate. Good postcode regex, range checks. Navigates on success + proxy track.
- Upload: file size/type guards (10MB), LoadingState/EmptyState for project load errors, "Ready for analysis" label (recent). Photos hook handles upload.
- Analysis: loads persisted or runs vision + redesign (async, silent on redesign fail). Uses `AnalysisCard`, `RedesignCard`.
- Estimate: excellent — tabs? pricing controls (region/condition/finish/categories), deterministic `runPricingEngine` + `runRoiEngine`, optional AI builder for photo-derived rooms, save. Good loading.
- Scope: uses `useScopeAnalysis` (serverFn), persists? Report consumes.
- Report: complex but robust (buildReport deterministic, handles missing estimate via fallbacks, PDF export with progress + `trackReportExported`, loading states for estimate load).
- Project detail (`$id/index`): progress checklist with icons, links to steps. Good.
- Dashboard: now shows live "My projects" grid (was placeholder) + real counts/stats for trades/interests/projects. Uses `ProjectCard`, `EmptyState`. Much improved.

**States & Feedback:**
- `EmptyState` and `LoadingState` components exist and used in upload, analysis, report, dashboard, project detail.
- Basic but functional (dashed border, spinner). No rich skeletons for lists/tables (uses `Skeleton` shim in ui/ but not heavily applied).
- Toasts via sonner (used in report export).
- Error surfaces improved recently (real messages from server for opportunity save).
- Root has `RootErrorBoundary` (class) + TanStack `errorComponent` + custom 404. Good coverage.

**Mobile / PWA / Responsiveness:**
- `__root.tsx`: viewport-fit, apple-mobile-web-app, manifest link, og images.
- `public/manifest.json`: full PWA (icons, screenshots, standalone).
- `AppLayout`: Sidebar (desktop) + `MobileTopBar`, responsive padding/grids (`sm:`, `lg:grid-cols-`).
- Capacitor configured (ios scheme, webDir).
- `docs/mobile-readiness.md`, `docs/capacitor-ios.md` document install + testing.
- No obvious touch-target or overflow issues in inspected JSX, but full device testing recommended in Phase 4.
- Sidebar not yet migrated to @repo/ui (per CLAUDE.md).

**Onboarding / First-time:**
- Post-login → dashboard with "No projects yet" + prominent "Create project" CTA + Deal Copilot quick action.
- Deal Copilot new is the "Start Deal Analysis" hero action.
- Good progressive: assumptions → instant deterministic score → optional AI estimate → save.

**Other polish:**
- Disclaimer footer on authed pages.
- Consistent use of shadcn/@repo/ui (Card, Button, etc.).
- Some legacy route files/comments reference old patterns (harmless).

## 3. Security & Production Hardening Gaps (Many Addressed)
**Already in tree (uncommitted):**
- `src/lib/rate-limit.ts` + integration in all AI serverFns (per-user:action buckets, 10/min default, returns retryAfter).
- `src/lib/env-validation.ts` + calls in `server.ts` (prod throw for OPENAI) and `start.ts`.
- `vercel.json` security headers (nosniff, DENY frame, referrer, permissions-policy).
- Analytics events for key funnels (deal_analyzed, report_exported, onboarding, signup, etc.) — PostHog only in PROD.

**Remaining / notes:**
- Rate limiting is **in-memory Map** (process-local). On Vercel serverless / multiple instances / cold starts it provides best-effort per-instance protection only. Not global. Fine for launch (throttles abuse per edge), but document limitation. Future: Upstash/Redis or Supabase rate limit table + RPC.
- No rate limiting on non-AI expensive ops (e.g. PDF export, photo uploads, deal saves) — low priority.
- Client opportunity delete bypasses the new rate limiter + central logging.
- Env validation only checks OPENAI; Supabase via @repo/supabase (good). Client validation is no-op.
- No explicit CSRF beyond framework + Supabase; TanStack Start + cookies + RLS is the model.
- No user-facing "you are rate limited, retry in Xs" special UI yet.
- Telemetry is present but optional (no key = silent).
- Invariants + tests protect against VITE_ secret leaks and client serverFn misuse.

**RLS/Supabase:** Solid per migration review. No service role in client code.

## 4. Architecture & Code Quality
- **Respected:** serverFns for all writes, _authed beforeLoad, one-way package deps (@repo/services for engines, shims in src/core for compat), Zod validators, logger not raw console (except inside logger), no edits to generated files.
- **Pricing/ROI:** Canonical in @repo/services; src/core/* are re-export shims or thin wrappers. All invariant tests (pricing-authority, pricing, dealScore, scoring) pass and assert determinism + mid_total authority.
- **UI:**  ~17/46 migrated per CLAUDE (Sidebar, some forms still local). Shims preserved.
- **Tests:** Only invariants (53 passing, cover auth-env, pricing, ROI, routes, scoring, deal score). No Vitest component tests yet (vitest.config exists).
- **Docs:** Excellent architecture, dependency rules, route map, mobile, beta plans. Some TODOs for future (refurb-iq, etc.).
- Uncommitted changes are low-risk surgical (rate limit, env, headers, small dashboard/project UX, AI wiring in copilot).

## 5. Other Observations
- No dev server running in this env.
- .env* present locally (correctly ignored).
- Node 24 / pnpm 9 local (CI is Node 22).
- Capacitor iOS artifacts present; production build uses `build:vercel`.
- Strong Sentry + logger + provider-diagnostics instrumentation in AI paths.
- PostHog funnel tracking + abandonment for key flows.

## Recommended Priority Fixes (for Phases 1-3)
**Phase 1 (Bugs/Stability — must):**
- Convert `useDeleteOpportunity` to serverFn (or patch opportunityStore like save).
- Add user feedback + retry for redesign generation failure.
- Add pending state + success toast for opportunity save.
- Improve rate limit error UX (specific message or toast with retryAfter).
- Add loading spinner/disable to project create submit.

**Phase 2 (UX Polish):**
- Polish / replace the compact AI estimate preview in `DealIntakeForm` to be structured, readable, trustworthy (use cards, better disclaimer, perhaps link to full project flow). Keep advisory emphasis.
- Enhance empty states (more context-specific copy/CTAs), add skeleton variants for dashboard projects list / trades tables.
- Consistent success toasts across saves/creates (report export already has).
- Review mobile touch targets, sidebar collapse on mobile, any horizontal scroll.
- First-run guidance (e.g. tooltip or banner in Deal Copilot or after first project).

**Phase 3 (Hardening — mostly done):**
- Keep/document the in-memory rate limit limitation.
- Optionally add simple rate limit to photo uploads or report export.
- Tighten any remaining direct client writes if high risk.
- Ensure PostHog key is set in Vercel prod env (for telemetry).
- Review full vercel.json + headers.

**Phase 4:**
- Full manual smoke of: signup/login, deal copilot (score + save + AI estimate), project create → upload photos → analysis (with fallback) → scope/estimate (AI + manual) → report export.
- pnpm build:vercel
- Update README + add release notes or checklist.
- Produce final Readiness Report.

## Files Touched in Exploration (key)
- Routes: dashboard, projects.new/upload/analysis/estimate/report/$id, deal-copilot/new, _authed, __root.
- Core AI: serverFns, all 4 openAi*.server.ts, platform/retry, validation, mockAnalysis.
- Hooks: useProjects, useAIEstimate, useScopeAnalysis, useOpportunities, useAuth.
- Components: DealIntakeForm (heavy), AIEstimateBuilder, AppLayout, EmptyState/LoadingState, Sidebar.
- Lib: analytics, env-validation, rate-limit (new).
- Server: server.ts, start.ts, serverFns/*.
- Migrations: all for RLS review.
- Packages: services pricing (via shims).

**Conclusion of Phase 0:** App is launch-ready with targeted surgical fixes + polish. No showstoppers. Proceed to Phase 1.

---
*Generated during agent exploration. Update before final report.*
