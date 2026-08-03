-- 4C2E-B2D / B2D2R — persist_measured_boq_catalog_draft boundary tests
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(40);

-- ── grants ──────────────────────────────────────────────────────────
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.persist_measured_boq_catalog_draft(text,text,text,text,integer,text,text,text,jsonb,jsonb,uuid)',
    'execute'
  ),
  'service_role can execute persist RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.persist_measured_boq_catalog_draft(text,text,text,text,integer,text,text,text,jsonb,jsonb,uuid)',
    'execute'
  ),
  'anon cannot execute persist RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.persist_measured_boq_catalog_draft(text,text,text,text,integer,text,text,text,jsonb,jsonb,uuid)',
    'execute'
  ),
  'authenticated cannot execute persist RPC'
);

-- ── helpers: fixed B1-like package bytes ────────────────────────────
-- input checksum recomputed by SQL helper from these exact strings
\set manifest '{"manifestVersion":"1"}'
\set snapshot '{"schemaVersion":"1"}'

-- Precompute expected checksum via helper (owner path)
CREATE TEMP TABLE _b2d_ck AS
SELECT public.measured_boq_package_input_checksum(
  $m${"manifestVersion":"1","catalogRevision":"mboq-2099.02.01","source":{"id":"src","name":"S","version":"1","effectiveDate":"2099-02-01","licenceReference":"syn","licenceStatus":"synthetic"},"transformation":{"schemaVersion":"1","normaliserVersion":"1"},"package":{"snapshotPath":"snapshot.json","production":false}}$m$,
  $s${"schemaVersion":"1","catalogRevision":"mboq-2099.02.01","currency":"GBP","vatBasis":"exclusive","regionalBasis":"uk-region-multipliers-v1","effectiveFrom":"2099-02-01","sourceDescription":"SYNTHETIC TEST FIXTURE — not production","entryCount":1,"production":false,"entries":[{"rateKey":"paint.wall.m2","displayName":"Paint walls","description":null,"tradeOrDomain":"decor","unit":"m2","costType":"labour","baseUnitRate":12.5,"currency":"GBP","vatBasis":"exclusive","sourceReference":"synthetic","status":"active","replacementRateKey":null}]}$s$
) AS input_ck;

-- content checksum is server-owned; for DB test use a valid 64-hex placeholder matching insert path
-- The RPC trusts p_content_checksum after app validation; use a fixed digest for structural tests.
CREATE TEMP TABLE _b2d_payload AS
SELECT
  $m${"manifestVersion":"1","catalogRevision":"mboq-2099.02.01","source":{"id":"src","name":"S","version":"1","effectiveDate":"2099-02-01","licenceReference":"syn","licenceStatus":"synthetic"},"transformation":{"schemaVersion":"1","normaliserVersion":"1"},"package":{"snapshotPath":"snapshot.json","production":false}}$m$ AS manifest_text,
  $s${"schemaVersion":"1","catalogRevision":"mboq-2099.02.01","currency":"GBP","vatBasis":"exclusive","regionalBasis":"uk-region-multipliers-v1","effectiveFrom":"2099-02-01","sourceDescription":"SYNTHETIC TEST FIXTURE — not production","entryCount":1,"production":false,"entries":[{"rateKey":"paint.wall.m2","displayName":"Paint walls","description":null,"tradeOrDomain":"decor","unit":"m2","costType":"labour","baseUnitRate":12.5,"currency":"GBP","vatBasis":"exclusive","sourceReference":"synthetic","status":"active","replacementRateKey":null}]}$s$ AS snapshot_text,
  (SELECT input_ck FROM _b2d_ck) AS input_ck,
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'::text AS content_ck,
  $j$[{"rate_key":"paint.wall.m2","display_name":"Paint walls","description":null,"trade_or_domain":"decor","unit":"m2","cost_type":"labour","base_unit_rate":12.5,"currency":"GBP","vat_basis":"exclusive","source_reference":"synthetic","status":"active","replacement_rate_key":null}]$j$::jsonb AS entries,
  $r${"tool":"catalogue-persist","ok":true,"licenceStatus":"synthetic","production":false,"schemaVersion":"1","effectiveFrom":"2099-02-01","sourceDescription":"SYNTHETIC TEST FIXTURE — not production","createdBy":"persist_measured_boq_catalog_draft"}$r$::jsonb AS report;

