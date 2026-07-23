# Refurb Genius Architecture Overview

## Current State (July 2026)

Refurb Genius is a **pnpm workspace monorepo** hosting a single **TanStack Start** SSR
application (React 19 + Vite 7 + Nitro) with extracted shared libraries and a
**feature-slice** layout inside `src/features/`. New business capability **must**
land in a slice (or `@repo/services` for pure financial engines), not in
`src/lib/`, `src/hooks/`, or `src/services/`.

**Canonical agent guide:** [`CLAUDE.md`](../../CLAUDE.md) at repo root.  
**Request flow + ownership:** [Feature-Slice Architecture](./FEATURE_SLICE.md).  
**Multi-app platform target:** [Platform Architecture Plan](./platform-architecture-plan.md).  
**Package registry:** [package-registry.md](./package-registry.md) · **Promotion:** [package-promotion.md](./package-promotion.md) · **Glossary:** [platform-glossary.md](./platform-glossary.md) · **Capabilities:** [capability-boundaries.md](./capability-boundaries.md).

### Platform principle

> **Applications own product workflows. Shared packages own reusable capabilities.**

Refurb Genius is one app in a future Intelligent Platform monorepo (`apps/*` +
`packages/*`). Applications never import each other; they compose packages.
Today the app still lives at repo root `src/` — the plan is incremental, not a
big-bang move.

---

## Canonical request flow (in-app)

```
Route → feature presentation → application/use case → domain
      → infrastructure adapter → platform / @repo packages
```

Routes stay thin. Domain rules do not grow in generic folders.
Application **features** stay app-local; do not extract a feature into a shared
package just because another product might want something similar later.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Production shell (root src/)                    │
│  TanStack Start + Vite 7 + Nitro SSR + React 19            │
│                                                             │
│  src/                                                       │
│  ├── features/          Vertical slices (canonical)         │
│  ├── platform/          Vendor SDK seams                    │
│  ├── routes/            Thin file routes                    │
│  ├── components/        App shell + composition UI          │
│  ├── core/ · lib/ · hooks/ · services/ · serverFns/       │
│  │                      Legacy / transitional (frozen)      │
│  ├── integrations/      Generated Supabase types only       │
│  └── server.ts          Nitro entry + OTEL bootstrap        │
└─────────────────────────────────────────────────────────────┘
                              ▲
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────────┐    ┌──────▼──────┐    ┌────────▼────┐
   │  @repo/ui   │    │ @repo/core  │    │@repo/services
   │  shared UI  │    │ constants   │    │ pricing, ROI
   └─────────────┘    └─────────────┘    │ deal scoring │
        │                    │           └──────────────┘
        └────────────┬───────┴──────────────────┘
                     ▼
              ┌─────────────┐     ┌──────────────┐
              │ @repo/types │     │ @repo/supabase│
              └─────────────┘     └──────────────┘
```

See also:

- [Feature-Slice Architecture](./FEATURE_SLICE.md)
- [Domain ownership audit](./domain-ownership-audit.md) (estimate / ROI / projects / photos / gallery / redesign)
- [Platform Boundary](./platform-boundary.md)
- [Dependency Rules](./dependency-rules.md)
- [Routes](./routes.md)
- [`src/features/README.md`](../../src/features/README.md)

---

## Financial Authority (Critical Invariant)

Deterministic engines in `@repo/services` are the **only** source of financial truth.
AI is advisory — it suggests work and quantities; pricing/ROI/score never trust raw
AI unit costs.

```
User inputs → scoreDealOpportunity() → runPricingEngine()
  → pricing.mid_total (authoritative refurb budget)
  → runRoiEngine(refurb_budget: pricing.mid_total)
  → ROI%, yield, profit, score
```

Rules:

1. ROI runs only after pricing succeeds (`pricing.mid_total` must be non-null).
2. User-entered refurb budget is **never** passed directly to the ROI engine.
3. No fallback operators (`??`, `||`) on `refurb_budget` selection.
4. Enforced by invariant tests — see [Invariant Protection Report](../invariant-protection-report.md).

Implementation: `src/lib/deal-copilot/dealAnalysis.ts` (Deal Copilot);
`@repo/services` engines for pricing/ROI/deal scoring.

---

## Package Hierarchy

**Allowed direction: downward only** — see [dependency-rules.md](./dependency-rules.md).

| Package          | Role                                                   |
| ---------------- | ------------------------------------------------------ |
| `@repo/types`    | Domain types, DTOs — zero runtime deps                 |
| `@repo/core`     | Constants, formatting, mock data                       |
| `@repo/services` | Deterministic pricing, ROI, deal scoring, AI summaries |
| `@repo/supabase` | Browser/server Supabase client factories               |
| `@repo/ui`       | Shared UI components (migration in progress: 17/46)    |
| `src/platform/`  | App-side vendor seams above `@repo/supabase`           |

---

## Runtime Shell (Immovable)

Root `src/` is the production bootstrap — **do not relocate**. TanStack Start's
plugin resolves routes at build time from `src/routes/` at repo root.

Details: [runtime-boundaries.md](./runtime-boundaries.md).

---

## Build & Validation

```bash
pnpm typecheck && pnpm lint && pnpm test:invariants && pnpm build:vercel
```

| Check            | Command                           |
| ---------------- | --------------------------------- |
| Type safety      | `pnpm typecheck`                  |
| Lint             | `pnpm lint`                       |
| Invariant tests  | `pnpm test:invariants` (81 tests) |
| UI tests         | `pnpm test:ui`                    |
| Production build | `pnpm build:vercel`               |

---

## Product Surfaces (Live)

| Surface            | Routes                 | Notes                               |
| ------------------ | ---------------------- | ----------------------------------- |
| Refurb Genius      | `/projects/*`          | Estimates, photos, scope, reports   |
| Deal Copilot       | `/deal-copilot/*`      | Do not rename to `/deals`           |
| Trades Marketplace | `/trades`, `/trades/*` | Public browse; post/edit auth-gated |
| Gallery            | `/gallery`             | Public                              |
| Admin              | `/admin`               | AI diagnostics, user admin          |

Product IDs: `refurb-genius`, `deal-copilot`, `refurb-iq`, `trades-marketplace`.

Multi-product strategy: [Repo Convergence Plan](../repo-convergence-plan.md).
