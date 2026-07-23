# Platform Architecture Plan (Revised)

**Status:** Target architecture (adopt incrementally)  
**Last updated:** 2026-07-23  
**Principle:** *Applications own product workflows. Shared packages own reusable capabilities.*

---

## Vision

Refurb Genius is **one application** within a larger **Intelligent Platform**.

The architecture must allow additional applications to be developed **without
duplicating** infrastructure, business logic, or user experience, while keeping
each application **independent**.

Applications **compose** reusable platform packages rather than sharing
**feature implementations** with each other.

```
┌─────────────────────────────────────────────────────────────┐
│  apps/refurb-genius   apps/future-app   apps/platform-admin │
│         │                    │                   │          │
│         └────────────────────┼───────────────────┘          │
│                              ▼                              │
│                    packages/* (platform)                    │
│         types · core · services · ui · auth · ai · …        │
└─────────────────────────────────────────────────────────────┘
```

**Hard rules:**

1. **Applications never import one another.**
2. **Everything reusable belongs in `packages/`.**
3. **Application features stay app-local** even if another product might need
   something “similar” later — extract to packages only when a second consumer
   exists and the capability is genuinely shared (not a copy of a workflow).

---

## Guiding principle

| Owns | Location | Examples |
|------|----------|----------|
| Product workflows, UX, orchestration | `apps/<app>/src/features/*` | Estimate wizard, feasibility study flow |
| Reusable capabilities | `packages/*` | Pricing engine, auth clients, UI primitives |
| App shell / routing | `apps/<app>/src/{routes,app,platform}` | TanStack routes, vendor seams for that app |

> **Do not promote an application feature to a shared package** solely because
> another app *might* need similar functionality. Promote when there is a real
> second consumer and a stable contract.

**Package promotion** process (full checklist): [package-promotion.md](./package-promotion.md).

## Platform principles (checklist)

1. Applications own workflows.  
2. Packages own reusable capabilities.  
3. Features never become shared automatically.  
4. Promote code only after reuse is proven.  
5. Shared packages expose stable public APIs.  
6. Packages never depend on applications.  
7. Applications never depend on one another.  
8. Business engines remain deterministic.  
9. Platform capabilities remain product-neutral.  
10. Empty architectural layers are prohibited.

---

## Target repository structure

```
apps/
├── refurb-genius/
│   ├── src/
│   │   ├── app/              # App shell, providers, entry (optional split)
│   │   ├── routes/           # Thin file routes
│   │   ├── platform/         # App-side vendor seams (compose packages)
│   │   └── features/         # App-owned vertical slices only
│   └── package.json
│
├── future-app/
│   └── …
│
└── platform-admin/
    └── …

packages/
├── core/                 # Constants, pure utils, mock data
├── types/                # Domain types, DTOs (zero runtime deps)
├── ui/                   # Design-system primitives (buttons, inputs, …)
├── platform-ui/          # Higher-level shared product chrome (optional later)
├── auth/                 # Auth contracts / helpers (no app workflows)
├── ai/                   # Shared AI client factories / prompt utilities
├── documents/            # Document generation primitives (PDF building blocks)
├── audit/                # Audit trail primitives
├── notifications/        # Email/push abstractions
├── billing/              # Billing primitives (not checkout UX)
├── organisations/        # Org/tenant domain primitives
├── projects/             # Shared project entity contracts / pure helpers
├── storage/              # Storage adapters / path helpers
├── services/             # Deterministic engines (pricing, ROI, deals)
├── supabase/             # Client factories (browser/server)
└── testing/              # Shared test utils / fixtures
```

Workspace example (`pnpm-workspace.yaml` — target):

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### Import rules (target)

```
apps/A  ──▶  packages/*     ✅
apps/A  ──▶  apps/B         ❌  forever
packages/X ──▶ packages/Y   ✅  only downward / published deps
packages/* ──▶ apps/*       ❌
```

---

## Ownership model (three levels)

### 1. Application features

Each application owns its own workflows under:

```
apps/refurb-genius/src/features/
├── estimate
├── feasibility
├── ai-upload
├── ai-design
├── sharing
├── export
├── payment
├── gallery
└── auth
```

**Features define:**

- product workflows  
- presentation (UI, hooks, serverFns)  
- orchestration across ports  
- application-specific validation  
- user experience  

**Features do not become shared packages** just because a future app might want
a similar wizard. A second app should either:

1. Compose the same **packages** (engines, auth, storage) and implement its own
   feature workflow, or  
