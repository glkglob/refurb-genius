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

## Compatibility

- `@/lib/projects` re-exports pure domain symbols and still hosts **projectStore** (browser persistence).
- `@/core/projects` re-exports domain + store helpers + mocks.

## Not complete yet

| Phase | Scope |
|-------|--------|
| **C4a** | Pure domain types/helpers (this phase) |
| **C4b** | projectStore ownership / deprecation |
| **C4c** | `useProjects` / runtime ownership (list/stage) |
| **C5** | Photos / storage (`photoStore` re-export here is legacy coupling — do not expand) |

Do not treat Projects runtime ownership as finished after C4a alone.
