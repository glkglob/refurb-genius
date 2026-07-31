#!/usr/bin/env bash
# Genuine two-session concurrency probe for catalogue entry parent locks.
# Session A holds FOR SHARE on a draft parent via open entry INSERT transaction.
# Session B attempts to PUBLISH the same revision and must wait until A commits.
#
# Usage:
#   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
#     bash scripts/probe-measured-boq-catalogue-concurrency-4c2c.sh
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
REV="mboq-2099.05.01"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
BEGIN;
DELETE FROM public.measured_boq_catalog_entries WHERE catalog_revision = '${REV}';
DELETE FROM public.measured_boq_catalog_revisions WHERE catalog_revision = '${REV}';
INSERT INTO public.measured_boq_catalog_revisions (
  catalog_revision, status, schema_version, source_description, entry_count,
  content_checksum, effective_from, created_by
) VALUES (
  '${REV}', 'draft', 'mboq-catalogue-v1', 'SYNTHETIC concurrency probe', 0,
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  '2099-05-01', 'concurrency-probe'
);
COMMIT;
SQL

# Session A: lock parent via entry insert and sleep while holding the transaction
cat >"$WORKDIR/session_a.sql" <<SQL
BEGIN;
INSERT INTO public.measured_boq_catalog_entries (
  catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
) VALUES (
  '${REV}', 'synth.concurrency.m2', 'SYNTHETIC concurrency', 'test', 'm2', 'combined', 1
);
SELECT pg_sleep(3);
COMMIT;
SELECT 'session_a_done' AS marker;
SQL

# Session B: start shortly after A and time the publish update
cat >"$WORKDIR/session_b.sql" <<SQL
SELECT pg_sleep(0.5);
\\timing on
BEGIN;
UPDATE public.measured_boq_catalog_revisions
SET status = 'published', published_at = now()
WHERE catalog_revision = '${REV}';
COMMIT;
SELECT 'session_b_done' AS marker;
SQL

START_MS=$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)

psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$WORKDIR/session_a.sql" >"$WORKDIR/a.out" 2>&1 &
PID_A=$!
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$WORKDIR/session_b.sql" >"$WORKDIR/b.out" 2>&1 &
PID_B=$!

wait "$PID_A"
wait "$PID_B"

END_MS=$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)
ELAPSED=$((END_MS - START_MS))

echo "=== Session A ==="
cat "$WORKDIR/a.out"
echo "=== Session B ==="
cat "$WORKDIR/b.out"
echo "=== Elapsed ms: $ELAPSED ==="

# Publish must have waited for the ~3s sleep on session A (FOR SHARE blocks UPDATE)
if [ "$ELAPSED" -lt 2500 ]; then
  echo "FAIL: publish did not wait for concurrent entry mutation (elapsed ${ELAPSED}ms < 2500ms)"
  exit 1
fi

STATUS=$(psql "$DB_URL" -Atc "SELECT status FROM public.measured_boq_catalog_revisions WHERE catalog_revision = '${REV}'")
if [ "$STATUS" != "published" ]; then
  echo "FAIL: expected published status, got ${STATUS}"
  exit 1
fi

ENTRY_COUNT=$(psql "$DB_URL" -Atc "SELECT count(*) FROM public.measured_boq_catalog_entries WHERE catalog_revision = '${REV}'")
if [ "$ENTRY_COUNT" != "1" ]; then
  echo "FAIL: expected 1 entry after concurrent publish, got ${ENTRY_COUNT}"
  exit 1
fi

echo "PASS: two-session concurrency — publish waited for entry mutation (${ELAPSED}ms), final state consistent"
