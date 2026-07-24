# Phase 0 — Inventory and Discovery Report

**Programme:** Repository Structure Improvement – Intelligent Platform
**Repository:** `glkglob/refurb-genius`
**Branch inspected:** `main` (aligned with `origin/main` at report time)
**Date:** 2026-07-24
**Mode:** Read-only discovery (no production architecture or behaviour changes)
**Evidence basis:** Live tree, import scans, invariant sources, CI workflows, architecture docs

---

## Phase result

```text
PASS
```

Phase 0 is complete. No production architecture was modified. This document is the sole Phase 0 deliverable artifact.

---

## 1. Verified architecture roots table

| Path | Exists | Role | Product ownership | Technical ownership | Notes |
|------|--------|------|-------------------|---------------------|-------|
| `src/core/refurbGenius/` | Yes | Product root (shim) | Refurb Genius | product composition | Re-exports `@repo/core` only; not a full product app shell |
| `src/core/refurbIq/` | Yes | Product root (reserved) | Refurb IQ | product composition | Empty `export {}` + README; no implementation |
| `src/core/dealCopilot/` | Yes | Assistant domain | Deal Copilot | assistant capability | Scoring, analysis types, opportunity store, server adapters |
| `src/components/deal-copilot/` | Yes | Assistant presentation | Deal Copilot | assistant capability | UI surfaces for chat, intake, score cards |
| `src/lib/deal-copilot/` | Yes | Assistant helpers (transitional) | Deal Copilot | transitional | Analysis orchestration, formatting, validation, diagnostics, safety |
| `src/serverFns/dealCopilot.ts` | Yes | Assistant transport | Deal Copilot | server transport | Opportunity CRUD server functions |
| `src/serverFns/dealChat.ts` | Yes | Assistant transport | Deal Copilot | server transport | Chat + threads; **direct Supabase** |
| `src/serverFns/dealAnalysis.ts` | Yes | Assistant transport | Deal Copilot | server transport | Analysis load; **direct Supabase** |
| `src/routes/` | Yes | Routing | Shared Intelligent Platform | routes | TanStack file routes; public + `_authed` |
| `src/routes/_authed/deal-copilot/` | Yes | Assistant routes | Deal Copilot | routes | Product-agnostic route composition today |
| `src/features/*` | Yes | Feature slices | Shared / RG | feature | 10 slices with public `index.ts` |
| `src/platform/*` | Yes | Platform foundations | Shared Intelligent Platform | platform | Auth, Supabase, OpenAI, HF, PostHog, Sentry, storage |
| `src/core/ai/` + `src/core/ai/platform/` | Yes | AI orchestration surface | Shared Intelligent Platform | platform / orchestration | Re-exports features; retry/orchestrator/cache |
| `src/services/` | Yes | Transitional | Shared | transitional | Frozen allowlist (5 files) |
| `src/lib/` | Yes | Transitional | Mixed | transitional | Frozen allowlist (~50 files incl. tests) |
| `src/hooks/` | Yes | App shell hooks | Shared | transitional | Frozen allowlist (7 files) |
| `src/integrations/supabase/` | Yes | Legacy integration surface | Shared | integration | Deprecated client re-export; types re-export `@repo/supabase` |
| `src/serverFns/` | Yes | Server transport | Shared | server transport | Auth, projects, deal\* |
| `src/components/` | Yes | App UI (non-slice) | Shared / RG | infrastructure / presentation | Many domain UIs still live here |
| `packages/core` | Yes | Domain package | Shared | core | Framework-independent primitives |
| `packages/services` | Yes | Domain engines | Shared | domain package | Pricing, ROI, deal-analysis, estimators |
| `packages/types` | Yes | Shared types | Shared | domain package | Deal opportunity types, etc. |
| `packages/supabase` | Yes | DB types + client factories | Shared | infrastructure | Generated types, browser/server factories, env |
| `packages/ui` | Yes | Design system | Shared | UI package | Migrating shadcn components |
| `packages/integrations` | Yes | Placeholder package | Shared | integration | Minimal stub (`index.ts` comment only) |
| `supabase/migrations/` | Yes | Schema history | Shared | infrastructure | 29 migrations |
| `supabase/functions/` | Yes | Edge functions | Shared | infrastructure | e.g. notification email |
| `tests/invariants/` | Yes | Architecture enforcement | Shared | infrastructure | 16 test files; **no** `tests/invariants/config/` |
| `docs/architecture/overview.md` | Yes | Architecture entry | Shared | documentation | De facto authoritative overview |
| `docs/architecture/README.md` | **No** | — | — | — | Does not exist |

