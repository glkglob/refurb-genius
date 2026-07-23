# Feature Slice Architecture

## Platform context (Priority 1.9)

**Priority 1.9 defines application feature ownership, not platform ownership.**

- **Feature slices** own application behaviour (workflows, UX, orchestration).  
- **Shared packages** own reusable capabilities (engines, auth, UI primitives).  
- Applications **compose** packages; they never expose internal feature
  implementations to other apps.

Refurb Genius features live under **this application**. In the multi-app
target (`apps/refurb-genius/...`), the same rule holds. Shared reusable
capabilities go in `packages/*`. Applications never share feature folders.

See [platform-architecture-plan.md](./platform-architecture-plan.md).

## Canonical request flow (required)

All **new** business functionality must follow this path. Do not invent parallel
implementations in `src/lib/`, `src/hooks/`, or `src/services/`.

```
Route (src/routes/*)
  → feature presentation   # UI, hooks, createServerFn RPC surface
  → feature application    # use cases / commands / ports
  → domain logic           # pure rules in slice domain/ and/or @repo/services
  → infrastructure adapter # repos, AI adapters, storage
  → platform / @repo/*     # vendor seams + shared kernel engines
```

| Step | Location | Responsibility |
|------|----------|----------------|
| Route | `src/routes/` | Thin: params/search, auth gate, render presentation |
| Presentation | `src/features/<slice>/presentation/` | Components, hooks, serverFns |
| Application | `src/features/<slice>/application/` | Use cases; define ports (interfaces) |
| Domain | `src/features/<slice>/domain/` + `@repo/services` | Pure rules; financial engines stay in `@repo/services` |
| Infrastructure | `src/features/<slice>/infrastructure/` | Implement ports (DB, AI, external APIs) |
| Platform / packages | `src/platform/`, `@repo/*` | Vendor SDKs, shared types, deterministic engines |

**Anti-patterns (do not do):**

- Domain rules or new product use cases in `src/lib/*` or `src/hooks/*`
- Calling OpenAI/Supabase SDKs from routes or components (use platform + infra)
- Deep imports into another slice’s `domain/`, `application/`, or adapters
- Competing copies of the same capability in both a slice and `src/core/` / `src/lib/`

See also: [`src/features/README.md`](../../src/features/README.md).

## Migration Status (2026-07-23)

| Slice         | Status       | Notes |
| ------------- | ------------ | ----- |
| `estimate`    | Standardized | Layers + public API; AI estimate adapter server-only |
| `ai-upload`   | Standardized | Photo + vision pipeline |
| `ai-design`   | Standardized | Redesign + scope adapters |
| `export`      | Scaffolded   | PDF/export pipeline growing into slice |
| `roi`         | Standardized | Deterministic ROI + sensitivity |
| `feasibility` | Standardized | Study orchestrator + snapshots |
| `sharing`     | Standardized | Share links + RLS |
| `payment`     | Scaffolded   | Checkout/webhook application stubs |
| `gallery`     | Scaffolded   | Owner/publishing stubs; some UI still uses `lib/queries` |
| `auth`        | Presentation shell | Public API only; no full domain stack yet |

**Enforcement:**

- Public API via `features/<slice>/index.ts` (plus `infrastructure` barrel for wiring).
- Vendor SDKs only via `src/platform/`.
- Cross-slice deep imports forbidden (`public-api-boundary` invariants).
- **Legacy freeze:** no *new* files under `src/lib/`, `src/hooks/`, or `src/services/`
  without updating the allowlist (`legacy-layer-freeze` invariant).
- Slice layer rules: `feature-slice.invariant.test.ts` (includes payment + gallery).

### Deep-import debt (cleared)

June 2026 deep-import violations into slice internals were remediated. Current
invariant suite must stay green; do not reintroduce deep paths.

## Folder ownership matrix