2. Wait until a real shared capability is extracted with a stable API.

Layout inside a feature (non-ceremonial — only folders with code):

See [FEATURE_SLICE.md](./FEATURE_SLICE.md) and [`src/features/README.md`](../../src/features/README.md).

```
features/<name>/
  domain/ | application/ | infrastructure/ | presentation/
  index.ts   # public API for this app only
```

### 2. Shared domain services (`packages/services`)

Reusable **business logic engines** belong in shared service packages — not in
application features and not in UI.

Target shape (logical modules; may live as subpaths of `@repo/services` or
split packages later):

```
packages/services/
├── pricing              # category / line-item refurb pricing (authoritative mid_total)
├── roi                  # ROI, yield, risk from purchase + budget + GDV
├── estimating           # enhanced / scope-based / new-build advisory engines
├── reports              # pure report assembly helpers (no React)
├── valuation            # valuation / appraisal calculators
├── image-analysis       # pure normalisers / scoring helpers (no OpenAI client)
└── calculators          # small pure calculators (SDLT, rates, …)
```

#### Properties (required)

| Property | Meaning |
|----------|---------|
| **Deterministic** | Same inputs → same outputs (no randomness, no hidden clocks for money paths) |
| **Framework-independent** | No TanStack, no Nitro, no Vite |
| **React-free** | No components, hooks, JSX |
| **Route-free** | No knowledge of URLs or loaders |
| **UI-free** | No CSS, design tokens, or presentation DTOs |
| **Reusable** | Callable from any app, serverFn, CLI, or test |

#### Contract with applications

```
Application feature
  → application use case / infrastructure adapter
  → packages/services engine
```

- Features **orchestrate** engines (when to call, how to persist, how to show).
- Engines **never know which application** is calling them.
- Engines accept plain inputs and return plain results (types from `@repo/types`
  or local exported types).
- **No** `import` from `apps/*` or `src/features/*`.

#### Authority rules (financial)

| Concern | Owner |
|---------|--------|
| Authoritative refurb **mid_total** | `services/pricing` (`runPricingEngine`) |
| Authoritative **ROI** figures | `services/roi` (`runRoiEngine`) using pricing mid_total as budget |
| Enhanced / new-build estimates | `services/estimating` (or current `enhanced-estimate` / `new-build`) — **advisory** unless product policy promotes them |
| Deal scoring | `services` deal-analysis — after pricing + ROI |

Applications must not reimplement these formulas in features, routes, or components.

#### Today (`@repo/services`)

| Module (current) | Maps toward |
|------------------|-------------|
| `pricing/` | `pricing` |
| `roi/` | `roi` |
| `enhanced-estimate/`, `new-build/`, `cost-library/`, `trade-rates/` | `estimating` + calculators |
| `deal-analysis/` | scoring (keep under services) |
| `development-appraisal/`, `uk-region/` | valuation / calculators |
| `ai/` (if pure helpers) | prefer `image-analysis` or platform `ai` for clients |

#### Anti-patterns

```ts
// ❌ Engine knows about an app feature
import { something } from "@/features/estimate";

// ❌ Engine uses React Query
import { useQuery } from "@tanstack/react-query";

// ❌ Feature reimplements mid_total
const mid = labour + materials * 1.1;

// ✅ Feature orchestrates
const pricing = runPricingEngine(inputs);
const roi = runRoiEngine({ refurb_budget: pricing.mid_total, ... });
```

---

### 3. Shared platform capabilities

**Technical** capabilities shared across applications belong in platform packages.
They solve **infrastructure problems**, not product workflows.

```
packages/
├── auth              # session, identity helpers, cookie contracts
├── ai                # provider clients, model config, tool wiring
├── documents         # PDF/binary building blocks
├── storage           # object storage paths, upload helpers
├── audit             # append-only event writers/readers
├── notifications     # email/SMS/push adapters
├── billing           # entitlements, invoices, webhooks plumbing
├── supabase          # browser/server client factories
├── projects          # shared project entity helpers (not app wizards)
└── organisations     # tenant/org primitives
```

Also keep:

| Package | Role |
|---------|------|
| `types` | Shared types/DTOs |
| `core` | Constants, formatters, pure utils |
| `ui` / `platform-ui` | Design system (UI is platform chrome, not domain engines) |
| `testing` | Test utilities |

#### Domain services vs platform capabilities

