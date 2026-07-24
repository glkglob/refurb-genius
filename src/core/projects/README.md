# Projects core surface

## Pure domain (C4a) — canonical

```text
src/core/projects/domain/
```

Preferred imports:

```ts
import type { Project, UKRegion, ProjectStage } from "@/core/projects/domain";
import { UK_REGIONS, PROPERTY_TYPES, estimatedRefurbCost } from "@/core/projects/domain";
```

### Allowed in domain

- Types and constants re-exported from `@repo/types` (single authoritative source)
- Pure helpers (`estimatedRefurbCost`, `estimatedProfit`)

### Forbidden in domain

- React / React Query / Router
- Supabase / platform clients
- `projectStore`, hooks, routes, presentation
- serverFns, photos, storage

## Runtime store (C4b) — canonical

```text
src/core/projects/projectStore.ts
```

- **Canonical type authority:** `@repo/types` (via domain)
- **Canonical pure domain:** `src/core/projects/domain`
- **Canonical runtime store:** `src/core/projects/projectStore.ts`
- **Compatibility shim:** `src/lib/projects.ts` re-exports domain symbols + `projectStore` (no store body)
- **Live UI authority:** `useProjects` / React Query / `createProjectServerFn` (unchanged by C4b)
- **`projectStore` status:** legacy-compatible external-store API (list/get/subscribe/create/setStage). Not the primary UI path.
- **Dual caches:** `projectStore` memory cache and React Query `["projects"]` still coexist — **not resolved in C4b** (C4c)

```ts
import { projectStore } from "@/core/projects/projectStore";
// or compatibility:
import { projectStore } from "@/lib/projects";
```

## Compatibility

- `@/lib/projects` re-exports pure domain symbols and `projectStore` from core (C4b).
- `@/core/projects` re-exports domain + store + helpers + mocks.
- Photos re-exports (`photoStore`, `formatFileSize`, `ProjectPhoto`) are **legacy coupling (C5)** — do not expand.

## Migration status

| Phase | Scope | Status |
|-------|--------|--------|
| **C4a** | Pure domain types/helpers | Complete |
| **C4b** | `projectStore` ownership moved to core | Complete (implementation; governance completion later) |
| **C4c** | Hooks / React Query convergence | Pending |
| **C5** | Photos / storage (`photoStore` re-export) | Pending |

Do not treat Projects runtime ownership as finished after C4b alone — live hooks path and dual-cache convergence remain C4c.
