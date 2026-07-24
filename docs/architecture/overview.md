# Intelligent Platform — Architecture Overview

> **Status:** Authoritative architecture policy (Phase 1 + Phase 2 registry).
> **Evidence base:** [Phase 0 inventory report](./phase-0-inventory-report.md) (verified tree, imports, CI, invariants).
> **Decision record:** [ADR 0001](./adr/0001-adopt-rules-first-incremental-architecture-governance.md) · [ADR index](./adr/README.md).
> **Architecture registry:** [`tests/invariants/config/`](../../tests/invariants/config/) (machine-readable metadata).
> **Data architecture registry:** [`tests/invariants/config/data/`](../../tests/invariants/config/data/) (Phase 4 — ownership, tenancy, tables, storage).
> **Docs index:** [docs/README.md](../README.md).
> **Agent operational guide:** [`CLAUDE.md`](../../CLAUDE.md) (implementation rules; this document governs architecture policy).

| Field | Value |
| ----- | ----- |
| **Owner** | Platform architecture (repository maintainers) |
| **Last reviewed** | 2026-07-24 |
| **Review cadence** | On every review trigger (below); otherwise at least quarterly |

This document is the **single authoritative architecture overview** for the repository.
Supporting docs (feature-slice, platform-boundary, dependency-rules, package-registry, etc.)
provide detail. Where they conflict with **verified current state** described here, treat
this overview plus Phase 0 evidence as higher priority until those docs are updated.

---

## How to read this document

| Label | Meaning |
| ----- | ------- |
| **Current** | Verified repository reality today |
| **Target** | Intended end state for Intelligent Platform governance |
| **Transitional** | Allowed temporarily; must not expand without review |
| **Reserved** | Namespace exists; little or no product implementation |
| **Enforced** | Covered by existing CI invariant tests |
| **Documented (unenforced)** | Policy accepted; not yet machine-enforced for all roots |
| **Known exception / debt** | Exact current violations of target policy (may still pass CI) |

**Governing delivery sequence:**

```text
document → register when verified → enforce narrowly → baseline → migrate incrementally
```

Enforcement must follow **verified ownership** and **accepted policy**. Do not enable
broad architecture checks that invent paths or assume multi-app layouts.

---

## 1. Platform model

### Current

The repository implements **one Intelligent Platform** as a **pnpm workspace monorepo**
hosting a **single TanStack Start** SSR application rooted at **`src/`**
(React 19 + Vite 7 + Nitro). It is **not** currently an `apps/*` multi-application monorepo.

Product experiences share that shell:

| Surface | Role (product ownership) | Current implementation status |
| ------- | ------------------------ | ----------------------------- |
| **Intelligent Platform** | Shared foundations, packages, platform seams, routes shell | Live |
| **Refurb Genius** | Public-facing refurbishment application (projects, photos, estimates, reports, trades, gallery) | Live product behaviour in routes/features/components |
| **Deal Copilot** | Shared intelligent assistant for deal underwriting and chat | Live; **multi-root** (see ownership) |
| **Refurb IQ** | Commercial / professional property intelligence product boundary | **Reserved namespace only** — no meaningful implementation |

### Target

- Product experiences composed from **features**, **platform**, and **framework-independent packages**.
- Clear product isolation when products have real code surfaces.
- Deal Copilot uses approved tools, feature public APIs, orchestration, domain packages, and platform AI — **not** direct persistence from presentation or uncontrolled product internals.
- Supabase access concentrated in **feature infrastructure repositories** and **platform factories**.
- Optional future `apps/*` only if ownership, deployment, or release cadence **justify** it (not assumed).

### Explicit non-goals (now)

- Immediate repository-wide folder rewrite.
- Speculative `apps/*` split.
- Treating reserved namespaces as completed product boundaries.
- Broad enforcement before ownership is registered and baselined (Phase 2–3).

---

## 2. Current high-level structure

