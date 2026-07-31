# Measured-BOQ catalogue source contract

```text
Status: 4C2C-B foundation
Production rates: NOT APPROVED
Synthetic fixtures: tests only — not product prices
```

## Rules

- **No production measured-BOQ rates are currently approved.**
- Synthetic fixtures live under `tests/fixtures/measured-boq-catalogue/` and are **test-only**.
- Publication requires the acquisition/governance gate (lawful source, licence, redistribution rights).
- Raw licensed vendor files must not be committed without redistribution rights.
- Do not copy `CATEGORY_BASE`, `TRADE_RATES`, AI prompts, builder defaults, or marketplace data into this catalogue.

## Hybrid model

1. Reviewed VCS source (this tree / fixtures)
2. Pure validation + content checksum (`@repo/services` catalogue module)
3. Immutable database revisions (`measured_boq_catalog_revisions` / `_entries`)
4. Server-only snapshot load → synchronous Map resolver

## Revision identity

```text
SQL: catalog_revision
TypeScript: catalogRevision
Grammar: mboq-YYYY.MM.DD[.N]
```

## Not in this directory

- Production numeric rates
- Measured-BOQ persistence RPC
- Builder or reader cutover