| Path | Role | New business logic? |
|------|------|---------------------|
| `src/features/*` | Vertical slices (preferred) | **Yes — default home** |
| `src/platform/*` | Vendor SDK seams | Factories only, no product rules |
| `src/routes/*` | TanStack file routes | Thin only |
| `packages/services` (`@repo/services`) | Pure pricing/ROI/deal engines | **Yes — financial authority** |
| `src/lib/*` | Transitional utilities / legacy helpers | **No** (freeze; shrink) |
| `src/hooks/*` | App-shell hooks (auth, theme) | **No** (feature hooks → presentation) |
| `src/services/*` | Legacy integration seams | **No** (prefer slice infra + platform) |
| `src/serverFns/*` | Legacy/thin RPC modules | Prefer slice `presentation/serverFns` |
| `src/core/*` | Legacy domain directories | **No** — migrate into slices / `@repo/*` |
| `src/integrations/*` | Generated Supabase types | Do not hand-edit |
| `src/components/*` | App shell + shared UI composition | No domain rules |

---

## Legacy layers (transitional)

Entry surfaces may still **consume** modules under `src/lib/`, `src/hooks/`,
`src/services/`, `src/serverFns/`, and `src/core/`. That is expected during
migration. **New** capabilities must not expand those layers — use a feature
slice instead. File allowlists are frozen by
`tests/invariants/legacy-layer-freeze.invariant.test.ts`.

### Remaining cleanup (incremental)

- [ ] Migrate remaining `src/core/*` call sites into slices or `@repo/*`
- [ ] Move gallery/query consumers from `src/lib/queries/*` into `features/gallery`
- [ ] Prefer `features/*/presentation/serverFns` over growing `src/serverFns`
- [ ] Keep routes thin: no new business rules in route modules

**Overlapping modules (estimate/ROI/projects/photos/gallery/redesign):**  
classified in [domain-ownership-audit.md](./domain-ownership-audit.md) — do not delete
facades until tests prove the canonical path covers behaviour.

---

Feature-Slice Architecture organises code by **business capability** (vertical
slice), with **Clean Architecture** layering _inside_ each slice and a
**platform boundary** that isolates vendor SDKs.

Contributor-facing ownership guide: [`src/features/README.md`](../../src/features/README.md).

## Structure

### App shell vs features

```
src/
├── features/                  # Vertical slices — one per business capability
├── platform/                  # Vendor abstractions (Supabase, OpenAI, PostHog, …)
├── routes/                    # Thin TanStack file routes → slice presentation
├── components/                # App shell + shared composition (no domain growth)
├── lib/ · hooks/ · services/ · core/ · serverFns/   # Transitional (frozen)
└── server.ts
```

### Recommended layout inside `src/features/<feature>/`

Each feature owns a **coherent vertical slice**. Use the full tree only when the
code exists — **avoid empty ceremonial layers**.

```
src/features/<feature>/
├── domain/
│   ├── entities.ts          # or types.ts — aggregate roots / entities
│   ├── value-objects.ts     # optional
│   ├── errors.ts            # optional domain errors
│   ├── services.ts          # optional pure domain services
│   ├── rules.ts             # pure functions (common in this repo)
│   └── index.ts
├── application/
│   ├── use-cases/           # or flat createX.ts / generateY.ts modules
│   ├── ports/               # or single ports.ts (repository/AI interfaces)
│   ├── dto/                 # optional command/query shapes
│   └── index.ts
├── infrastructure/
│   ├── repositories/        # persistence
│   ├── adapters/            # AI, engines, external systems (*.server.ts if needed)
│   ├── mappers/             # optional DB row ↔ domain
│   └── index.ts             # wiring barrel (allowed import for composition)
├── presentation/
│   ├── components/
│   ├── hooks/
│   ├── schemas/             # optional zod; may live next to serverFns
│   ├── serverFns.ts         # createServerFn RPC surface
│   └── index.ts
└── index.ts                 # Public API — only entry for routes / other slices
```

| Layer | Responsibility | Create when… |
|-------|----------------|--------------|
| `domain/` | Pure types + rules | You have non-trivial pure logic or types |
| `application/` | Use cases + ports | You have a use case or need to invert IO |
| `infrastructure/` | Port implementations | You touch DB, AI, storage, or engines |
| `presentation/` | UI, hooks, serverFns | Users or routes need a surface |
| `index.ts` | Public exports | **Always** (required for every slice) |