| | Shared domain services | Shared platform capabilities |
|--|------------------------|------------------------------|
| **Question they answer** | “What is the price / ROI / score?” | “How do we store, auth, notify, call AI?” |
| **Purity** | Prefer pure / deterministic | Often IO-bound (network, DB, vendors) |
| **Examples** | pricing, roi, estimating | auth, storage, supabase, notifications |
| **Called by** | Features, other services | App `platform/` seams, feature infrastructure |
| **Knows apps?** | Never | Never |

#### Properties (platform packages)

| Do | Do not |
|----|--------|
| Abstract vendors behind stable APIs | Embed Refurb-only UX copy or routes |
| Support browser and/or server entrypoints | Mix browser+server secrets in one barrel |
| Stay reusable across apps | Depend on `apps/*` or app features |
| Compose `types` / `core` | Reimplement financial engines |

#### Today → target mapping

| Today | Target capability package |
|-------|---------------------------|
| `@repo/supabase` | `packages/supabase` |
| `src/platform/openai`, `src/platform/huggingface` | extract → `packages/ai` when second consumer exists |
| `src/platform/posthog` | stay app seam or thin analytics package later |
| `src/lib/photos` storage paths | → `packages/storage` when multi-app |
| `src/lib/email` / edge functions | → `packages/notifications` |
| Payment checkout UX | stays **app feature**; Stripe plumbing → `packages/billing` |
| Project types/helpers | → `packages/projects` / `@repo/types` when stable |

#### Anti-patterns

```ts
// ❌ Platform package imports an app workflow
import { EstimateWizard } from "apps/refurb-genius/...";

// ❌ Auth package owns signup marketing page
export function SignupPage() { ... }

// ✅ App feature owns UX; package owns capability
const client = createBrowserSupabase(); // packages/supabase
const session = await getSession(client); // packages/auth helper
```

---

### 4. Application platform seams

Each app keeps a thin `src/platform/` (or `apps/<app>/src/platform/`) that:

- composes package factories for that app’s runtime  
- never becomes a second home for product domain logic  
- stays **browser vs server separated** (no mixed barrels)

Today this is root `src/platform/*`; target is
`apps/refurb-genius/src/platform/*`.

**Seams wire packages into the app; they are not a third place for domain engines.**

```
apps/refurb-genius/src/platform/openai/server.ts
  → re-exports or configures packages/ai (or @repo until extracted)
apps/refurb-genius/src/features/estimate/infrastructure/...
  → calls runPricingEngine from packages/services
```

---

## Current vs target (this repository)

| Aspect | Today (2026-07) | Target |
|--------|-----------------|--------|
| App location | Repo root `src/` | `apps/refurb-genius/src/` |
| Workspace | `packages/*` only | `apps/*` + `packages/*` |
| Shared packages | `@repo/types`, `core`, `services`, `ui`, `supabase`, … | Same + capability packages as needed |
| App features | `src/features/*` | `apps/refurb-genius/src/features/*` |
| Multi-app | Single app | Multiple apps, no cross-imports |

**We do not move the tree in one rewrite.** The plan freezes ownership *rules*
now; physical layout moves in phases (below).

### Current package name mapping

| Today | Target role |
|-------|-------------|
| `@repo/types` | `packages/types` |
| `@repo/core` | `packages/core` |
| `@repo/services` | `packages/services` |
| `@repo/ui` | `packages/ui` |
| `@repo/supabase` | `packages/supabase` |
| `@repo/integrations` | Revisit → split into `ai` / capability packages or remove |
| `src/platform/*` | App seam → stays in app; extract pure bits to packages when shared |
| `src/features/*` | App features only (already correct ownership) |

---

## What stays application-local (Refurb Genius)

These remain **refurb-genius features**, not platform packages:

| Feature | Why app-local |
|---------|----------------|
| estimate | Product estimate UX + orchestration |
| feasibility | Study supervisor UX |
| ai-upload / ai-design | Product vision/redesign workflows |
| sharing / export / gallery | Product surfaces |
| payment | Checkout UX (billing *primitives* may later live in packages) |
| auth (presentation) | App auth UX (session helpers may be package) |

If Deal Copilot, trades marketplace, or admin tooling become separate apps, they
get their own `apps/*` and **compose** `@repo/services`, auth, storage — they
do **not** import `apps/refurb-genius/src/features/*`.

---

## Incremental migration roadmap

### Phase 0 — Rules (done / ongoing)

- Feature-slice ownership inside the single app  
- Legacy freeze on `src/lib|hooks|services`  
- Package boundaries for types/core/services/ui/supabase  
- Document this plan  

### Phase 1 — Package-first extractions (no apps/ yet)

