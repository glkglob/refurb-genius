# Architecture registry (Phase 2)

Machine-readable **registration** of verified architecture metadata.

| Field | Value |
| ----- | ----- |
| **Owner** | Platform architecture |
| **Last reviewed** | 2026-07-24 |
| **Mode** | Phase 3: structured baselines + narrow ratchets (no debt migration) |

## Modules

| File | Contents |
| ---- | -------- |
| `architecture-areas.ts` | Platform / product / assistant / package paths |
| `ownership.ts` | Ownership records |
| `dependencies.ts` | Allowed / prohibited / transitional dependency rules |
| `transitional-layers.ts` | `src/lib`, `src/hooks`, `src/services` freeze metadata |
| `frozen-path-allowlists.ts` | Exact freeze path sets (consumed by freeze invariant) |
| `legacy-import-baseline.ts` | Exact legacy import edges (consumed by no-legacy-imports) |
| `ai-boundaries.ts` | Provider SDK placement |
| `exceptions.ts` | Structured exceptions + UI migration boundary list |
| `enforcement-inventory.ts` | Invariants, CI, ADRs, docs map |
| `index.ts` | Barrel + `REGISTRY_META` |
| `data/` | **Phase 4** data ownership, tenancy, tables, storage, security |

## Source of truth

| Concern | Authoritative location |
| ------- | ---------------------- |
| Policy prose | `docs/architecture/overview.md` |
| Evidence inventory | `docs/architecture/phase-0-inventory-report.md` |
| File freezes (allowlists) | `frozen-path-allowlists.ts` |
| Legacy import baselines | `legacy-import-baseline.ts` |
| Structured exceptions | `exceptions.ts` |

## Integrity test

`tests/invariants/architecture-registry.invariant.test.ts` validates registry structure, exception governance fields, and freeze/baseline consistency. It does **not** introduce product-isolation or Deal Copilot Supabase enforcement.