**Minimum viable:** `index.ts` + the one layer that has real code (e.g. `auth` is
presentation-only today). Scaffolded slices may keep thin application stubs
without inventing empty `value-objects/` trees.

**Shared kernel (not inside features):**

```
src/features/*  ──▶  src/platform  ──▶  @repo/services (pricing/ROI/deals)
                         │                    ▲
                         └──────────▶  @repo/core / @repo/types / @repo/supabase
```

Deterministic **pricing / ROI / deal score** engines live in `@repo/services`.
Features **own orchestration and product rules**, not a second financial engine.

### Feature ownership map

| Feature | Owns | Does not own |
|---------|------|----------------|
| `estimate` | Estimate use cases, persistence, AI estimate adapter | Category pricing math (`@repo/services`) |
| `ai-upload` | Photo analysis domain/app, upload presentation | Raw storage implementation still `lib/photos` (debt) |
| `ai-design` | Redesign + scope flows | Static catalog still partly `lib/redesign` |
| `roi` | ROI application + sensitivity | `runRoiEngine` body (`@repo/services`) |
| `feasibility` | Cross-capability study orchestration | Deep internals of other slices |
| `sharing` | Share-link product rules + IO | — |
| `export` | Export pipeline | — |
| `payment` | Checkout/webhook product surface | Payment provider SDK (→ platform) |
| `gallery` | Gallery product (target) | Live path still lib/hooks until wired |
| `auth` | Auth presentation surface | Full domain/infra (optional until needed) |

Missing slices (projects, trades) remain transitional under lib/core/serverFns —
see [domain-ownership-audit.md](./domain-ownership-audit.md).

---

## Layer rules (inside a slice)

| Layer             | May import                                                                        | Must NOT import                                            |
| ----------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `domain/`         | `@repo/types`, `@repo/core`, `@repo/services` (shared kernel)                     | Anything with IO: platform, infra, React, Supabase, OpenAI |
| `application/`    | own `domain/`, shared kernel                                                      | `infrastructure/`, `presentation/`, vendor SDKs, React     |
| `infrastructure/` | own `application/` ports + `domain/`, `src/platform/*`, shared kernel             | `presentation/`, other slices' internals                   |
| `presentation/`   | own `application/` + `domain/` + `infrastructure/` (wiring only), React, TanStack | other slices' `infrastructure/`                            |

### Cross-Slice Import Rules

Allowed:

- `features/<slice>/index.ts`
- `features/<slice>/infrastructure/index.ts` (wiring and composition only)

Forbidden:

- `features/<slice>/domain/*`
- `features/<slice>/application/*`
- `features/<slice>/presentation/*`
- `features/<slice>/infrastructure/repositories/*`
- `features/<slice>/infrastructure/adapters/*`

No deep imports across slices.

Examples:

```ts
// ✅ allowed
import { usePhotos } from "@/features/ai-upload";
import { getLatestProjectEstimate } from "@/features/estimate/infrastructure";

// ❌ forbidden
import { usePhotos } from "@/features/ai-upload/presentation/hooks/usePhotos";
import { PersistedRoomEstimate } from "@/features/estimate/infrastructure/repositories/estimate.repository";
```

Additional architecture rules:

1. **Vendor SDKs are only touched in `src/platform/` and slice
   `infrastructure/`** — `import OpenAI from "openai"` or
   `createClient` from `@supabase/supabase-js` anywhere else is a violation.
2. **Deterministic engines stay in `@repo/services`.** Slices treat
   `runPricingEngine`, `analyzeDeal`, ROI math, etc. as shared-kernel domain
   services. The existing pricing/ROI invariant tests continue to pin them.
3. **Server-only code keeps the existing conventions**: `*.server.ts` naming
   and/or dynamic `import()` inside `createServerFn` handlers. A slice's
   `presentation/` may export serverFns (they are the RPC surface).
4. **Routes stay in `src/routes/`** (TanStack Start requires it). Route files
   should be thin: parse params/search, render the slice's presentation
   component. URLs never change (see `routes.md`).

