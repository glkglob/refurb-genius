# Feature slices — ownership

Each directory under `src/features/` is a **vertical slice**: one business
capability owns its domain, use cases, IO adapters, and UI/RPC surface.

**New product behaviour starts here**, not in `src/lib/`, `src/hooks/`, or
`src/services/`.

These features are **application-owned** (Refurb Genius product workflows).
They are **not** shared packages. Future apps in the Intelligent Platform
compose `packages/*` and implement their own features — they never import
this folder. See [platform-architecture-plan.md](../../docs/architecture/platform-architecture-plan.md).

Full policy: [FEATURE_SLICE.md](../../docs/architecture/FEATURE_SLICE.md).  
Overlap map: [domain-ownership-audit.md](../../docs/architecture/domain-ownership-audit.md).

---

## Request flow

```
Route (src/routes/*)
  → presentation   # components, hooks, createServerFn, zod schemas
  → application    # use cases + ports
  → domain         # pure rules (or @repo/services for pricing/ROI)
  → infrastructure # repositories, adapters, mappers
  → platform / @repo/*
```

---

## Recommended tree

Use only the folders you need. **Do not create empty ceremonial directories.**

```
src/features/<feature>/
├── domain/                 # Pure — no IO, no React
│   ├── entities.ts         # or types.ts / models.ts
│   ├── value-objects.ts    # optional
│   ├── errors.ts           # optional
│   ├── services.ts         # pure domain services (optional)
│   ├── rules.ts            # pure functions (common in this repo)
│   └── index.ts            # barrel
├── application/
│   ├── use-cases/          # or flat *.ts use-case modules
│   ├── ports/              # or ports.ts
│   ├── dto/                # optional
│   └── index.ts
├── infrastructure/
│   ├── repositories/       # when there is persistence
│   ├── adapters/           # AI, engines, external APIs (*.server.ts if secret)
│   ├── mappers/            # optional row ↔ domain
│   └── index.ts            # wiring barrel (allowed cross-slice import)
├── presentation/
│   ├── components/         # feature-specific UI
│   ├── hooks/              # feature React Query / local state
│   ├── schemas/            # zod validators for serverFns (optional)
│   ├── serverFns.ts        # RPC surface (common single file)
│   └── index.ts
└── index.ts                # ★ Public API only — routes import from here
```

### Minimum viable slice

| Stage | Required | Optional until needed |
|-------|----------|------------------------|
| Scaffold / stub | `index.ts` + thin `application/` stubs | domain files, infra adapters |
| IO appears | `application` ports + `infrastructure` | mappers/ |
| UI / RPC | `presentation/` (+ `serverFns` if server) | components/, hooks/, schemas/ |
| Pure rules grow | `domain/` | split entities/value-objects/errors |

**auth** today is presentation-only — that is valid until domain/IO land.

### Naming (this repo)

Prefer names that match existing slices; the recommended names above are aliases:

| Recommended | Existing / acceptable |
|-------------|------------------------|
| `entities.ts` | `types.ts`, `models.ts` |
| `use-cases/` | flat files (`createEstimate.ts`, `generateRedesign.ts`) |
| `ports/` | `ports.ts` |
| `schemas/` | inline zod in `serverFns.ts` |

---

## Layer ownership (what may live where)

| Layer | Owns | Must not own |
|-------|------|----------------|
| **domain** | Entities, rules, value objects | React, IO, env, Supabase, OpenAI |
| **application** | Use cases, orchestration, ports | SDK implementations, React UI |
| **infrastructure** | Repositories, adapters, mappers | UI |
| **presentation** | UI, hooks, server boundaries, schemas | Business engines (pricing/ROI) |
| **index.ts** | Public API | Implementation details |

Financial engines (**pricing, ROI, deal score**) stay in **`@repo/services`**.
Slices **call** them via domain re-export or infrastructure adapters — they do
not reimplement mid_total / ROI.

---

## Current slice ownership

| Feature | Owns (capability) | Notes |
|---------|-------------------|--------|
| `estimate` | Persist/create estimates, AI estimate pipeline | Pricing math → `@repo/services` |
| `ai-upload` | Photos + vision analysis | `photoStore` still in `lib/photos` (infra debt) |
| `ai-design` | Redesign + scope analysis | Catalog data still in `lib/redesign` |
| `roi` | ROI use cases + sensitivity | Engine → `@repo/services` |
| `feasibility` | Study orchestration across slices | Imports other slices via public APIs only |
| `sharing` | Share links / access | |
| `export` | PDF / export pipeline | Scaffolded → growing |
| `payment` | Checkout / webhooks | Scaffolded |
| `gallery` | Public gallery | Scaffolded; live path still `lib/*` |
| `auth` | Auth presentation surface | No domain/infra yet |

**Not yet slices (see ownership audit):** projects (lib/hooks/serverFns), trades.

---

## Import rules

```ts
// ✅
import { usePhotos } from "@/features/ai-upload";
import { saveProjectEstimate } from "@/features/estimate/infrastructure";

// ❌
import { usePhotos } from "@/features/ai-upload/presentation/hooks/usePhotos";
```

- Outside the slice: only `@/features/<name>` or `@/features/<name>/infrastructure`.
- Inside the slice: respect dependency direction  
  `presentation → application → domain` and  
  `infrastructure → application ports + domain` (never presentation).

---

## Where code should NOT go

| Folder | Role | New domain logic? |
|--------|------|-------------------|
| `src/lib/` | Cross-cutting utils (frozen allowlist) | **No** |
| `src/hooks/` | App-shell only (auth, theme) | **No** — feature hooks → `presentation/hooks` |
| `src/services/` | Legacy seams (frozen) | **No** |
| `src/serverFns/` | Legacy RPC | Prefer `presentation/serverFns.ts` |
| `src/core/` | Legacy domain | **No** — migrate into slices / `@repo/*` |

---

## Adding a feature checklist

1. Name the capability (one noun: `estimate`, `sharing`, …).
2. Add `index.ts` public API; add layers only when code exists.
3. Put pure rules in `domain/` or `@repo/services` (financial).
4. Put IO behind ports + infrastructure adapters.
5. Expose UI/RPC from `presentation/`; keep routes thin.
6. Run `pnpm test:invariants` (feature-slice + public-api-boundary + freeze).