### Feature slices (verified)

| Slice | Layers present |
|-------|----------------|
| `ai-design` | domain, application, infrastructure, presentation |
| `ai-upload` | domain, application, infrastructure, presentation |
| `auth` | presentation only (AuthExperience) |
| `estimate` | domain, application, infrastructure, presentation |
| `export` | domain, application, infrastructure, presentation |
| `feasibility` | domain, application, infrastructure, presentation |
| `gallery` | domain, application, infrastructure, presentation |
| `payment` | domain, application, infrastructure, presentation |
| `roi` | domain, application, infrastructure, presentation |
| `sharing` | domain, application, infrastructure, presentation |

### Platform modules (verified)

`analytics`, `auth`, `huggingface`, `logger`, `openai`, `payments`, `posthog`, `sentry`, `storage`, `supabase`, plus aggregates `browser.ts`, `server.ts`, `di.ts`.

---

## 2. Dependency edge report

Scanned static imports under `src/` and `packages/` (TypeScript). Summary of **high-value edges** required by the programme:

| Edge | Status | Evidence |
|------|--------|----------|
| Refurb Genius → Refurb IQ internals | **None found** | No imports of `@/core/refurbIq` from Genius product code; Genius root is `@repo/core` re-export |
| Refurb IQ → Refurb Genius internals | **None found** | Refurb IQ is empty reserved namespace |
| Product modules → Deal Copilot internals | **Partial / unclear product boundary** | Products are not isolated app trees; the single app shell imports Deal Copilot freely from routes/components/hooks |
| Deal Copilot → product internals | **Present (transitional)** | e.g. `DealIntakeForm` → `@/lib/projects`, `@/core/pricing`, `@/core/ai` |
| Deal Copilot → Supabase (direct) | **Present — violation vs target policy** | `opportunityStore.ts`, `DealChat.tsx` (realtime channel), `serverFns/dealChat|dealAnalysis|dealCopilot` |
| Deal Copilot → repositories | **Present** | Client store + serverFns query tables directly; not via feature repos |
| Features → product areas | **None found** | No feature imports of `@/core/refurbGenius` / `refurbIq` / `dealCopilot` |
| Packages → application source | **None found (enforced)** | `packages/*` do not import `@/` app paths (comments only in `@repo/supabase` docs) |
| `src/services` → consumers | **Routes only** | Trades routes + dashboard import trades stores |
| `src/lib` domain modules → consumers | **Widespread** | projects/photos/queries heavily used by components, routes, features, core |

### Deal Copilot multi-root map

| Root | Consumers |
|------|-----------|
| `src/core/dealCopilot` | components, hooks, serverFns types, routes |
| `src/components/deal-copilot` | routes under `_authed/deal-copilot` |
| `src/lib/deal-copilot` | Deal Copilot components |
| `src/serverFns/deal*` | components + opportunity store (save/delete path) |

### Cross-product isolation note

There is **no separate Refurb Genius / Refurb IQ application boundary in code** today. Isolation is conceptual (`src/core/refurbGenius`, `src/core/refurbIq`) plus a single TanStack Start app. Phase 1–3 product isolation invariants must be defined against **verified paths**, not an assumed multi-app layout.

---

## 3. Existing violation table

Relative to the **target** Intelligent Platform policy (not necessarily failing CI today). Classifications:

