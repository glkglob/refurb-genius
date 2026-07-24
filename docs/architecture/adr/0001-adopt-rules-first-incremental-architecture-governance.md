# ADR 0001 — Adopt rules-first incremental architecture governance

| Field | Value |
| ----- | ----- |
| **Status** | Accepted |
| **Date** | 2026-07-24 |
| **Owner** | Platform architecture (repository maintainers) |
| **Last reviewed** | 2026-07-24 |
| **Review cadence** | On superseding ADR or material challenge; otherwise with overview quarterly review |
| **Deciders** | Repository maintainers / platform programme |
| **Evidence** | [Phase 0 inventory](../phase-0-inventory-report.md) |
| **Policy doc** | [Architecture overview](../overview.md) |
| **Docs index** | [docs/README.md](../../README.md) |
| **ADR process** | [adr/README.md](./README.md) |

**Immutability:** This ADR is append-only history. Do not rewrite accepted text. Correct by accepting a later ADR that **supersedes** this one and updating the Status field only to `Superseded by ADR NNNN`.

---

## Context

The repository is a **single TanStack Start application** in a pnpm monorepo, with:

- extracted packages (`@repo/core`, `@repo/services`, `@repo/supabase`, `@repo/ui`, `@repo/types`);
- feature slices under `src/features/`;
- platform vendor seams under `src/platform/`;
- transitional freezes for `src/lib`, `src/hooks`, and `src/services` via exact path allowlists;
- a mature invariant suite for packages, platform boundaries, server-only rules, and financial authority;
- product labels for **Refurb Genius**, **Refurb IQ** (reserved empty namespace), and **Deal Copilot** (multi-root, live).

Phase 0 verified that aspirational multi-app layouts, completed product isolation, and Deal Copilot isolation from persistence are **not** fully realised in code. Simultaneously, broad folder rewrites would risk runtime behaviour, route generation, and untracked debt.

The programme needs a durable decision on **how** architecture work proceeds—not a speculative target tree.

---

## Decision

We adopt **rules-first, freeze-and-baseline, evidence-driven, incremental convergence** as the sole architecture governance model for this repository:

```text
document → register when verified → enforce narrowly → baseline → migrate incrementally
```

### Platform model (documented)

The repository implements one **Intelligent Platform**:

- **Refurb Genius** — public-facing refurbishment product (live behaviour in the single app shell).
- **Deal Copilot** — shared intelligent assistant (multi-root implementation).
- **Refurb IQ** — commercial/professional product boundary (**reserved**, not implemented).

### Three ownership axes

Architecture decisions must identify **product**, **technical**, and **data** ownership. Incomplete data ownership is an open gap (Phase 4), not something to invent.

### What we accept as current freezes

- Existing exact-path allowlists for `src/lib`, `src/hooks`, and `src/services` remain in force.
- The full `src/lib` freeze is **stricter** than a “freeze-lite” domain-only freeze; it is **not** relaxed in this ADR.
- Existing baseline allowlists (e.g. `no-legacy-imports`) remain interim exception mechanisms until a structured registry is authorised.

### What we defer

- Machine-readable architecture registries (`tests/invariants/config/*`).
- New product-isolation and Deal Copilot isolation invariants.
- Supabase consolidation and Deal Copilot root consolidation.
- Any `apps/*` multi-application restructure.
- Creation of `src/workflows` without verified cross-feature pain.
- Splitting `@repo/services` without exit criteria.

### Explicit rejections

This ADR **rejects**:

1. An **immediate repository-wide folder rewrite** “to match a diagram.”
2. Introducing a **speculative `apps/*` structure** without ownership/deployment justification.
3. Enabling **broad architecture enforcement** before ownership is verified, registered, and baselined.
4. Treating **reserved namespaces** (especially `src/core/refurbIq`) as completed product boundaries.
5. Claiming Deal Copilot or multi-product isolation is already fully **enforced** when Phase 0 shows otherwise.

---

## Alternatives considered

