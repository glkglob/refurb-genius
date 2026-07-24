# Services layer — retired (Phase 7 C6)

> **Status:** Empty transitional layer. **Do not add files here.**
> New product IO belongs in `src/features/<slice>/infrastructure` + `src/platform/*`.
> The file set is frozen: `SERVICES_ALLOWLIST` is empty
> (`tests/invariants/config/frozen-path-allowlists.ts` via
> `legacy-layer-freeze.invariant.test.ts`). Any new `.ts`/`.tsx` under this
> directory fails invariants.

## History

| Former module | Role | Outcome |
| ------------- | ---- | ------- |
| `@/services/trades/*` | Trades marketplace stores | Migrated to `@/features/trades` (Phase 6 C1) |
| `@/services/projects` | Re-export of `@/core/projects` | Removed — **zero importers** (Phase 7 C6) |
| `@/services/storage` | Re-export / thin wrappers over `@/lib/photos` | Removed — **zero importers** (Phase 7 C6) |

## Current ownership (do not use this folder)

| Concern | Use instead |
| ------- | ----------- |
| Projects | `@/lib/projects`, `@/core/projects`, `@/hooks/useProjects`, serverFns |
| Photos / buckets | `@/lib/photos`, feature infrastructure (e.g. ai-upload), platform Supabase |
| Trades | `@/features/trades` |
| Pure engines | `@repo/services` |

This directory exists only so architecture registry paths remain valid while the
freeze continues to block reintroduction of service facades.