| ID | Rule (target) | Status | Location(s) | CI today |
|----|---------------|--------|-------------|----------|
| V1 | Packages ↛ application source | Compliant | packages/* | Enforced (`package-dependency.invariant`) |
| V2 | Product Genius ↛ IQ internals | Compliant (vacuous) | n/a | Not specifically named |
| V3 | Product IQ ↛ Genius internals | Compliant (vacuous) | n/a | Not specifically named |
| V4 | Deal Copilot ↛ direct Supabase | **Violates target** | `opportunityStore.ts`, `DealChat.tsx`, `serverFns/dealChat.ts`, `dealAnalysis.ts`, `dealCopilot.ts` | Not blocked |
| V5 | Deal Copilot ↛ presentation SDK clients | **Violates target** | `DealChat.tsx` browser Supabase channel | Not blocked |
| V6 | Presentation ↛ direct Supabase | **Many** | components, routes, hooks, feature presentation | Partially allowed via baselines |
| V7 | `src/services` no new permanent domain | **Frozen allowlist** | 5 files | Enforced (new files fail) |
| V8 | `src/lib` no expansion of domain surface | **Frozen allowlist** | ~50 files | Enforced (new files fail) |
| V9 | Routes/hooks/components ↛ `@/lib` `@/core` etc. | **Baselined** | Large `BASELINE_ALLOWLIST` in `no-legacy-imports` | New edges fail; baseline retained |
| V10 | Vendor SDKs only in platform/packages | **Mostly compliant** | Direct `openai` / `@huggingface` only under `src/platform/*` | Enforced |
| V11 | Feature infrastructure only for vendor | **Compliant pattern** | Feature adapters call `getOpenAIClient` / HF platform | Enforced in feature-slice tests |
| V12 | Auth presentation uses Supabase client | **Allowed today / review** | `AuthExperience.tsx` | Expected for auth UX |
| V13 | ServerFns own persistence orchestration | **Mixed** | deal\* and projects serverFns query DB inline | Transitional transport |

**Baseline mechanism quality:**
Existing baselines are **exact string allowlists** (good), but lack structured fields: `owner`, `issue`, `reviewBy`, `rule`. Stale baseline detection exists for `no-legacy-imports` (resolved entries printed). Expired-exception semantics (date-based) **do not exist**.

---

## 4. Supabase access map

### Canonical factories (approved infrastructure)

| Location | Role |
|----------|------|
| `packages/supabase/src/browser.ts` | `createBrowserSupabase` |
| `packages/supabase/src/server.ts` | `createServerSupabase`, `createTokenSupabase`, `verifyToken` |
| `packages/supabase/src/env.ts` | env resolution |
| `packages/supabase/src/database.types.ts` | generated `Database` types |
| `src/platform/supabase/_client.ts` | app browser singleton |
| `src/platform/supabase/browser.ts` | re-export + setup warnings |
| `src/platform/supabase/server.ts` | re-export server factories |
| `src/platform/browser.ts` / `server.ts` | DI aggregates |

### Classification of call sites

| Classification | Meaning | Examples |
|----------------|---------|----------|
| **Approved infrastructure** | Factory / types / platform composition | `packages/supabase/*`, `src/platform/supabase/*` |
| **Feature repository (target-aligned)** | Feature infra repositories | `features/*/infrastructure/repositories/*`, `reportRepository`, `shareLink.repository` |
| **Transitional data access** | `src/lib/*`, `src/services/*`, `src/hooks/*` stores/queries | `lib/projects`, `lib/photos`, `lib/queries/*`, trades stores |
| **Likely boundary violation (vs target policy)** | Presentation or assistant direct client | components marketplace/floorplan/photos, routes admin, DealChat, opportunityStore |
| **Server transport (acceptable if thin)** | `createServerFn` + server client | `serverFns/auth.server`, `gallery/serverFns`, deal serverFns |
| **Scripts / edge** | Ops tooling | `scripts/bootstrap-admin.ts` (service role), `supabase/functions/send-notification-email` |
| **Deprecated** | Legacy path | `src/integrations/supabase/client.ts` (marked deprecated; still constructs client) |

### Presentation / route / hook direct Supabase (non-exhaustive, verified)

| File | Purpose | Desired home |
|------|---------|--------------|
| `src/features/auth/presentation/AuthExperience.tsx` | Auth signup/sign-in/OAuth | Keep via platform auth API (acceptable) |
| `src/features/feasibility/presentation/hooks/useProjectCatalog.ts` | Project catalog query | feature application + repo |
| `src/routes/_authed/admin.tsx` | Admin profile listing | admin feature / serverFn |
| `src/routes/_authed/dashboard.tsx` | Onboarding goal `updateUser` | auth/onboarding helper |
| `src/routes/auth_.callback.tsx` | OAuth callback session | platform auth |
| `src/components/BulkPhotoUpload.tsx` | Upload path | feature ai-upload / storage service |
| `src/components/floorplan/FloorplanViewer.tsx` | Floorplan data | feature infrastructure |
| `src/components/marketplace/*` | Messaging/quotes | trades/marketplace feature |
| `src/components/photos/PhotoAnalysisViewer.tsx` | Photo analysis reads | ai-upload |
| `src/components/deal-copilot/DealChat.tsx` | Realtime channel | assistant infrastructure (not presentation) |
| `src/hooks/useProjects.ts` | Projects query | feature / queries layer |
| `src/hooks/useGallery.ts` | Gallery | gallery feature |
| `src/hooks/useOpportunities.ts` | Opportunities | Deal Copilot public API |

Rough count: **~89** `supabase.(from|auth|storage|rpc)` usages under `src/`; **~13** files under `components`+`routes`+hooks import platform browser client directly.

### Data ownership (provisional — not invented)

| Data area | Observed consumers | Migration owner (provisional) | Gap |
|-----------|-------------------|-------------------------------|-----|
| `profiles` | auth, admin, role | platform / shared | company mapping migration exists |
| `projects` / photos | lib/projects, lib/photos, features | Refurb Genius | ownership matrix incomplete |
| `deal_opportunities`, threads, messages | deal serverFns, opportunityStore | Deal Copilot | assistant owns behaviour; persistence in serverFns |
| `trades_jobs`, interests, trade_profiles | `src/services/trades/*` | Shared marketplace | still in transitional services |
| `feasibility_studies`, estimates, room analyses | feature repositories | feature owners | relatively aligned |
| Storage `project-photos` | lib/photos, services/storage | Refurb Genius | transitional |

**Unresolved:** formal product vs shared schema ownership matrix (Phase 4).

---

## 5. AI provider access map

### Direct SDK imports (verified)

| Package | Import sites | Layer |
|---------|--------------|-------|
| `openai` | `src/platform/openai/server.ts` **only** | platform (approved) |
| `@huggingface/inference` | `src/platform/huggingface/server.ts` **only** | platform (approved) |
| Anthropic | **None** | — |
| Gemini / `@google/generative-ai` | **None** | — |
| `@ai-sdk/*` | **None** | — |

### Platform abstractions (canonical)

| Path | Capability |
|------|------------|
| `src/platform/openai/server.ts` | `getOpenAIClient` + Sentry instrumentation |
| `src/platform/huggingface/server.ts` | HF config, vision/text clients |
| `src/core/ai/platform/retry.ts` | retry helper |
| `src/core/ai/platform/orchestrator.ts` | multi-step orchestration |
| `src/core/ai/platform/cache.ts` | cache helper |
| `src/core/ai/validation.ts` | estimate response schemas |
| `src/core/ai/index.ts` | public re-export of feature AI capabilities |

### Call sites using platform (allowed pattern)

| File | Context | Through platform? |
|------|---------|-------------------|
| `features/ai-upload/.../ai-vision.adapter.server.ts` | Photo vision | Yes (`getOpenAIClient` + retry) |
| `features/ai-upload/.../hf-vision.adapter.server.ts` | HF vision | Yes |
| `features/ai-design/.../ai-redesign.adapter.server.ts` | Redesign | Yes |
| `features/ai-design/.../ai-scope.adapter.server.ts` | Scope | Yes + retry |
| `features/estimate/.../ai-estimate.adapter.server.ts` | AI estimate | Yes + retry |
| `core/dealCopilot/server/dealChat.adapter.server.ts` | Assistant chat | Yes |
| `core/dealCopilot/server/dealAnalysis.adapter.server.ts` | Assistant analysis | Yes |

### Duplicated / scattered AI concerns

| Concern | Where observed | Consolidation status |
|---------|----------------|----------------------|
| Provider selection | Feature adapters + env flags | Partial; not a single policy module |
| Model policy | Per-adapter constants | Scattered |
| Prompt handling | Inside each adapter | Per-feature |
| Retry | `@/core/ai/platform/retry` used by several adapters | Shared helper exists |
| Rate limiting | `src/lib/rate-limit.ts` | Transitional lib |
| Cost attribution | Not systematically implemented | Gap |
| Telemetry | Sentry instrument on OpenAI client; PostHog analytics | Partial |
| Diagnostics | `lib/provider-diagnostics`, `provider-health-analysis`, AI quality audit | Transitional lib |
| Offline / mock fallbacks | Deal Copilot adapters when no key | Local to adapters |

### Allowed vs legacy paths (AI)

| Path | Status |
|------|--------|
| `src/platform/openai|huggingface` → feature `*.adapter.server.ts` → `createServerFn` | **Allowed / canonical** |
| Presentation / product UI importing `openai` SDK | **Forbidden** (none found) |
| Domain packages importing OpenAI | **Forbidden** (enforced) |
| `src/lib/provider-*` diagnostics | **Transitional** |
| Deleted shims under `src/core/ai/server/*` | **Removed** (shim-cleanup invariant) |

---

## 6. `src/services` inventory

| File | Exports (role) | Dependencies | Consumers | Classification |
|------|----------------|--------------|-----------|----------------|
| `projects/index.ts` | Re-export project store helpers | `@/core/projects`, `@/lib/projects` | Limited (facade) | **Compatibility facade** |
| `storage/index.ts` | Bucket URL helpers, wraps photo store | platform supabase, `@/lib/photos` | Components via photo flows | **Infrastructure adapter (transitional)** |
| `trades/tradesJobStore.ts` | CRUD for trades jobs | platform supabase, `@repo/supabase` types, `@/core/trades` | trades routes, dashboard | **Infrastructure repository (transitional)** |
| `trades/tradesJobInterestStore.ts` | Interest CRUD + notifications | supabase, logger, core trades | trades routes, dashboard | **Infrastructure repository (transitional)** |
| `trades/tradeProfileStore.ts` | Trade profile upsert/get | supabase, core trades | trades profile route | **Infrastructure repository (transitional)** |

**Freeze:** Exact file set enforced by `SERVICES_ALLOWLIST` in `legacy-layer-freeze.invariant.test.ts`.
**Prohibited expansion (policy intent):** new files, new SDK/DB domains without migration.
**Ultimate homes:** trades → `src/features/trades` (or marketplace) infrastructure; storage → platform storage + feature photo repo; projects facade → feature/projects public API.

---

## 7. `src/lib` classification

| File / group | Classification | Domain leakage? | Desired home |
|--------------|----------------|-----------------|--------------|
| `utils.ts`, `file-utils.ts`, `concurrency.ts`, `timeout.ts`, `rate-limit.ts` | pure / framework utility | No | Stay lib or `@repo/core` |
| `logger.ts`, `telemetry.ts`, `observability.ts`, `error-capture.ts`, `error-page.ts` | infrastructure helper | Soft | platform logger/observability |
| `analytics.ts`, `sentry.ts` | infrastructure helper | Soft | already partially platform |
| `auth.ts`, `role.ts` | infrastructure / auth facade | Auth session | platform auth |
| `env-validation.ts`, `email.ts` | infrastructure helper | No domain rules | platform |
| `projects.ts`, `photos.ts`, `gallery.ts`, `floorplan.ts` | feature-specific + **DB access** | **Yes (infra + domain store)** | feature infrastructure |
| `queries/*` | feature-specific query options + **DB** | **Yes** | feature application/infrastructure |
| `mappers.ts` | domain-bearing helper | Yes (row→domain) | feature/shared mappers package |
| `estimate.ts` | domain-bearing compatibility | Yes | feature estimate / `@repo/services` |
| `exportPdf.ts`, `pitchDeck.ts`, `redesign.ts`, `mockData.ts` | feature/product helpers | Partial | features |
| `deal-copilot/*` | assistant-specific helpers | Yes (orchestration/validation) | `src/core/dealCopilot` or assistant package |
| `ai-quality-*`, `provider-*` | AI ops helpers | Ops/domain-adjacent | platform AI governance |
| `*.test.ts` under queries | tests | — | remain with modules |

**Freeze:** Full directory file-set allowlist (not only domain-bearing subset). Pure utilities **cannot** be added without allowlist edit — stricter than “freeze-lite” target policy. Phase 1–2 should decide whether to **narrow** freeze to domain-bearing files only.

---

## 8. Existing invariant capabilities

| Test file | What it enforces | Baseline / exception style |
|-----------|------------------|----------------------------|
| `legacy-layer-freeze.invariant.test.ts` | No new files in `src/lib`, `src/hooks`, `src/services` outside allowlists | Exact path allowlists; soft on deletions |
| `no-legacy-imports.invariant.test.ts` | routes/hooks/components/serverFns ↛ `@/core|lib|services|integrations` beyond baseline | Exact `source\|import` allowlist; detects resolved entries |
| `package-dependency.invariant.test.ts` | packages ↛ app; domain packages ↛ React/Supabase/OpenAI | Hard fail |
| `platform-boundary.invariant.test.ts` | Vendor SDK imports only platform/packages | Hard fail |
| `server-only-boundary.invariant.test.ts` | No static server imports on client surfaces; no VITE_ secrets | Hard fail |
| `auth-env.invariant.test.ts` | No client-exposed service role / OpenAI keys | Hard fail |
| `feature-slice.invariant.test.ts` | Slice layering; domain no IO; infra no direct openai package | Per-slice |
| `public-api-boundary.invariant.test.ts` | Cross-feature imports via public API | Hard fail |
| `routes.invariant.test.ts` | Route file existence + docs | Structural |
| `shim-cleanup.invariant.test.ts` | Deleted AI shims stay gone | Hard fail |
| `ui-migration.invariant.test.ts` | UI package migration rules + known sidebar exception | Partial exceptions |
| `pricing*.test.ts`, `dealScore`, `scoring`, `estimator-engines` | Financial determinism / authority | Behavioural |

**Missing vs programme Phase 2–3 targets:**

- No `tests/invariants/config/` registry modules
- No dedicated product isolation invariant (Genius ↔ IQ)
- No dedicated Deal Copilot multi-root isolation invariant
- No structured baselines with owner/issue/reviewBy
- No expired-exception date enforcement
- No PR template architecture checklist

---

## 9. Documentation assessment

| Question | Finding |
|----------|---------|
| Architecture entry point | `docs/architecture/overview.md` (linked from `docs/README.md` and CLAUDE.md). **No** `docs/architecture/README.md` |
| Agent canonical guide | `CLAUDE.md` (repo root) — strong operational source of truth |
| Conflicting / overlapping statements | Multiple parallel docs: `FEATURE_SLICE.md`, `platform-architecture-plan.md`, `dependency-rules.md`, `platform-boundary.md`, `domain-ownership-audit.md`, `repo-convergence-plan.md`. Generally aligned on feature slices + packages; **Intelligent Platform three-product model** is stronger in plan/convergence docs than in overview’s “single app” framing |
| ADR convention | **No ADR directory or template found** under `docs/` |
| Product ownership docs | Partial (`refurbIq/README`, deal-copilot governance, convergence plan) |
| Capability / package ownership | `package-registry.md`, `capability-boundaries.md`, `domain-ownership-audit.md` |
| Data ownership | Incomplete; domain-ownership-audit covers engines more than tables/RLS |
| Data ownership for migrations | Migrations exist; ownership matrix not formalised |

**Phase 1 recommendation:** Make `docs/architecture/overview.md` the explicit authoritative architecture policy document (already the index entry). Create first ADR under a new conventional path only if Phase 1 approves (e.g. `docs/architecture/adr/0001-intelligent-platform.md`).

---

## 10. CI assessment

### Scripts (`package.json`)

| Script | Present |
|--------|---------|
| `pnpm lint` | Yes |
| `pnpm typecheck` | Yes |
| `pnpm test:invariants` | Yes |
| `pnpm test:ui` | Yes |
| `pnpm build` / `build:vercel` | Yes |
| `pnpm test` | **No** (missing script) |
| `pnpm format` | Yes |
| `security:*` | Yes |

### GitHub Actions

| Workflow | Jobs |
|----------|------|
| `.github/workflows/ci.yml` | `ci`: install, **typecheck, lint, build:vercel**; separate job `invariant-tests`: `pnpm test:invariants` |
| `.github/workflows/security.yml` | Security (present) |
| Dependabot | Yes |

**Gaps:**

- `test:ui` (Vitest) **not** in CI `ci` job
- PR template **absent** (no architecture impact section)
- CI uses `npm run typecheck/lint` after pnpm install (works via package.json scripts)

### Local pre-commit

Git hooks install via `prepare` → gitleaks + partial security invariants on commit (verified previously on this branch).

---

## 11. Recommended exact Phase 1 inputs

Use these verified facts only — do not invent paths:

1. **Authoritative doc:** Update `docs/architecture/overview.md` (not create competing README unless consolidating links).
2. **State verified roots** exactly as §1 tables (include multi-root Deal Copilot).
3. **State product reality:** single TanStack app; Refurb IQ reserved; Refurb Genius shim; Deal Copilot multi-root.
4. **Document three ownership axes** with data ownership marked “incomplete — Phase 4”.
5. **Freeze policies:**
   - `src/services`: freeze matches existing allowlist (5 files).
   - `src/lib`: note current freeze is **whole-directory file allowlist** (stricter than freeze-lite); Phase 1 should either adopt freeze-lite language carefully or document “full freeze until registry split”.
6. **packages/services:** retain; cite existing engines and exit criteria from programme.
7. **Baseline honesty:** list V4–V6, V9 as known debt; do not claim Deal Copilot isolation is enforced.
8. **ADR:** introduce convention + first ADR for Intelligent Platform + freeze + baseline-first rollout.
9. **No code enforcement changes in Phase 1.**
10. **Link** overview → FEATURE_SLICE, platform-boundary, package-registry; fix contradictions on multi-app wording.

### Phase 1 non-goals

- No new invariants
- No folder moves
- No Supabase repository rewrite
- No packages/services split
- No `src/workflows`

---

## Findings (executive)

1. Repository is a **single app monorepo** with package extraction and feature slices — not multi-app `apps/*` yet.
2. **Deal Copilot has four live roots** and **direct Supabase access** in store, presentation, and serverFns — highest-value future invariant target.
3. **Transitional freezes already exist** for `src/lib`, `src/hooks`, `src/services` via exact path allowlists.
4. **AI SDK isolation is strong** (platform-only direct imports); call-site adapters are largely correct.
5. **Supabase access is fragmented** across feature repos (good), lib stores (transitional), components (violations vs target), assistant (violations vs target).
6. **Invariant suite is mature** for packages/platform/server-only/legacy freeze, but lacks product isolation + structured baselines + PR architecture checklist.
7. **No ADR system** and **no invariant config registry directory**.
8. **CI runs invariants + typecheck + lint + vercel build**; Vitest UI tests are not in CI.

---

## Changes made

| Action | Path |
|--------|------|
| Created inventory report | `docs/architecture/phase-0-inventory-report.md` |

No production code, invariants, or package structure modified.

---

## Baselines and exceptions

None added or removed (read-only phase).

---

## Validation

| Command | Result | Notes |
|---------|--------|-------|
| Live tree inspection | Pass | `src/`, `packages/`, `tests/invariants/`, `docs/architecture/`, `supabase/`, `.github/` |
| Import / dependency scans | Pass | rg across products, packages, services, Deal Copilot, AI SDKs |
| CI / scripts inspection | Pass | `ci.yml`, `package.json` scripts |
| Architecture docs inspection | Pass | overview entry + related docs |
| `pnpm lint` / `typecheck` / `test` / `build` | **Not run** | No production code changes; Phase 0 is documentation-only |

---

## Architecture impact

```text
Product owner: Shared Intelligent Platform (inventory only)
Technical owner: architecture documentation
Data owner: unresolved (catalogued gaps only)
New dependency edges: none
Removed dependency edges: none
Transitional layer impact: none (documented only)
packages/services impact: none (documented retention)
```

---

## Deviations

| Planned assumption | Repository reality |
|--------------------|--------------------|
| Possible `docs/architecture/README.md` | Does not exist; `overview.md` is entry |
| `tests/invariants/config/` | Does not exist; allowlists live inside test files |
| Multi-app product roots | Product roots are thin/reserved; single app shell |
| PR template | None present |
| `pnpm test` | Script missing; use `test:ui` + `test:invariants` |

---

## Next gate

```text
Phase 1 is safe to begin.
```

Inputs for Phase 1 are fully specified in §11. Do not start Phase 2 registry/enforcement until Phase 1 documentation is accepted.