| Alternative | Why not chosen |
| ----------- | -------------- |
| Big-bang monorepo restructure into `apps/refurb-genius`, `apps/refurb-iq`, etc. | High risk; shell is immovable for TanStack routing; IQ has no product code; Phase 0 shows no multi-app consumers |
| Enforce all target rules immediately without baselines | Would fail CI on known debt (Deal Copilot Supabase, presentation queries, large legacy import baseline) and encourage false green via wildcards |
| Leave architecture only in informal CLAUDE.md notes | No single reviewable policy; contradicts “document first” |
| Freeze-lite only (domain files under `src/lib`) now | Would **weaken** current CI freeze without a registry phase; deferred until Phase 2+ review |

---

## Consequences

### Positive

- Clear authoritative policy in [overview.md](../overview.md).
- Contributors and agents can distinguish **current / target / transitional / enforced / unenforced**.
- Later phases have a fixed sequence and non-goals.
- Existing invariants and freezes remain valuable and are not discarded.

### Negative / costs

- Target rules (e.g. Deal Copilot no direct Supabase) remain **debt** until Phase 3+.
- Full `src/lib` freeze continues to make pure-utility additions require allowlist edits.
- Documentation must be kept honest when code changes; aspirational docs need alignment over time.

### Neutral

- `@repo/services` stays intact; financial authority unchanged.
- Runtime behaviour unchanged by this ADR (documentation decision only).

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Policy docs drift from code again | Phase 0 inventory as evidence; update overview when structure changes |
| Pressure to “just enforce everything” | This ADR and overview forbid broad enforcement before register + baseline |
| IQ reservation used as fake progress | Explicit reserved status; empty implementation called out |
| Transitional freezes become permanent | Phase 5 migration candidates; allowlist shrink is success |

---

## Relationship to existing invariant tests

| Area | Relationship |
| ---- | ------------ |
| `legacy-layer-freeze.invariant.test.ts` | **Keeps** path freezes for lib/hooks/services; documents them as transitional freezes, not final design |
| `no-legacy-imports.invariant.test.ts` | **Keeps** baseline allowlist model; future structured baselines should not invent wildcards |
| `package-dependency` / `platform-boundary` / `server-only` / feature-slice / public-api | **Affirmed** as high-value existing enforcement |
| Product isolation / Deal Copilot isolation | **Not claimed as existing**; candidates for later narrow invariants after registration |
| Financial pricing/ROI invariants | **Unchanged** and mandatory |

This ADR does **not** modify any invariant test or CI workflow.

---

## Relationship to transitional allowlists

Allowlists in `legacy-layer-freeze.invariant.test.ts` and baseline entries in `no-legacy-imports.invariant.test.ts` are the **current freeze and exception mechanisms**. They:

- prevent unreviewed expansion;
- do **not** certify listed files as long-term homes;
- should later migrate to a config registry with owner / reason / review dates (Phase 2), without weakening freezes in the same step without review.

---

## Rollback / reconsideration

Reconsider this ADR if:

- the repository **actually** becomes multi-app with separate deployables and the single-shell model is abandoned by an explicit product decision; or
- maintainers accept a time-boxed big-bang rewrite with staffing and migration plan (would require a **new ADR** that supersedes this one).

Rollback of *this* documentation decision is low-cost (docs only) but would leave governance ambiguous; prefer superseding ADR over silent drift.

---

## Follow-on work (not authorised by this ADR alone)

1. Phase 2 — architecture registry + structured baselines (when authorised).
2. Phase 3 — narrow invariants + PR architecture checklist + CI wiring.
3. Phase 4 — data ownership matrix + AI governance formalisation.
4. Phase 5 — single evidence-backed migration candidate.

---

## References

- [Phase 0 inventory report](../phase-0-inventory-report.md)
- [Architecture overview](../overview.md)
- [FEATURE_SLICE.md](../FEATURE_SLICE.md)
- [platform-boundary.md](../platform-boundary.md)
- [Repo convergence plan](../../repo-convergence-plan.md)