### Dependency direction (within a slice)

```
presentation ──▶ application ──▶ domain
      │                ▲
      └──▶ infrastructure ──┘   (infrastructure implements application ports)
```

`application/` defines **ports** (TypeScript interfaces) for everything that
does IO. `infrastructure/` implements them. `presentation/` (or a serverFn)
performs the wiring — i.e. plain constructor injection, no DI framework.

## Feasibility orchestrator rules (new)

The `feasibility` slice is the supervisor capability for the Property
Feasibility Study flow:

1. Property + photos intake
2. Photo analysis (`ai-upload`)
3. Scope analysis (`ai-design`)
4. Deterministic estimate + ROI (`estimate`, `roi`)
5. Snapshot persistence + share/export references

Boundary constraints for orchestrators:

- Orchestrators may import other slices only through `@/features/<slice>` or
  `@/features/<slice>/infrastructure` barrels.
- No cross-slice deep imports from `domain/`, `application/`, `presentation/`,
  or `infrastructure/adapters|repositories`.
- Feasibility persistence is immutable-by-default: state changes append snapshots
  instead of mutating prior study records.

---

## Platform boundary (`src/platform/`)

Each vendor gets a directory with **separate browser/server entry files** so
client bundles can never accidentally pull server-only SDKs:

```
src/platform/
├── browser.ts       # typed `platform` aggregate — browser-safe vendors only
├── server.ts        # typed `platform` aggregate — server-only (adds OpenAI + PostHog)
├── supabase/
│   ├── browser.ts   # re-exports createBrowserSupabase (+ env helpers)
│   └── server.ts    # re-exports createServerSupabase / createTokenSupabase
├── openai/
│   └── server.ts    # getOpenAIClient + Sentry instrumentation (server-only)
└── posthog/
    ├── browser.ts   # posthog-js + PostHogProvider
    ├── server.ts    # getPostHogServerClient
    └── otel.server.ts
```

Full usage patterns, approved layers, and vendor migration status:
[platform-boundary.md](./platform-boundary.md).

The aggregates expose **factories, not instances** (nothing is constructed at
module scope, so SSR/build never eagerly instantiates a client):

```ts
// Server-side wiring inside a createServerFn handler:
const { platform } = await import("@/platform/server");
const supabase = platform.supabase.createServerClient(getCookies());
const openai = platform.ai.getOpenAIClient(apiKey);
```

Rules:

- **No `index.ts` barrel that mixes browser and server exports.**
- Slices' `infrastructure/` imports from `src/platform/<vendor>/<context>`,
  never directly from `openai`, `@supabase/supabase-js`, etc.
- Adding a vendor (Stripe, Qdrant, …) means adding a directory here first.
- `@repo/supabase` remains the actual factory implementation; `src/platform/`
  is the app-side seam that lets a slice swap vendors in one place.
- Enforced by `tests/invariants/platform-boundary.invariant.test.ts` (no direct
  `openai`, `posthog-*`, or `@supabase/*` imports outside `src/platform/`).

### Platform vendor migration (2026-06)

| Vendor           | Platform entry                   | Migrated     | Legacy shim                           |
| ---------------- | -------------------------------- | ------------ | ------------------------------------- |
| OpenAI           | `@/platform/openai/server`       | ✅           | `src/core/ai/server/openai-client.ts` |
| Supabase browser | `@/platform/supabase/browser`    | ✅ slices    | `src/services/supabase`               |
| Supabase server  | `@/platform/supabase/server`     | ✅ serverFns | —                                     |
| PostHog browser  | `@/platform/posthog/browser`     | ✅           | —                                     |
| PostHog server   | `@/platform/posthog/server`      | ✅           | `src/lib/posthog-server.ts`           |
| PostHog OTEL     | `@/platform/posthog/otel.server` | ✅           | `src/lib/posthog-otel.ts`             |

---

## Layer templates

Patterns to copy when building a new slice. These mirror the `estimate`
reference implementation.

### 1. Domain — entities, value types, rules (pure)

