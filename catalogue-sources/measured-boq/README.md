# Measured-BOQ catalogue sources (source-agnostic staging)

```text
Status: 4C2E-B1C dry-run tooling
Production rates: NOT APPROVED
Example package: SYNTHETIC only — not commercial data
```

## Purpose

This directory stages **source-agnostic** measured-BOQ catalogue revision packages
for the hybrid model:

1. Reviewed VCS package (`revisions/<catalogRevision>/`)
2. Pure dry-run validation (`pnpm catalogue:dry-run` → B1B pipeline)
3. Database publication (blocked until separately authorised)
4. Runtime reader activation (blocked until separately authorised)

B1 tooling is **dry-run only**. Rights metadata on a package is **non-authorising**.
It is not legal approval, production approval, or publication approval.

## Synthetic example

Exactly one example revision is committed:

```text
catalogue-sources/measured-boq/revisions/mboq-2099.01.01/
  MANIFEST.json
  snapshot.json
```

| Field | Value |
| --- | --- |
| `catalogRevision` | `mboq-2099.01.01` |
| `licenceStatus` | `synthetic` |
| `production` | `false` |
| Rates | Fictional / obviously artificial |
| Suppliers | None (source-neutral) |

Do not commit production or licensed commercial rates here without redistribution
rights and a separate product gate.

## Dry-run commands

Text (default):

```bash
pnpm catalogue:dry-run -- \
  --path catalogue-sources/measured-boq/revisions/mboq-2099.01.01
```

JSON (machine-readable):

Use `pnpm --silent` so package-manager banners are suppressed and **stdout is only
the JSON report** (one object, one trailing newline). Without `--silent`, pnpm may
print non-JSON lines before the report.

```bash
pnpm --silent catalogue:dry-run -- \
  --path catalogue-sources/measured-boq/revisions/mboq-2099.01.01 \
  --format json
```

Optional expected checksums (64 lowercase hex):

```bash
pnpm --silent catalogue:dry-run -- \
  --path catalogue-sources/measured-boq/revisions/mboq-2099.01.01 \
  --format json \
  --expected-input-checksum <sha256> \
  --expected-output-checksum <sha256>
```

`--strict` is accepted only as an explicit affirmation. Validation is **always**
strict; there is no relaxed mode and no `--no-strict`.

### Not implemented (and rejected if supplied)

```text
--mode --output --publish --upsert --retire --import --write --database
```

## Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | Valid dry run |
| 1 | Validation, normalisation, semantic, or policy failure |
| 2 | Invocation, path, filesystem, or malformed-JSON failure |
| 3 | Expected input/output checksum mismatch |
| 4 | Unsupported manifest/schema/normaliser version |
| 5 | Unexpected internal error |

Precedence: `5 > 4 > 3 > 2 > 1 > 0`.

## Stdout / stderr

- When a B1B report is produced, the full report is written to **stdout** (text or JSON)
  on both success and failure, with the mapped exit code.
- Invocation and filesystem diagnostics (before a report exists) go to **stderr**.
- Exactly one trailing newline; no colours, timestamps, absolute paths, secrets,
  environment identity, or database identity.

## Read-only design

The CLI reads package artifacts under the selected revision directory only:

- the revision path is resolved to its **real filesystem root** (`realpath`);
- `MANIFEST.json` and the manifest-declared snapshot are resolved with
  `realpath` and must remain **strictly inside** that real root before content
  is read (symlink escapes to external targets are rejected);
- package-internal symlinks are accepted only when their final real target stays
  inside the real revision root.

The CLI does **not**:

- write report files or mutate the package;
- open Supabase / service-role connections;
- perform network access;
- publish, upsert, retire, or import into the database.

## Still blocked outside B1C

- Production or licensed catalogue data
- Source-specific adapters / scraping
- Migrations and database writes
- Publication or retirement tooling
- Runtime catalogue reader activation
- Estimate-builder integration
- 4C2F

**B2** (importer / publisher) requires separate authorisation and a separate entry point.

## Revision identity

```text
SQL: catalog_revision
TypeScript / package: catalogRevision
Grammar: mboq-YYYY.MM.DD[.N]
```
