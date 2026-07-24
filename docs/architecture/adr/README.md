# Architecture Decision Records (ADRs)

| Field | Value |
| ----- | ----- |
| **Owner** | Platform architecture (repository maintainers) |
| **Last reviewed** | 2026-07-24 |
| **Review cadence** | When a new ADR is added or process changes |

## Navigation

- **Authoritative policy:** [Architecture overview](../overview.md)
- **Docs index:** [docs/README.md](../../README.md)
- **Phase 0 evidence:** [phase-0-inventory-report.md](../phase-0-inventory-report.md)
- **Architecture registry (Phase 2):** [`tests/invariants/config/`](../../../tests/invariants/config/)

## Index

| ADR | Title | Status |
| --- | ----- | ------ |
| [0001](./0001-adopt-rules-first-incremental-architecture-governance.md) | Adopt rules-first incremental architecture governance | Accepted |

## Process rules

1. **Append-only.** New decisions are new files (`NNNN-title.md`). Do not delete historical ADRs.
2. **Immutable body.** Once **Accepted**, do not rewrite the decision text to change meaning.
3. **Supersede, do not rewrite.** If a decision changes, write ADR `N+1` that supersedes the old one; set the old status to `Superseded by ADR NNNN`.
4. **Numbering.** Use zero-padded four-digit IDs (`0001`, `0002`, …) in creation order.
5. **Required links.** Each ADR must link to the [architecture overview](../overview.md) and, when relevant, Phase 0 / registry evidence.
6. **Overview stays current.** Accepting an ADR that changes ownership, dependencies, enforcement, or product boundaries **triggers** a review of [overview.md](../overview.md).

## Status values

| Status | Meaning |
| ------ | ------- |
| Proposed | Under review |
| Accepted | In force |
| Superseded by ADR NNNN | Replaced; kept for history |
| Rejected | Not adopted; kept for history |