```
┌─────────────────────────────────────────────────────────────┐
│         Production shell (repo-root src/) — immovable        │
│  TanStack Start + Vite 7 + Nitro SSR + React 19             │
│                                                             │
│  src/                                                       │
│  ├── routes/            Thin file routes (current)          │
│  ├── features/          Vertical slices (canonical new work)│
│  ├── platform/          Vendor SDK seams (current)          │
│  ├── components/        App shell + product UI (mixed)      │
│  ├── core/              Engines, product namespaces, AI     │
│  ├── lib/ · hooks/ · services/   Transitional (frozen)      │
│  ├── serverFns/         createServerFn transport            │
│  ├── integrations/      Legacy Supabase type/client surface │
│  └── server.ts          Nitro entry                         │
└─────────────────────────────────────────────────────────────┘
                              ▲
        packages: @repo/types → @repo/core → @repo/services
                  @repo/supabase · @repo/ui · @repo/integrations (stub)
```

**Canonical in-app request flow (target for new work):**

```text
Route → feature presentation → application / use case → domain
     → infrastructure (repos / adapters) → platform / @repo packages
```

Routes stay thin. Domain rules do not grow in generic folders.
Application **features** stay app-local unless a package exit criterion is met.

Detail: [FEATURE_SLICE.md](./FEATURE_SLICE.md) · [runtime-boundaries.md](./runtime-boundaries.md).

---

## 3. Ownership boundaries (verified)

### Product ownership (roadmap, UX, terminology, packaging)

| Product | Owns (intent) | Code reality today |
| ------- | ------------- | ------------------ |
| Refurb Genius | Investor refurb workflows, project UX, marketplace (RG-facing), gallery | Implemented primarily via routes, features, `src/components`, transitional `src/lib` stores — **not** via a thick `src/core/refurbGenius` app |
| Refurb IQ | Commercial / professional workflows (BOQ, specs, cost plans, …) | **Reserved only** (`src/core/refurbIq`) |
| Deal Copilot | Assistant UX, deal intake, scoring presentation, chat | Multi-root (below) |
| Shared Intelligent Platform | Auth, observability, AI providers, Supabase factories, domain engines | `src/platform`, packages |

### Technical ownership of key paths

| Path | Role | Status |
| ---- | ---- | ------ |
| `src/core/refurbGenius` | Product root label | **Compatibility shim** re-exporting `@repo/core` — not a full product shell |
| `src/core/refurbIq` | Product root label | **Empty reserved namespace** (`export {}` + README) |
| `src/core/dealCopilot` | Assistant domain + client store + server AI adapters | **Current** multi-root core |
| `src/components/deal-copilot` | Assistant presentation UI | **Current** |
| `src/lib/deal-copilot` | Assistant helpers (analysis, validation, formatting, diagnostics) | **Transitional** |
| `src/serverFns/deal*` | Assistant / deal transport (`dealCopilot`, `dealChat`, `dealAnalysis`) | **Current**; includes direct Supabase (**target debt**) |
| `src/routes/_authed/deal-copilot/*` | Assistant routes | **Current** |
| `src/features/*` | Vertical capabilities (public `index.ts`) | **Canonical** for new feature work |
| `src/platform/openai` | OpenAI client factory (server-only) | **Current / enforced SDK home** |
| `src/platform/huggingface` | Hugging Face client factory (server-only) | **Current / enforced SDK home** |
| `src/platform/supabase` | App Supabase singleton + re-exports of `@repo/supabase` | **Current** |
| Feature `*/infrastructure/repositories/*` | Persistence for that feature | **Preferred** pattern (partial adoption) |
| `src/lib` | Mixed utilities + domain stores + queries | **Transitional**, full file freeze |
| `src/hooks` | App-shell hooks | **Transitional**, file freeze |
| `src/services` | Trades stores + thin facades | **Transitional**, file freeze |
| `packages/core` | Framework-independent primitives | **Current** |
| `packages/services` | Deterministic pricing, ROI, deal scoring, estimators | **Current — retain** (see exit criteria) |
| `packages/types` | Shared domain types / DTOs | **Current** |
| `packages/supabase` | Generated DB types + client factories | **Current** |
| `packages/ui` | Design-system components | **Current** (migration in progress) |
| `packages/integrations` | Placeholder package | **Stub** |