Extract only when a second consumer is real or imminent:

1. **Domain services:** keep / grow engines under `@repo/services` (`pricing`, `roi`,
   estimating modules). Never move React estimate UI into the package.  
2. **Platform capabilities:** promote pure project **types/helpers** → `@repo/types` /
   future `packages/projects` when stable.  
3. Promote storage path helpers → future `packages/storage` when a second app needs them.  
4. Promote AI client factories → future `packages/ai` when a second app needs them.  
5. Do **not** extract `features/estimate` (or any app feature) into a package.

### Phase 2 — Introduce `apps/refurb-genius`

1. Add `apps/refurb-genius` with package.json; move root `src/` → app.  
2. Update workspace, Vite, Vercel `rootDirectory` / monorepo settings.  
3. Keep `@repo/*` paths stable.  
4. Green CI + deploy before any second app.

### Phase 3 — Additional applications

1. Scaffold `apps/<name>` with empty features; depend only on packages.  
2. Enforce invariant: no `apps/*` → `apps/*` imports.  
3. Shared UX via `packages/ui` / `platform-ui` only.

### Phase 4 — Capability packages as needed

Create `auth`, `ai`, `billing`, … packages **lazily** — not as empty shells.

---

## Enforcement (planned + current)

| Rule | Current enforcement | Target |
|------|---------------------|--------|
| No new domain in lib/hooks/services | `legacy-layer-freeze` invariant | Keep |
| Features only via public API | `public-api-boundary` | Keep |
| No app→app imports | N/A (single app) | Invariant over `apps/*` |
| Packages never import apps | Informal | ESLint `no-restricted-imports` |
| Financial authority in services | pricing/ROI invariants | Keep |

---

## Decision log

| Decision | Choice |
|----------|--------|
| Multi-app shape | Turborepo-style `apps/` + `packages/` monorepo |
| Cross-app code reuse | Packages only — never feature sharing |
| When to extract a package | ≥2 real consumers or proven stable contract |
| Refurb product workflows | Stay in app features forever unless productized as platform product |
| Empty packages | Forbidden (same anti-ceremony rule as empty feature layers) |

---

## Shared UI strategy

Do **not** put every reusable component in one package.

### `packages/ui` — design system

Pure primitives. **Know nothing about applications.**

Examples: Button, Input, Dialog, Tabs, Card, Table, Badge, Typography, Icons,
form controls, low-level Sidebar, `useIsMobile`.

### `packages/platform-ui` — platform experience (lazy)

Reusable **product-neutral** chrome. Understands platform concepts (workspace,
account, permissions) but not Refurb-specific workflows.

Examples: AppShell, Navigation, WorkspaceSwitcher, AccountMenu,
NotificationCentre, PermissionGuard, FileUploader, DocumentViewer,
AuditTimeline, UsageMeter.

**Not created until ≥2 apps need them.**

### Application components

Stay in features:

```
features/estimate/presentation/components
features/feasibility/presentation/components
features/gallery/presentation/components
```

Never move into shared packages merely because they *look* similar.

---

## Dependency direction

```
Application
    │
    ▼
Application Features
    │
    ▼
Shared Platform Packages (auth, ui, supabase, …)
    │
    ▼
Shared Domain Services (pricing, roi, …)
    │
    ▼
Core / Types
```

| Allowed | Forbidden |
|---------|-----------|
| apps → packages | app → another app |
| feature → shared packages | package → app |
| presentation → application | shared UI → app routes |
| application → domain | domain → React |
| application → shared services | domain → Supabase |
| infrastructure → ports | domain → browser APIs |

Enforced today by `tests/invariants/package-dependency.invariant.test.ts`
(+ feature-slice / server-only invariants).

---

## Related docs

- [FEATURE_SLICE.md](./FEATURE_SLICE.md) — Priority 1.9 application feature ownership  
- [package-registry.md](./package-registry.md) — Priority 1.10 classification  
- [package-promotion.md](./package-promotion.md) — Priority 1.13 promotion process  
- [capability-boundaries.md](./capability-boundaries.md) — Priority 1.12 AI/auth/billing/…  
- [platform-glossary.md](./platform-glossary.md) — Priority 1.14 glossary  
- [domain-ownership-audit.md](./domain-ownership-audit.md) — overlapping modules  
- [package-boundaries.md](./package-boundaries.md) — current `@repo/*` matrix  
- [platform-boundary.md](./platform-boundary.md) — vendor SDK seams  
- [overview.md](./overview.md) — current high-level picture  
