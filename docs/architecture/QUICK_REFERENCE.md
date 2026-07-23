# Architectural Boundary Quick Reference

## TL;DR — request flow

```
Route → feature presentation → application → domain
    → infrastructure adapter → platform / @repo/*
```

**New business logic** → `src/features/<slice>/` (or pure engines in `@repo/services`).  
**Not** → `src/lib/`, `src/hooks/`, `src/services/` (frozen allowlists).

Full policy: [FEATURE_SLICE.md](./FEATURE_SLICE.md) · [`src/features/README.md`](../../src/features/README.md)

## Import rules

| From | May import |
|------|------------|
| `src/routes/*` | Feature public APIs, components, platform browser, thin types |
| `features/<a>/*` | Own layers (rules below); other slices only via `@/features/<b>` or `@/features/<b>/infrastructure` |
| `features/*/domain` | `@repo/types`, `@repo/core`, `@repo/services` only |
| `features/*/application` | Own domain + shared kernel — **not** infrastructure/presentation |
| `features/*/infrastructure` | Own domain/application ports, `src/platform/*`, `@repo/*` |
| `src/platform/*` | Vendor SDKs, `@repo/supabase` |

**Forbidden:**

```ts
// ❌ deep cross-slice
import { usePhotos } from "@/features/ai-upload/presentation/hooks/usePhotos";

// ✅ public API
import { usePhotos } from "@/features/ai-upload";

// ❌ new domain file under lib (fails legacy-layer-freeze)
// src/lib/my-new-deal-rules.ts

// ✅ feature domain
// src/features/estimate/domain/rules.ts
```

## Enforcement (CI / pre-commit)

| Invariant | Guards |
|-----------|--------|
| `feature-slice.invariant.test.ts` | Layer purity for standardized slices (+ payment/gallery) |
| `public-api-boundary.invariant.test.ts` | Cross-slice deep imports |
| `legacy-layer-freeze.invariant.test.ts` | No new files in lib/hooks/services |
| `platform-boundary.invariant.test.ts` | Vendor SDKs only in platform |
| `server-only-boundary.invariant.test.ts` | No `*.server` static imports on client surfaces |

```bash
pnpm test:invariants
```

## Checklist for a new capability

1. Create or extend `src/features/<name>/` with domain → application → infrastructure → presentation.
2. Export only through `index.ts` (and infrastructure barrel for wiring).
3. Wire a thin route under `src/routes/`.
4. Use `src/platform/*` for Supabase/OpenAI/PostHog — never raw SDK in presentation.
5. Financial math → `@repo/services` only (pricing/ROI authority).
6. Run `pnpm test:invariants` before commit.