### Deal Copilot multi-root (do not pretend one folder is the whole assistant)

| Root | Responsibility today |
| ---- | -------------------- |
| `src/core/dealCopilot` | Types, scoring re-exports, opportunity store, server AI adapters |
| `src/components/deal-copilot` | UI |
| `src/lib/deal-copilot` | Client-side analysis orchestration and helpers |
| `src/serverFns/deal*` | Auth-gated server transport and some persistence |

**Product-isolation evidence is limited:** Refurb IQ has no meaningful implementation; Genius and IQ do not form separate importable product trees. Do not claim multi-product isolation is “done.”

### Data ownership

Formal machine-readable inventory: [`tests/invariants/config/data/`](../../tests/invariants/config/data/) (Phase 4).

| Area | Owner | Notes |
| ---- | ----- | ----- |
| Shared schema / migrations / RLS | Shared Intelligent Platform | `supabase/migrations/`; policy in `data/migrations.ts` |
| Feature tables (estimates, analyses, feasibility, shares) | Refurb Genius features + platform review | Prefer feature repositories |
| Deal opportunity / chat tables | Deal Copilot | Persistence often serverFns / client store — **transitional** |
| Trades tables | Marketplace | Access via `src/services/trades/*` — **transitional** |
| Generated types | `@repo/supabase` | Do not treat row types as domain models at UI boundary |
| Tenant model | Per-user RLS (+ admin + public surfaces) | **No organisation multi-tenancy** in public schema today |

Integrity (Phase 5): `tests/invariants/data-architecture-registry.invariant.test.ts` — table/domain/storage/migration drift ratchets vs generated types and repo evidence. **Does not change RLS or schema.** Partial RLS claims remain partial.

---

## 4. Architecture principles

1. **Separate concerns:** product composition, assistant capability, feature capability, platform, integration, server transport, domain packages, core, UI package.
2. **Dependency direction (primary orchestration):**
   `routes → products / assistants → orchestration / feature public APIs → domain packages → core`
   Supporting edges may include routes → platform auth; products → feature public APIs + `@repo/ui`; assistants → approved tools + feature queries + platform AI. Not every module must pass through every layer.
3. **Ownership is three-axis:** product, technical, data — all three for structural decisions.
4. **Public APIs:** features expose supported imports through slice `index.ts` (and infrastructure barrels where documented). Cross-feature internal imports are discouraged (**partially enforced**).
5. **Data ownership:** migrations, RLS, buckets, and repositories have named owners; presentation does not invent ad hoc tables.
6. **Tenant isolation:** RLS and server auth remain the source of multi-tenant safety; client stores must not bypass server rules for privileged writes.
7. **Direct infrastructure access:** prefer platform factories + feature repositories. Direct Supabase from presentation/routes is **target debt**.
8. **Provider SDK isolation:** OpenAI / Hugging Face SDKs only via `src/platform/*` (and package factories). Feature adapters call platform helpers. **Strongly enforced** today for direct package imports.
9. **Feature repositories:** map persistence types to domain/DTOs at infrastructure boundaries.
10. **Transitional layers:** frozen or freeze-lite; shrink via migration, do not expand casually.
11. **Migration policy:** incremental, behaviour-preserving, with tests; no broad rewrites for cleanliness alone.
12. **Exceptions:** temporary, owned, scoped, reviewable (see §8). No wildcards.
13. **Testing and machine enforcement:** financial invariants and existing architecture invariants remain; new architecture rules land only after register + baseline (Phases 2–3).
14. **Deployment / rollback:** root `src/` shell and route generation stay immovable; package extraction must not break Vite/TanStack resolution; prefer reversible shims when moving code.

---