```ts
// features/<slice>/domain/types.ts
import type { ConditionLevel, UKRegion } from "@repo/types"; // canonical unions — never re-declare
import type { PricingEngineResult, PricingLineItem } from "@repo/services";

export type Property = {
  id: string;
  address?: string;
  postcode?: string;
  type: string;
  sizeSqm?: number;
  bedrooms: number;
  condition: ConditionLevel;
  region: UKRegion;
};

export type RefurbEstimate = {
  id: string;
  projectId: string;
  pricing: PricingEngineResult; // engine result verbatim — never recomputed
  createdAt: Date;
};

// features/<slice>/domain/rules.ts — pure functions over domain types
export function isActionableEstimate(estimate: RefurbEstimate): boolean {
  return estimate.pricing.lineItems.length > 0 && estimate.pricing.mid_total > 0;
}
```

### 2. Application — commands, service interface, ports

```ts
// features/<slice>/application/createEstimate.ts
export type CreateEstimateCommand = { projectId: string; inputs: PricingEngineInputs };

// features/<slice>/application/ports.ts — IO as interfaces
export interface EstimateRepository {
  saveProjectEstimate(projectId: string, result: PricingEngineResult): Promise<SavedEstimateRef>;
}

// features/<slice>/application/estimateService.ts — use cases behind one interface
export interface EstimateService {
  createEstimate(command: CreateEstimateCommand): Promise<CreateEstimateResult>;
}
export function makeEstimateService(deps: { estimates: EstimateRepository }): EstimateService {
  /* … */
}
```

### 3. Infrastructure — port implementations

```ts
// features/<slice>/infrastructure/supabaseEstimateRepository.ts
export class SupabaseEstimateRepository implements EstimateRepository {
  async saveProjectEstimate(projectId: string, result: PricingEngineResult) {
    // DB mapping only; client comes from @/platform/supabase, never
    // directly from @supabase/supabase-js
  }
}
```

### 4. Presentation — hooks, serverFns, components

```ts
// features/<slice>/presentation/serverFns.ts — Zod-validated RPC surface
export const createEstimateServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireServerAuth();
    const service = makeEstimateService({ estimates: supabaseEstimateRepository });
    return service.createEstimate(data);
  });
```

### Template deviations (deliberate)

These differ from generic Clean Architecture templates because of hard
project constraints:

- **No `calculateROI` (or any cost/ROI math) in slice domains.** Deterministic
  engines live in `@repo/services` and are pinned by invariant tests; slice
  `domain/rules.ts` holds only slice-specific judgements the kernel doesn't own.
- **No single `platform` object combining all vendors.** OpenAI is server-only;
  one shared aggregate would leak server SDKs into client bundles. There are
  two aggregates: `@/platform/browser` and `@/platform/server`.
- **No `any` anywhere** (e.g. `constructor(private openai: any)`) — strict
  mode; adapters take the concrete client type from the platform module.
- **No direct `@supabase/supabase-js` imports in slices** — always via
  `@/platform/supabase/*`.
- **Union types (`UKRegion`, `ConditionLevel`, …) come from `@repo/types`** —
  never re-declared as string literals in a slice.

### ai-upload deviations (deliberate)

These differ from the estimate slice because the photo pipeline spans browser
cache, Supabase `room_analyses`, and a client-side provider:

- **Room-analysis enums live in slice `domain/types.ts`** (`RoomType`,
  `ConditionLevel`, `RefurbLevel`, `AnalysisSource`) — not yet in `@repo/types`
  as canonical unions. `@repo/types/ai.ts` still re-exports via legacy shims
  until a types-package cleanup pass.
- **Mock vision data stays in `domain/mockData.ts`** — deterministic dev
  fallback when `OPENAI_API_KEY` is absent (not `@repo/services`; no pricing).
- **Client provider wiring lives in `presentation/photo-analysis.provider.ts`**
  (not infrastructure) because it must call `runPhotoAnalysisServerFn` without
  infrastructure → presentation import violations.
- **Photo upload hooks (`usePhotos`, `useUploadPhotos`, `useRemovePhoto`)**
  moved to slice presentation; `photoStore` upload IO remains in `src/lib/photos`
  until a later pass extracts a `PhotoStoragePort`.
