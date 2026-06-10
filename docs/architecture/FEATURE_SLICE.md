# Feature Slice Architecture

## Migration Status (June 10, 2026)

| Slice         | Status       | Key commits                                 | Notes / Blockers                                              |
| ------------- | ------------ | ------------------------------------------- | ------------------------------------------------------------- |
| `estimate`    | Standardized | `354e556`, `3acf34e3`, `735787c`            | All layers in place; public API enforced                      |
| `ai-upload`   | Standardized | `354e556`, `3acf34e3`, `b2c5827`, `735787c` | Photo pipeline wired; domain enums pending `@repo/types` move |
| `ai-design`   | Standardized | `354e556`, `3acf34e3`, `735787c`            | Redesign catalog + orchestrator still in legacy `lib`/`core`  |
| `export`      | Scaffolded   | —                                           | Slice scaffolded; initial PDF export pipeline added           |
| `roi`         | Standardized | —                                           | Deterministic ROI service + sensitivity analysis in slice     |
| `feasibility` | Standardized | —                                           | End-to-end orchestrator + immutable Supabase snapshot repo    |
| `sharing`   | Standardized | —                                           | Share links with role/expiry controls and RLS-backed ownership |
| `payment`   | Scaffolded   | —                                           | Slice scaffolded; checkout + webhook application stubs added  |
| `gallery`     | Scaffolded   | —                                           | Slice scaffolded; owner/publishing application stubs added    |

Remaining work: full UI route wiring for `feasibility` + payment-gated premium exports,
plus cleanup of legacy `core/` and `lib/` call paths that now have slice equivalents.

**Key rules** (details below):

- Public API via `features/<slice>/index.ts` only (plus the slice's
  `infrastructure` barrel for wiring code — a deliberate deviation).
- Vendor SDKs only via `src/platform/`.
- Invariant tests enforce both boundaries.

### Known deep-import debt (June 10, 2026)

Grep-confirmed violations identified during the June 10 audit and remediated in
this pass:

- `src/routes/_authed/projects.$id.report.tsx` imports
  `@/features/ai-upload/presentation/hooks/usePhotos` (should come from the
  slice public API).
- `src/lib/pitchDeck.ts` imports a deep repository path
  (`@/features/estimate/infrastructure/repositories/estimate.repository`)
  instead of the infrastructure barrel.
- `src/features/ai-design/presentation/serverFns.ts` imports
  `roomAnalysisOutputSchema` from `@/features/ai-upload/presentation/serverFns`
  (cross-slice presentation deep import).
- Widespread `@/features/ai-upload/domain` type imports from `lib/`,
  `components/`, and `core/` (`ConditionLevel`, `RoomAnalysis`, …) — resolved
  by the planned `@repo/types` canonical-union cleanup.

---

## Legacy Boundary Audit (2026-06-10)

Feature-Slice Architecture violations were identified via grep-based audit
across application entry surfaces.

### High Priority

- `src/routes/**`
- `src/hooks/**`
- `src/serverFns/**`

### Medium Priority

- `src/components/**`
- `src/services/**`

### Transitional Exceptions

- `src/features/**`
- `src/platform/**`
- `src/core/**` (legacy internals only)

## Public API Verification Audit (2026-06-10)

Verified entry points:

1. `src/core/ai/index.ts`
2. `src/lib/estimate.ts`
3. `src/integrations/supabase/client.ts`

Findings:

- `src/core/ai/index.ts` importers are components (`src/components/**`) and
  consume the public barrel (`@/core/ai`) — approved boundary usage.
- `src/lib/estimate.ts` is consumed only by `src/core/pricing/index.ts`
  (legacy compatibility re-export) — transitional boundary usage.
- `src/integrations/supabase/client.ts` has no importers — no active boundary
  usage.

Remediation checklist:

- [ ] Migrate `src/core/pricing/index.ts` compatibility re-exports off
      `@/lib/estimate`.
- [ ] Remove `src/integrations/supabase/client.ts` after legacy import risk is
      eliminated.

Feature-Slice Architecture organises code by **business capability** (vertical
slice), with **Clean Architecture** layering _inside_ each slice and a
**platform boundary** that isolates vendor SDKs.

## Structure

```
src/
├── features/                  # Vertical slices — one per business capability
│   ├── estimate/              # ★ Reference slice (refurb + new-build estimates)
│   │   ├── domain/            # Pure business logic. No IO, no frameworks.
│   │   ├── application/       # Use cases (commands/queries), ports (interfaces)
│   │   ├── infrastructure/    # Port implementations: DB repos, AI adapters
│   │   ├── presentation/      # Components, hooks, serverFns, route wiring
│   │   └── index.ts           # Slice public API (domain + application + presentation)
│   ├── ai-upload/             # Photo upload + vision analysis      (★ migrated)
│   ├── ai-design/             # Redesign concepts + scope analysis  (★ migrated)
│   ├── export/                # PDF / CSV export                    (scaffolded)
│   ├── roi/                   # Deterministic ROI + sensitivity      (★ migrated)
│   ├── feasibility/           # End-to-end study orchestration       (★ migrated)
│   ├── sharing/               # Share links + access controls        (★ migrated)
│   ├── payment/               # Checkout + webhook flows            (scaffolded)
│   ├── gallery/               # Public project gallery              (scaffolded)
│   └── ...
├── platform/                  # Vendor abstractions (Supabase, OpenAI, PostHog, …)
│   ├── browser.ts / server.ts # separate aggregates — never a mixed index barrel
│   ├── payments/              # payment provider seam (factory)
│   ├── storage/               # storage abstraction seam (factory)
│   ├── logger/                # logger seam (factory)
│   ├── auth/                  # auth seam (factory)
│   ├── analytics/             # analytics seam (factory)
│   ├── sentry/                # sentry seam (factory)
│   ├── supabase/              # browser.ts / server.ts
│   ├── openai/                # server.ts only (server-only SDK)
│   └── posthog/               # browser.ts / server.ts / otel.server.ts
├── routes/                    # TanStack Start file routes (thin: delegate to slices)
├── components/                # Cross-cutting app shell + legacy (shrinks over time)
├── lib/                       # Legacy shared utilities (shrinks over time)
└── core/                      # Legacy domain dirs (migrate into slices over time)
```

The existing `@repo/*` workspace packages are unchanged and sit _below_ the
slices as a **shared kernel**:

```
src/features/* (slices)        src/routes (presentation shell)
        ▲                              ▲
        │                              │
   src/platform  ──────────────────────
        ▲
        │
  @repo/services   (deterministic pricing / ROI / deal engines — stays here)
        ▲
  @repo/core
        ▲
  @repo/types
```

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