## 5. Dependency policy

### Target direction (policy — not fully enforced)

| Rule | Enforcement today |
| ---- | ----------------- |
| Packages must not import application `src/*` | **Enforced** (`package-dependency.invariant`) |
| Domain packages must not import React / Supabase / OpenAI SDKs | **Enforced** (package-dependency) |
| Direct vendor SDK imports only under approved platform / package paths | **Enforced** (`platform-boundary.invariant`) |
| Feature domain layers must not import IO / OpenAI package | **Enforced** (feature-slice invariant) |
| Cross-feature imports via public API | **Enforced** (public-api-boundary) |
| Routes/hooks/components/serverFns ↛ new `@/lib|core|services|integrations` edges | **Baselined** (`no-legacy-imports`); existing edges allowed until removed |
| Refurb Genius ↛ Refurb IQ internals and reverse | **Documented**; vacuous today (IQ empty); **not a named product-isolation invariant** |
| Product modules ↛ Deal Copilot internals | **Documented**; single-app shell freely composes assistant today — **unenforced as product isolation** |
| Deal Copilot ↛ direct Supabase / product internals / feature infrastructure internals | **Documented target**; **not enforced** — known debt (Phase 0 V4–V6) |
| Presentation / routes should not own persistence | **Documented target**; many current violations baselined or unchecked |
| New direct Supabase outside approved repos / platform | **Documented**; prefer feature infrastructure |
| Transitional layers must not expand without review | **Enforced as file freezes** for lib/hooks/services |

### Product and assistant rules (target wording)

- **Refurb Genius** must not import Refurb IQ internals, Deal Copilot internals (when isolation is enforced), feature infrastructure internals, or direct persistence from presentation.
- **Refurb IQ** must follow the equivalent rule when implemented.
- **Deal Copilot may use:** approved tools, application commands, feature query/public APIs, orchestration, shared domain capabilities (`@repo/services`, `@repo/types`), platform AI interfaces, shared contracts, core, UI primitives.
- **Deal Copilot must not use (target):** direct Supabase clients from presentation, ad hoc DB repositories outside approved infrastructure, product internals, feature infrastructure internals, provider SDKs from presentation.

### packages/services retention

`@repo/services` remains the home for deterministic financial engines (pricing, ROI, deal scoring, estimators). **Do not split or rename** unless exit criteria are met: multiple independent consumers, zero application-source dependencies, no framework dependencies, cohesive domain API, independent tests, verified ownership.

---

## 6. Transitional-layer policy

### Surfaces

| Layer | Freeze mechanism (current) | Policy |
| ----- | -------------------------- | ------ |
| `src/services` | Exact path allowlist (5 files) in `legacy-layer-freeze.invariant.test.ts` | **Freeze.** No new permanent services, domain engines, provider clients, or unreviewed public-surface expansion. Allowed: defect fixes, shims, deprecation, extraction adapters, deletion after migration. |
| `src/hooks` | Exact path allowlist (7 files) | App-shell hooks only; feature hooks belong in features. |
| `src/lib` | Exact path allowlist (~50 files including tests) | **Full directory file freeze — stricter than programme “freeze-lite”.** Remains unchanged until a later phase explicitly reviews freeze-lite. Domain-bearing modules (projects, photos, queries, deal-copilot helpers, etc.) are **debt**, not the long-term home for new domain logic. Pure utilities theoretically belong here only if allowlisted after review. |

### Rules

1. Existing allowlisted files may remain temporarily.
2. **New files or ownership expansion** require explicit review (and allowlist update in the invariant test until a config registry exists).
3. Migrations are **incremental**; consumers move first; behaviour preserved.
4. **Unrelated broad rewrites are prohibited.**
5. Deletion only after consumers moved and verification passes.
6. Allowlists freeze **current paths**; they are **not** the final target architecture.

Allowlist source of truth (implementation):
`tests/invariants/legacy-layer-freeze.invariant.test.ts`
Policy narrative: [FEATURE_SLICE.md](./FEATURE_SLICE.md).

