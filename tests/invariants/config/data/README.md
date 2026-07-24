# Data Architecture Registry (Phase 4)

Machine-readable **data ownership, tenancy, persistence, and security inventory**.

| Field | Value |
| ----- | ----- |
| **Owner** | Platform architecture |
| **Last reviewed** | 2026-07-24 |
| **Mode** | Phase 5: integrity + drift ratchets — no schema/RLS/runtime changes |

## Modules

| File | Contents |
| ---- | -------- |
| `domains.ts` | Product data domains |
| `persistence.ts` | Write/read authority by layer |
| `tenancy.ts` | Tenant scopes |
| `database-inventory.ts` | Tables + DB functions |
| `storage.ts` | Buckets |
| `migrations.ts` | Migration ownership policy |
| `services.ts` | Service/capability ownership |
| `lineage.ts` | Verified data flows |
| `security.ts` | AuthN/Z, secrets classification |
| `index.ts` | Barrel + `DATA_REGISTRY_META` |

## Source of truth

| Concern | Location |
| ------- | -------- |
| Generated tables | `packages/supabase/src/database.types.ts` |
| SQL history | `supabase/migrations/` |
| Architecture policy | `docs/architecture/overview.md` |

## Integrity

`tests/invariants/data-architecture-registry.invariant.test.ts` validates consistency against generated types and paths. It does **not** modify or re-test RLS.