-- ── create ──────────────────────────────────────────────────────────
SELECT is(
  (
    SELECT (public.persist_measured_boq_catalog_draft(
      p.manifest_text,
      p.snapshot_text,
      'mboq-2099.02.01',
      'src',
      1,
      '1',
      p.input_ck,
      p.content_ck,
      p.entries,
      p.report,
      '11111111-1111-1111-1111-111111111111'::uuid
    ) ->> 'outcome')
    FROM _b2d_payload p
  ),
  'created',
  'persist creates a new draft package'
);

SELECT is(
  (SELECT count(*)::int FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.02.01'),
  1,
  'one revision row created'
);

SELECT is(
  (SELECT count(*)::int FROM public.measured_boq_catalog_packages WHERE catalog_revision = 'mboq-2099.02.01'),
  1,
  'one package row created'
);

SELECT is(
  (SELECT count(*)::int FROM public.measured_boq_catalog_entries WHERE catalog_revision = 'mboq-2099.02.01'),
  1,
  'entries inserted'
);

SELECT is(
  (SELECT count(*)::int FROM public.measured_boq_catalog_events WHERE request_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'accepted event recorded'
);

SELECT is(
  (SELECT status FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.02.01'),
  'draft',
  'revision status is draft'
);

-- ── exact request replay ────────────────────────────────────────────
SELECT is(
  (
    SELECT (public.persist_measured_boq_catalog_draft(
      p.manifest_text,
      p.snapshot_text,
      'mboq-2099.02.01',
      'src',
      1,
      '1',
      p.input_ck,
      p.content_ck,
      p.entries,
      p.report,
      '11111111-1111-1111-1111-111111111111'::uuid
    ) ->> 'outcome')
    FROM _b2d_payload p
  ),
  'idempotent_replay',
  'exact request replay returns idempotent_replay'
);

SELECT is(
  (SELECT count(*)::int FROM public.measured_boq_catalog_packages WHERE catalog_revision = 'mboq-2099.02.01'),
  1,
  'exact replay creates no second package'
);

-- ── request conflict (same package bytes, different source_id) ──────
SELECT is(
  (
    SELECT (public.persist_measured_boq_catalog_draft(
      p.manifest_text,
      p.snapshot_text,
      'mboq-2099.02.01',
      'src-other',
      1,
      '1',
      p.input_ck,
      p.content_ck,
      p.entries,
      p.report,
      '11111111-1111-1111-1111-111111111111'::uuid
    ) ->> 'outcome')
    FROM _b2d_payload p
  ),
  'request_conflict',
  'same request_id with different payload is request_conflict'
);

-- ── B2D2R: sequential cross-package request conflict ────────────────
-- Same request ID, different revision label / source / raw artifacts /
-- input checksum. First creates; second must request_conflict with no
-- losing rows (not database_failure).
CREATE TEMP TABLE _b2d_payload_b AS
SELECT
  $m${"manifestVersion":"1","catalogRevision":"mboq-2099.02.99","source":{"id":"src-b","name":"S","version":"1","effectiveDate":"2099-02-01","licenceReference":"syn","licenceStatus":"synthetic"},"transformation":{"schemaVersion":"1","normaliserVersion":"1"},"package":{"snapshotPath":"snapshot.json","production":false}}$m$ AS manifest_text,
  $s${"schemaVersion":"1","catalogRevision":"mboq-2099.02.99","currency":"GBP","vatBasis":"exclusive","regionalBasis":"uk-region-multipliers-v1","effectiveFrom":"2099-02-01","sourceDescription":"SYNTHETIC TEST FIXTURE B — not production","entryCount":1,"production":false,"entries":[{"rateKey":"paint.ceil.m2","displayName":"Paint ceiling","description":null,"tradeOrDomain":"decor","unit":"m2","costType":"labour","baseUnitRate":14.0,"currency":"GBP","vatBasis":"exclusive","sourceReference":"synthetic","status":"active","replacementRateKey":null}]}$s$ AS snapshot_text,
  public.measured_boq_package_input_checksum(
    $m${"manifestVersion":"1","catalogRevision":"mboq-2099.02.99","source":{"id":"src-b","name":"S","version":"1","effectiveDate":"2099-02-01","licenceReference":"syn","licenceStatus":"synthetic"},"transformation":{"schemaVersion":"1","normaliserVersion":"1"},"package":{"snapshotPath":"snapshot.json","production":false}}$m$,
    $s${"schemaVersion":"1","catalogRevision":"mboq-2099.02.99","currency":"GBP","vatBasis":"exclusive","regionalBasis":"uk-region-multipliers-v1","effectiveFrom":"2099-02-01","sourceDescription":"SYNTHETIC TEST FIXTURE B — not production","entryCount":1,"production":false,"entries":[{"rateKey":"paint.ceil.m2","displayName":"Paint ceiling","description":null,"tradeOrDomain":"decor","unit":"m2","costType":"labour","baseUnitRate":14.0,"currency":"GBP","vatBasis":"exclusive","sourceReference":"synthetic","status":"active","replacementRateKey":null}]}$s$
  ) AS input_ck,
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'::text AS content_ck,
  $j$[{"rate_key":"paint.ceil.m2","display_name":"Paint ceiling","description":null,"trade_or_domain":"decor","unit":"m2","cost_type":"labour","base_unit_rate":14.0,"currency":"GBP","vat_basis":"exclusive","source_reference":"synthetic","status":"active","replacement_rate_key":null}]$j$::jsonb AS entries,
  $r${"tool":"catalogue-persist","ok":true,"licenceStatus":"synthetic","production":false,"schemaVersion":"1","effectiveFrom":"2099-02-01","sourceDescription":"SYNTHETIC TEST FIXTURE B — not production","createdBy":"persist_measured_boq_catalog_draft"}$r$::jsonb AS report;

SELECT ok(
  (SELECT input_ck FROM _b2d_payload) IS DISTINCT FROM (SELECT input_ck FROM _b2d_payload_b),
  'B2D2R cross-package fixtures use distinct input checksums'
);

SELECT is(
  (
    SELECT (public.persist_measured_boq_catalog_draft(
      b.manifest_text,
      b.snapshot_text,
      'mboq-2099.02.99',
      'src-b',
      1,
      '1',
      b.input_ck,
      b.content_ck,
      b.entries,
      b.report,
      '11111111-1111-1111-1111-111111111111'::uuid
    ) ->> 'outcome')
    FROM _b2d_payload_b b
  ),
  'request_conflict',
  'B2D2R sequential same request different package is request_conflict'
);

SELECT is(
  (SELECT count(*)::int FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.02.99'),
  0,
  'B2D2R losing cross-package request leaves no revision rows'
);

SELECT is(
  (SELECT count(*)::int FROM public.measured_boq_catalog_packages WHERE catalog_revision = 'mboq-2099.02.99'),
  0,
  'B2D2R losing cross-package request leaves no package rows'
);

SELECT is(
  (SELECT count(*)::int FROM public.measured_boq_catalog_entries WHERE catalog_revision = 'mboq-2099.02.99'),
  0,
  'B2D2R losing cross-package request leaves no entry rows'
);

SELECT is(
  (
    SELECT count(*)::int
    FROM public.measured_boq_catalog_events
    WHERE request_id = '11111111-1111-1111-1111-111111111111'
  ),
  1,
  'B2D2R request_conflict preserves exactly one accepted request event'
);

SELECT is(
  (SELECT count(*)::int FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.02.01'),
  1,
  'B2D2R winner revision remains exactly one'
);

-- ── package replay with new request id ──────────────────────────────
SELECT is(
  (
    SELECT (public.persist_measured_boq_catalog_draft(
      p.manifest_text,
      p.snapshot_text,
      'mboq-2099.02.01',
      'src',
      1,
      '1',
      p.input_ck,
      p.content_ck,
      p.entries,
      p.report,
      '22222222-2222-2222-2222-222222222222'::uuid
    ) ->> 'outcome')
    FROM _b2d_payload p
  ),
  'idempotent_replay',
  'same package new request_id is idempotent package replay'
);

SELECT is(
  (SELECT count(*)::int FROM public.measured_boq_catalog_events WHERE request_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'package replay records a new event'
);

SELECT is(
  (SELECT count(*)::int FROM public.measured_boq_catalog_packages),
  1,
  'package replay creates no additional package'
);

-- ── revision conflict (same label, different package bytes) ─────────
SELECT is(
  (
    SELECT (public.persist_measured_boq_catalog_draft(
      p.manifest_text || ' ',
      p.snapshot_text,
      'mboq-2099.02.01',
      'src',
      1,
      '1',
      public.measured_boq_package_input_checksum(p.manifest_text || ' ', p.snapshot_text),
      p.content_ck,
      p.entries,
      p.report,
      '33333333-3333-3333-3333-333333333333'::uuid
    ) ->> 'outcome')
    FROM _b2d_payload p
  ),
  'revision_conflict',
  'same catalog_revision with different package is revision_conflict'
);

-- ── production blocked ──────────────────────────────────────────────
SELECT is(
  (
    SELECT (public.persist_measured_boq_catalog_draft(
      p.manifest_text,
      p.snapshot_text,
      'mboq-2099.03.01',
      'src',
      1,
      '1',
      p.input_ck,
      p.content_ck,
      p.entries,
      jsonb_set(p.report, '{production}', 'true'::jsonb),
      '44444444-4444-4444-4444-444444444444'::uuid
    ) ->> 'outcome')
    FROM _b2d_payload p
  ),
  'production_blocked',
  'production true is rejected'
);

SELECT is(
  (SELECT count(*)::int FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.01'),
  0,
  'production_blocked persists nothing'
);

-- ── payload too large (entry count) ─────────────────────────────────
SELECT is(
  (
    SELECT (public.persist_measured_boq_catalog_draft(
      p.manifest_text,
      p.snapshot_text,
      'mboq-2099.04.01',
      'src',
      1,
      '1',
      p.input_ck,
      p.content_ck,
      '[]'::jsonb,
      p.report,
      '55555555-5555-5555-5555-555555555555'::uuid
    ) ->> 'outcome')
    FROM _b2d_payload p
  ),
  'invalid_persistence_command',
  'empty entries rejected'
);

-- ── service_role still cannot direct-insert tables ──────────────────
SET LOCAL ROLE service_role;
SELECT throws_ok(
  $$ insert into public.measured_boq_catalog_revisions (
       catalog_revision, status, schema_version, currency, vat_basis, regional_basis,
       source_description, entry_count, content_checksum, effective_from, created_by
     ) values (
       'mboq-2099.05.01', 'draft', '1', 'GBP', 'exclusive', 'uk-region-multipliers-v1',
       'x', 0, repeat('a',64), current_date, 'x'
     ) $$,
  '42501',
  NULL,
  'service_role still cannot insert revisions after B2D'
);
RESET ROLE;

-- ── table DML grants unchanged ──────────────────────────────────────
SELECT ok(
  has_table_privilege('service_role', 'public.measured_boq_catalog_packages', 'SELECT')
  AND NOT has_table_privilege('service_role', 'public.measured_boq_catalog_packages', 'INSERT')
  AND NOT has_table_privilege('service_role', 'public.measured_boq_catalog_packages', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'public.measured_boq_catalog_packages', 'DELETE'),
  'service_role remains SELECT-only on packages'
);

SELECT ok(
  has_table_privilege('service_role', 'public.measured_boq_catalog_events', 'SELECT')
  AND NOT has_table_privilege('service_role', 'public.measured_boq_catalog_events', 'INSERT'),
  'service_role remains SELECT-only on events'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.measured_boq_catalog_revisions', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.measured_boq_catalog_revisions', 'SELECT'),
  'JWT roles still have no catalogue table access'
);

-- ── B2D does not invent extra lifecycle command surfaces ────────────
-- B2E owns the three authorised lifecycle RPCs; B2D only adds persist.
SELECT ok(
  (
    SELECT count(*)::int
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname ~ 'measured_boq_catalog'
      AND p.proname ~ '(publish|retire|rollback|activate|republish|set_active)'
      AND p.proname NOT IN (
        'publish_measured_boq_catalog_revision',
        'retire_measured_boq_catalog_revision',
        'rollback_measured_boq_catalog_publication'
      )
  ) = 0,
  'no unauthorised lifecycle/activation RPCs beyond B2E trio'
);

-- ── checksum helper still private ───────────────────────────────────
SELECT ok(
  NOT has_function_privilege(
    'service_role',
    'public.measured_boq_package_input_checksum(text,text)',
    'execute'
  ),
  'checksum helper remains non-executable by service_role'
);

-- ── actor model on accepted event ───────────────────────────────────
SELECT is(
  (SELECT actor_kind FROM public.measured_boq_catalog_events WHERE request_id = '11111111-1111-1111-1111-111111111111'),
  'service_role',
  'accepted event actor_kind is service_role'
);

SELECT ok(
  (SELECT actor_user_id IS NULL FROM public.measured_boq_catalog_events WHERE request_id = '11111111-1111-1111-1111-111111111111'),
  'accepted event actor_user_id is null'
);

-- ── B2D2R: request lock presence, package lock, and ordering ────────
SELECT ok(
  (
    SELECT position(
      'measured-boq-persist-request:'
      IN pg_get_functiondef(
        'public.persist_measured_boq_catalog_draft(text,text,text,text,integer,text,text,text,jsonb,jsonb,uuid)'::regprocedure
      )
    ) > 0
  ),
  'persist RPC body contains request-identity advisory lock namespace'
);

SELECT ok(
  (
    SELECT position(
      'persist_draft'
      IN pg_get_functiondef(
        'public.persist_measured_boq_catalog_draft(text,text,text,text,integer,text,text,text,jsonb,jsonb,uuid)'::regprocedure
      )
    ) > 0
  ),
  'persist RPC lock material includes command scope persist_draft'
);

SELECT ok(
  (
    SELECT position(
      'pg_advisory_xact_lock'
      IN pg_get_functiondef(
        'public.persist_measured_boq_catalog_draft(text,text,text,text,integer,text,text,text,jsonb,jsonb,uuid)'::regprocedure
      )
    ) > 0
  ),
  'persist RPC uses transaction-scoped advisory locks'
);

SELECT ok(
  (
    WITH def AS (
      SELECT pg_get_functiondef(
        'public.persist_measured_boq_catalog_draft(text,text,text,text,integer,text,text,text,jsonb,jsonb,uuid)'::regprocedure
      ) AS body
    )
    SELECT
      -- Compare acquisition call sites only (v_lock_k1 also appears in DECLARE).
      position('measured-boq-persist-request:' IN body)
        < position('pg_advisory_xact_lock(v_lock_k1, v_lock_k2)' IN body)
      AND position('pg_advisory_xact_lock(v_lock_k1, v_lock_k2)' IN body)
        < position('FROM public.measured_boq_catalog_events e' IN body)
    FROM def
  ),
  'request lock precedes package lock and event lookup in function body'
);

-- ── B2D2R: signature, owner, SECURITY DEFINER, empty search_path ────
SELECT ok(
  (
    SELECT p.prosecdef
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'persist_measured_boq_catalog_draft'
  ),
  'persist RPC remains SECURITY DEFINER, postgres-owned, empty search_path'
);

SELECT is(
  (
    SELECT pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'persist_measured_boq_catalog_draft'
  ),
  'p_manifest_text text, p_snapshot_text text, p_catalog_revision text, p_source_id text, p_manifest_version integer, p_normaliser_version text, p_input_checksum text, p_content_checksum text, p_normalized_entries jsonb, p_validation_report jsonb, p_request_id uuid',
  'persist RPC public signature is unchanged'
);

SELECT * FROM finish();
ROLLBACK;