- **`photo_analysis_results` queries** (`src/lib/queries/photo-analysis.ts`) stay
  in legacy `lib/queries` — they serve the newer bulk-upload viewer, separate
  from the `room_analyses` vision cache this slice owns.
- **Orchestrator** (`src/core/ai/platform/orchestrator.ts`) imports
  `runPhotoAnalysisServerFn` from the slice; scope/estimate steps stay legacy
  until `ai-design` / further slices migrate.

### ai-design deviations (deliberate)

These differ from estimate/ai-upload because redesign + scope share orchestration
with other slices but own distinct AI outputs:

- **Redesign static catalog** (`REDESIGN_CONCEPTS`, gradients) stays in
  `src/lib/redesign` — slice `domain/types.ts` re-exports `RedesignStyle` /
  `RedesignConcept` types only. Image-gen URLs are a future `ai-design` infra pass.
- **Scope mock data** lives in `domain/scopeMockData.ts` — deterministic dev
  fallback when `OPENAI_API_KEY` is absent (not `@repo/services`; base costs in
  scope items are AI suggestions, normalized via `src/core/ai/normalizers.ts`).
- **Cross-slice dependency on ai-upload** — redesign generation reads
  `analysisStore` (room vision cache) from `@/features/ai-upload/infrastructure`
  for prompt context. Slices may import each other's _public_ or _infrastructure_
  barrels, never internal folders.
- **Client redesign provider** in `presentation/redesign.provider.ts` (not
  infrastructure) — must call `generateRedesignConceptsServerFn` without layer
  violations.
- **Scope persistence** (`scope_analyses` + child tables) in
  `infrastructure/repositories/scope-analysis.repository.ts`; hooks in presentation.
- **Estimate validation schemas** (`aiEstimateResponseSchema`) remain in
  `src/core/ai/validation.ts` until estimate slice absorbs them.
- **Orchestrator** (`runVisionThenScope`, `runScopeThenEstimate`) stays in
  `src/core/ai/platform/orchestrator.ts` — imports slice serverFns; moves when a
  dedicated `ai-orchestration` pass is justified.

---

## Worked example: `CreateEstimate`

The `estimate` slice ships a complete worked example. Files:

- [`domain/index.ts`](../../src/features/estimate/domain/index.ts) — the
  slice's domain surface: estimate types + the deterministic pricing engine
  re-exported from the shared kernel.
- [`application/ports.ts`](../../src/features/estimate/application/ports.ts) —
  `EstimateRepository` port (persistence is an interface, not Supabase).
- [`application/createEstimate.ts`](../../src/features/estimate/application/createEstimate.ts)
  — the use case: deterministic pricing + persistence orchestration. Pure;
  testable with a fake repository.
- [`infrastructure/repositories/estimate.repository.ts`](../../src/features/estimate/infrastructure/repositories/estimate.repository.ts)
  — Supabase persistence + the `SupabaseEstimateRepository` port implementation
  (client via `@/platform/supabase/browser`).
- [`infrastructure/adapters/ai-estimate.adapter.server.ts`](../../src/features/estimate/infrastructure/adapters/ai-estimate.adapter.server.ts)
  — server-only OpenAI estimate generation (reached via dynamic `import()`).
- [`presentation/serverFns.ts`](../../src/features/estimate/presentation/serverFns.ts)
  - [`presentation/hooks/useEstimate.ts`](../../src/features/estimate/presentation/hooks/useEstimate.ts)
    — the slice's RPC surface and TanStack Query hooks.

Usage shape:

```ts
import { makeCreateEstimate } from "@/features/estimate";
import { supabaseEstimateRepository } from "@/features/estimate/infrastructure";

const createEstimate = makeCreateEstimate({ estimates: supabaseEstimateRepository });
const { pricing, saved } = await createEstimate({
  projectId,
  inputs: {
    region: "London",
    property_condition: "fair",
    finish_quality: "standard",
    selected_categories: ["kitchen", "bathroom"],
    property_size_sqm: 90,
  },
});
```