---

## 7. Enforcement status (honest inventory)

### Current enforcement matrix

| Area | Status | Notes |
| ---- | ------ | ----- |
| AI SDK isolation (direct provider imports) | **Enforced** | `platform-boundary.invariant`; SDKs only under `src/platform/*` / packages |
| Packages ↛ application `src` | **Enforced** | `package-dependency.invariant` |
| Server-only / secret env boundaries | **Enforced** | `server-only-boundary`, `auth-env` |
| Feature-slice layering / public API | **Enforced** (partial) | `feature-slice`, `public-api-boundary` |
| Legacy layer freeze (`src/lib`, `hooks`, `services`) | **Enforced** | Exact path allowlists; freezes current paths, not final design |
| New legacy imports from routes/hooks/components | **Enforced + baselined** | `no-legacy-imports` (existing edges allowlisted) |
| Financial pricing / ROI authority | **Enforced** | pricing / scoring invariants |
| Product isolation (Genius ↔ IQ) | **Documented** | Vacuous today (IQ reserved); no dedicated product-isolation invariant |
| Deal Copilot isolation from persistence | **Transitional / debt** | Direct Supabase still present; not CI-blocked |
| Presentation ↛ direct Supabase | **Partial / debt** | Preferred pattern exists; many call sites remain |
| Data ownership matrix | **Planned** (Phase 4) | Incomplete |
| Architecture registry (`tests/invariants/config`) | **Documented** (Phase 2 registered) | Metadata only; freezes/allowlists remain in invariant tests until later wiring |
| Structured exceptions (owner / expiry) | **Planned** (Phase 2) | Interim: string baselines in tests |
| PR architecture impact template | **Planned** (Phase 3) | No PR template today |

### Already enforced in CI (`pnpm test:invariants`)

Examples: package↛app, platform vendor placement, server-only boundaries, auth env hygiene, feature-slice layering, public API boundary, legacy layer freezes, no-new-legacy-imports beyond baseline, pricing/ROI authority, shim cleanup.

### Documented but unenforced (or only partially)

- Multi-product isolation (Genius / IQ / assistant as products).
- Deal Copilot multi-root isolation from direct Supabase and product internals.
- Presentation ban on all direct Supabase (many call sites remain).
- Structured baselines with owner / issue / reviewBy / expiry.
- Architecture impact section on pull requests (no PR template today).

### Known debt (selected; see Phase 0 for full table)

- Deal Copilot direct Supabase: `opportunityStore`, `DealChat`, `serverFns/dealChat|dealAnalysis|dealCopilot`.
- Widespread `src/lib` stores/queries used from UI.
- Large `BASELINE_ALLOWLIST` in `no-legacy-imports.invariant.test.ts`.
- Supabase access still fragmented across lib, services, components, routes, features.

---

## 8. Exception policy

Temporary architecture exceptions **require** (when formalised in Phase 2+):

| Field | Purpose |
| ----- | ------- |
| Owner | Accountable person/team |
| Reason | Why exception is needed |
| Scope | Exact files / imports / boundaries |
| Affected dependency or boundary | Which rule |
| Risk | User/security/maintainability impact |
| Tracking issue | Durable tracker ID if available |
| Removal condition | What closes the exception |
| Review or expiry date | When it must be re-reviewed |

**This phase does not create an exception registry.**
Existing baselines (string allowlists inside tests) are the interim mechanism. Wildcard directory exceptions are prohibited when registries are introduced.

---

## 9. Financial authority (critical invariant)

Deterministic engines in `@repo/services` are the **only** source of financial truth.
AI is advisory — it suggests work and quantities; pricing/ROI/score never trust raw AI unit costs.

```text
User inputs → scoreDealOpportunity() → runPricingEngine()
  → pricing.mid_total (authoritative refurb budget)
  → runRoiEngine(refurb_budget: pricing.mid_total)
```

Rules:

1. ROI runs only after pricing succeeds (`pricing.mid_total` must be non-null).
2. User-entered refurb budget is **never** passed directly to the ROI engine.
3. No fallback operators on `refurb_budget` selection for authority.
4. Enforced by invariant tests — [Invariant Protection Report](../invariant-protection-report.md).

Implementation today: `src/lib/deal-copilot/dealAnalysis.ts` (client orchestration);
`@repo/services` engines for pricing/ROI/deal scoring.

---

## 10. Package hierarchy

**Allowed package direction: downward only** — [dependency-rules.md](./dependency-rules.md).

| Package | Role |
| ------- | ---- |
| `@repo/types` | Domain types, DTOs — zero runtime deps |
| `@repo/core` | Shared primitives / constants |
| `@repo/services` | Deterministic pricing, ROI, deal scoring, estimators |
| `@repo/supabase` | Browser/server client factories + generated types |
| `@repo/ui` | Shared UI components (migration in progress) |
| `src/platform/` | App-side vendor seams (OpenAI, HF, Supabase wiring, PostHog, Sentry, …) |

---

## 11. Runtime shell (immovable)

Root `src/` is the production bootstrap — **do not relocate**. TanStack Start resolves routes from `src/routes/` at repo root. Details: [runtime-boundaries.md](./runtime-boundaries.md).

---

## 12. Build and validation

```bash
pnpm typecheck && pnpm lint && pnpm test:invariants && pnpm build:vercel
```

| Check | Command | Notes |
| ----- | ------- | ----- |
| Type safety | `pnpm typecheck` | CI |
| Lint | `pnpm lint` | CI |
| Architecture / financial invariants | `pnpm test:invariants` | CI separate job |
| UI unit tests | `pnpm test:ui` | **Not currently in CI** |
| Production build | `pnpm build:vercel` | CI |
| `pnpm test` | — | **Script does not exist** |

CI: `.github/workflows/ci.yml`.

---

## 13. Product surfaces (live routes)

| Surface | Routes | Notes |
| ------- | ------ | ----- |
| Refurb Genius | `/projects/*`, studies, analyze, … | Estimates, photos, scope, reports |
| Deal Copilot | `/deal-copilot/*` | Do not rename to `/deals` without product decision |
| Trades Marketplace | `/trades`, `/trades/*` | Public browse; post/edit auth-gated |
| Gallery | `/gallery` | Public |
| Admin | `/admin` | Admin / diagnostics |

Product IDs (conceptual): `refurb-genius`, `deal-copilot`, `refurb-iq`, `trades-marketplace`.

Multi-product narrative: [Repo Convergence Plan](../repo-convergence-plan.md).
Longer platform sketch: [Platform Architecture Plan](./platform-architecture-plan.md) — treat aspirational `apps/*` diagrams as **target/future**, not current.

---

## 14. Related documents

| Document | Relationship to this overview |
| -------- | ----------------------------- |
| [Phase 0 inventory](./phase-0-inventory-report.md) | Evidence for current state |
| [ADR index](./adr/README.md) | ADR process (immutable, append-only) |
| [ADR 0001](./adr/0001-adopt-rules-first-incremental-architecture-governance.md) | Governance decision |
| [docs/README.md](../README.md) | Documentation index |
| [FEATURE_SLICE.md](./FEATURE_SLICE.md) | Slice layering and freeze narrative |
| [platform-boundary.md](./platform-boundary.md) | Vendor SDK seams |
| [dependency-rules.md](./dependency-rules.md) | Package hierarchy detail |
| [package-registry.md](./package-registry.md) | Package ownership registry |
| [domain-ownership-audit.md](./domain-ownership-audit.md) | Domain engine ownership |
| [routes.md](./routes.md) | Route map |
| [ai-platform.md](./ai-platform.md) | AI pipeline detail |
| [platform-debt.md](./platform-debt.md) | Known trade-offs |

---

## 15. New-code placement guide