In a unit test, pass a fake `EstimateRepository` — no Supabase, no network.

---

## Worked example: `AnalyzePhotos` (ai-upload)

The `ai-upload` slice ships the second complete worked example. Files:

- [`domain/types.ts`](../../src/features/ai-upload/domain/types.ts) — room
  analysis entities + enum unions.
- [`domain/mockData.ts`](../../src/features/ai-upload/domain/mockData.ts) —
  deterministic mock analyses for dev / no-API-key fallback.
- [`domain/rules.ts`](../../src/features/ai-upload/domain/rules.ts) —
  slice-specific judgements (`isSuccessfulAnalysis`, `hasFallbackResults`, …).
- [`application/ports.ts`](../../src/features/ai-upload/application/ports.ts) —
  `RoomAnalysisRepository`, `AiVisionPort`, `PhotoCatalogPort`.
- [`application/analyzePhotos.ts`](../../src/features/ai-upload/application/analyzePhotos.ts)
  — the use case: resolve photos → vision → persist.
- [`infrastructure/adapters/ai-vision.adapter.server.ts`](../../src/features/ai-upload/infrastructure/adapters/ai-vision.adapter.server.ts)
  — server-only OpenAI Vision (via `@/platform/openai/server`).
- [`infrastructure/repositories/room-analysis.repository.ts`](../../src/features/ai-upload/infrastructure/repositories/room-analysis.repository.ts)
  — Supabase `room_analyses` + in-memory cache.
- [`presentation/serverFns.ts`](../../src/features/ai-upload/presentation/serverFns.ts)
  - [`presentation/photo-analysis.provider.ts`](../../src/features/ai-upload/presentation/photo-analysis.provider.ts)
    — RPC surface and client-side provider wiring.
- [`presentation/hooks/usePhotoAnalysis.ts`](../../src/features/ai-upload/presentation/hooks/usePhotoAnalysis.ts)
  - [`presentation/hooks/usePhotos.ts`](../../src/features/ai-upload/presentation/hooks/usePhotos.ts)
    — TanStack Query hooks.

Usage shape:

```ts
import { makeAnalyzePhotos } from "@/features/ai-upload";
import { supabaseRoomAnalysisRepository } from "@/features/ai-upload/infrastructure";

const analyzePhotos = makeAnalyzePhotos({
  vision: fakeVisionPort,
  analyses: supabaseRoomAnalysisRepository,
});
const results = await analyzePhotos({ projectId, photos });
```

Routes and components import from `@/features/ai-upload` (public API). Legacy
`src/core/ai/photoAnalysis.ts`, `src/lib/analysis.ts`, and
`src/core/ai/server/openAiVision.server.ts` remain as strangler shims.

---

## Worked example: `GenerateRedesign` + `RunScopeAnalysis` (ai-design)

The `ai-design` slice ships the third complete worked example. Files:

- [`domain/types.ts`](../../src/features/ai-design/domain/types.ts) — scope
  entities + redesign type re-exports.
- [`domain/scopeMockData.ts`](../../src/features/ai-design/domain/scopeMockData.ts)
  — deterministic mock scope for dev / no-API-key fallback.
- [`domain/validation.ts`](../../src/features/ai-design/domain/validation.ts) —
  Zod schemas for scope + redesign text outputs.
- [`application/ports.ts`](../../src/features/ai-design/application/ports.ts) —
  `AiRedesignPort`, `AiScopePort`, `ScopeAnalysisRepository`.
- [`infrastructure/adapters/ai-redesign.adapter.server.ts`](../../src/features/ai-design/infrastructure/adapters/ai-redesign.adapter.server.ts)
  - [`ai-scope.adapter.server.ts`](../../src/features/ai-design/infrastructure/adapters/ai-scope.adapter.server.ts)
    — server-only OpenAI adapters (via `@/platform/openai/server`).
- [`presentation/serverFns.ts`](../../src/features/ai-design/presentation/serverFns.ts)
  — `generateRedesignConceptsServerFn`, `runScopeAnalysisServerFn`.
- [`presentation/redesign.provider.ts`](../../src/features/ai-design/presentation/redesign.provider.ts)
  — client-side redesign wiring.

Usage shape:

```ts
import { makeRunScopeAnalysis } from "@/features/ai-design";
import { runScopeAnalysisServerFn } from "@/features/ai-design";

// Hook (presentation):
const scope = useScopeAnalysis();

// Direct RPC:
const result = await runScopeAnalysisServerFn({ data: scopeInput });
```

Legacy `src/core/ai/serverFns.ts` is now a thin re-export barrel for all three
AI slices. Scope/redesign server modules are strangler shims.

---

## Migration plan (incremental, slice by slice)

Order (highest value first): **estimate → ai-upload → ai-design → export → gallery**.

Per-slice recipe:

1. **Skeleton**: create `src/features/<slice>/{domain,application,infrastructure,presentation}` with the slice `index.ts`.
2. **Strangle, don't move**: new slice files initially _delegate_ to the legacy
   module (like `supabaseEstimateRepository` does), so behaviour and imports
   keep working. Mark legacy call sites with `// TODO(feature-slice):`.
3. **Move logic inward**: pull pure logic into `domain/`, orchestration into
   `application/`, IO into `infrastructure/`. Leave a re-export shim at the old
   path (same pattern as the UI `src/components/ui/` shims — replace contents,
   never delete the file mid-migration).
4. **Flip consumers**: update routes/hooks/components to import from the slice
   public API. Run `pnpm typecheck && pnpm lint && pnpm test:invariants && pnpm test:ui`.
5. **Delete the shim** only when `grep` shows zero remaining importers.

What does **not** move:

- `@repo/services` engines (pricing, ROI, deal analysis) — shared kernel, pinned by invariant tests.
- `src/routes/` file locations and URLs.
- `src/integrations/supabase/` (generated types) and `src/routeTree.gen.ts`.
- Supabase Edge Functions (`supabase/functions/`) — separate Deno runtime.

### Current migration state

| Slice       | Skeleton | Logic migrated | Consumers flipped | Legacy shims removed |
| ----------- | -------- | -------------- | ----------------- | -------------------- |
| `estimate`  | ✅       | ✅             | ✅                | ✅ (June 2026)       |
| `ai-upload` | ✅       | ✅             | ✅                | ✅ (June 2026)       |
| `ai-design` | ✅       | ✅             | ✅                | ✅ (June 2026)       |
| `export`    | ✅       | ◐              | —                 | —                    |
| `gallery`   | —        | —              | —                 | —                    |

See the **Migration Status** table at the top of this document for per-slice
notes, key commits, and known deep-import debt.

**Shim cleanup (June 2026):** All strangler shims for the three slices and platform
vendors were deleted after grep confirmed zero importers. Enforcement:
`tests/invariants/shim-cleanup.invariant.test.ts`.

Removed paths include `src/lib/analysis.ts`, `src/lib/estimates.ts`,
`src/lib/scopeAnalysis.ts`, `src/hooks/usePhotos.ts`, `src/hooks/useAIEstimate.ts`,
`src/hooks/useScopeAnalysis*.ts`, `src/core/ai/serverFns.ts`,
`src/core/ai/server/openAi*.server.ts`, `src/core/ai/{photoAnalysis,mockAnalysis,redesignConcepts}.ts`,
`src/services/supabase/`, `src/core/ai/server/openai-client.ts`,
`src/lib/posthog-{server,otel}.ts`.

`src/core/ai/index.ts` remains as an orchestration barrel (validation, normalizers,
orchestrator) — not a strangler shim.

---

## Conventions checklist (for new slice code)

- [ ] Domain files have zero IO imports (grep for `supabase`, `openai`, `fetch`, `import.meta`).
- [ ] Every external dependency in `application/` is a port interface in `ports.ts`.
- [ ] Infrastructure imports vendors only via `src/platform/`.
- [ ] serverFns validate input with Zod `.inputValidator()` and call `requireServerAuth()` first.
- [ ] Slice exposes one `index.ts`; no deep imports from other slices.
- [ ] `pnpm typecheck && pnpm lint && pnpm test:invariants` pass before commit.