| Kind of change | Place it… |
| -------------- | --------- |
| New product capability | `src/features/<slice>/` with public API |
| Pure financial / scoring engine | `@repo/services` (if framework-independent) |
| Shared types | `@repo/types` |
| Vendor SDK usage | `src/platform/<vendor>/` then feature adapter |
| Persistence | Feature `infrastructure/repositories` (+ platform client factories) |
| Server HTTP/RPC surface | `createServerFn` in feature presentation or `serverFns` as thin transport |
| Pure cross-cutting utility | Prefer package or existing allowlisted util; **do not** add files under `src/lib` without freeze review |
| Product-specific UI composition | Routes + feature presentation; avoid growing `src/core/refurbGenius` as a dumping ground |
| Refurb IQ work | Only under `src/core/refurbIq` / future IQ features **when** product work starts — do not fake progress with empty layers |
| Deal Copilot | Extend existing multi-root carefully; do not add unreviewed Supabase from presentation |

---

## 16. Enforcement roadmap (documentation only until later phases)

| Phase | Intent |
| ----- | ------ |
| **0** | Inventory (done) |
| **1** | This policy + ADR (done) |
| **2** | Machine-readable registry at `tests/invariants/config/` (done — registration only) |
| **3** | Structured baselines + freeze/import ratchets wired to registry (done — no debt migration) |
| **3b** | PR architecture impact template (deferred) |
| **4** | Data ownership + tenant isolation registry (done — registration only) |
| **5** | Data registry integrity + narrow drift ratchets (done — no schema/RLS changes) |
| **6** | One evidence-backed migration candidate (when authorised) |

Do not start Phase 3+ without explicit authorisation. Phase 2 does **not** wire the registry into freezes or new failing rules.

### Architecture registry (Phase 2–3)

Machine-readable ownership, dependency, freeze metadata, AI boundaries, **structured exceptions**, and enforcement inventory live under:

```text
tests/invariants/config/
```

Integrity checks: `tests/invariants/architecture-registry.invariant.test.ts`.

**Phase 3 wiring (narrow):**

| Concern | Config source | Consumer invariant |
| ------- | ------------- | ------------------ |
| `src/lib` / `hooks` / `services` freezes | `config/frozen-path-allowlists.ts` | `legacy-layer-freeze.invariant.test.ts` |
| Legacy import ratchet | `config/legacy-import-baseline.ts` | `no-legacy-imports.invariant.test.ts` (new edges + **stale edges** fail) |
| UI migration boundary exception | `config/exceptions.ts` (`UI_MIGRATION_BOUNDARY_EXCEPTIONS`) | `ui-migration.invariant.test.ts` |
| Structured exception records | `config/exceptions.ts` | registry integrity tests |

**Still not enforced as new product rules:** Deal Copilot direct Supabase, presentation-wide persistence ban, Genius↔IQ isolation (documented/planned only).

**Source of truth split:**

| Concern | Authoritative location |
| ------- | ---------------------- |
| Policy prose | this overview |
| Evidence inventory | [phase-0-inventory-report.md](./phase-0-inventory-report.md) |
| Freeze path sets | `tests/invariants/config/frozen-path-allowlists.ts` |
| Legacy import edges | `tests/invariants/config/legacy-import-baseline.ts` |
| Structured exceptions | `tests/invariants/config/exceptions.ts` |
| Registry metadata | `tests/invariants/config/` |

---

## 17. Document review triggers

This document **must** be reviewed (and `Last reviewed` updated) whenever any of the following occur:

* ownership boundaries change;
* dependency rules change;
* a new architectural ADR is accepted;
* a new product boundary is introduced (or Refurb IQ leaves reserved status);
* CI architecture enforcement changes (new or removed invariants, freezes, baselines);
* Deal Copilot roots or persistence access model changes materially;
* package boundaries for `@repo/*` change in a way that affects the platform model.

Minor typo or link fixes do not require a full review cycle, but should not alter policy meaning without an ADR when the change is material.
