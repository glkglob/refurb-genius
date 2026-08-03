-- 4C2E-B2E — publish / retire / rollback-retire lifecycle RPC boundary tests
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(62);

-- ── function contracts ──────────────────────────────────────────────
SELECT has_function(
  'public',
  'publish_measured_boq_catalog_revision',
  ARRAY['uuid', 'text', 'uuid'],
  'publish RPC exists with exact signature'
);

SELECT has_function(
  'public',
  'retire_measured_boq_catalog_revision',
  ARRAY['uuid', 'text', 'text', 'uuid'],
  'retire RPC exists with exact signature'
);

SELECT has_function(
  'public',
  'rollback_measured_boq_catalog_publication',
  ARRAY['uuid', 'uuid', 'text', 'text', 'uuid'],
  'rollback RPC exists with exact signature'
);

SELECT ok(
  (
    SELECT p.prosecdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'publish_measured_boq_catalog_revision'
  ),
  'publish is SECURITY DEFINER'
);

SELECT ok(
  (
    SELECT COALESCE(pg_catalog.array_to_string(p.proconfig, ','), '') LIKE '%search_path=%'
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'publish_measured_boq_catalog_revision'
  ),
  'publish sets search_path'
);

SELECT is(
  (
    SELECT pg_catalog.pg_get_userbyid(p.proowner)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'publish_measured_boq_catalog_revision'
  ),
  'postgres',
  'publish owned by postgres'
);

SELECT is(
  (
    SELECT pg_catalog.pg_get_userbyid(p.proowner)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'retire_measured_boq_catalog_revision'
  ),
  'postgres',
  'retire owned by postgres'
);

SELECT is(
  (
    SELECT pg_catalog.pg_get_userbyid(p.proowner)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rollback_measured_boq_catalog_publication'
  ),
  'postgres',
  'rollback owned by postgres'
);

-- ── grants ──────────────────────────────────────────────────────────
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.publish_measured_boq_catalog_revision(uuid,text,uuid)',
    'execute'
  )
  AND has_function_privilege(
    'service_role',
    'public.retire_measured_boq_catalog_revision(uuid,text,text,uuid)',
    'execute'
  )
  AND has_function_privilege(
    'service_role',
    'public.rollback_measured_boq_catalog_publication(uuid,uuid,text,text,uuid)',
    'execute'
  ),
  'service_role can execute all three lifecycle RPCs'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.publish_measured_boq_catalog_revision(uuid,text,uuid)',
    'execute'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.publish_measured_boq_catalog_revision(uuid,text,uuid)',
    'execute'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.retire_measured_boq_catalog_revision(uuid,text,text,uuid)',
    'execute'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.retire_measured_boq_catalog_revision(uuid,text,text,uuid)',
    'execute'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.rollback_measured_boq_catalog_publication(uuid,uuid,text,text,uuid)',
    'execute'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.rollback_measured_boq_catalog_publication(uuid,uuid,text,text,uuid)',
    'execute'
  ),
  'JWT roles cannot execute lifecycle RPCs'
);

SELECT ok(
  NOT has_table_privilege('service_role', 'public.measured_boq_catalog_revisions', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'public.measured_boq_catalog_revisions', 'INSERT')
  AND NOT has_table_privilege('service_role', 'public.measured_boq_catalog_events', 'INSERT'),
  'service_role remains without direct lifecycle table DML'
);

-- ── fixtures via B2D persist ────────────────────────────────────────
CREATE TEMP TABLE _b2e_ck AS
SELECT public.measured_boq_package_input_checksum(
  $m${"manifestVersion":"1","catalogRevision":"mboq-2099.03.01","source":{"id":"src-a","name":"S","version":"1","effectiveDate":"2099-03-01","licenceReference":"syn","licenceStatus":"synthetic"},"transformation":{"schemaVersion":"1","normaliserVersion":"1"},"package":{"snapshotPath":"snapshot.json","production":false}}$m$,
  $s${"schemaVersion":"1","catalogRevision":"mboq-2099.03.01","currency":"GBP","vatBasis":"exclusive","regionalBasis":"uk-region-multipliers-v1","effectiveFrom":"2099-03-01","sourceDescription":"SYNTHETIC B2E FIXTURE A","entryCount":1,"production":false,"entries":[{"rateKey":"paint.wall.m2","displayName":"Paint walls","description":null,"tradeOrDomain":"decor","unit":"m2","costType":"labour","baseUnitRate":12.5,"currency":"GBP","vatBasis":"exclusive","sourceReference":"synthetic","status":"active","replacementRateKey":null}]}$s$
) AS input_ck;

CREATE TEMP TABLE _b2e_payload AS
SELECT
  $m${"manifestVersion":"1","catalogRevision":"mboq-2099.03.01","source":{"id":"src-a","name":"S","version":"1","effectiveDate":"2099-03-01","licenceReference":"syn","licenceStatus":"synthetic"},"transformation":{"schemaVersion":"1","normaliserVersion":"1"},"package":{"snapshotPath":"snapshot.json","production":false}}$m$ AS manifest_a,
  $s${"schemaVersion":"1","catalogRevision":"mboq-2099.03.01","currency":"GBP","vatBasis":"exclusive","regionalBasis":"uk-region-multipliers-v1","effectiveFrom":"2099-03-01","sourceDescription":"SYNTHETIC B2E FIXTURE A","entryCount":1,"production":false,"entries":[{"rateKey":"paint.wall.m2","displayName":"Paint walls","description":null,"tradeOrDomain":"decor","unit":"m2","costType":"labour","baseUnitRate":12.5,"currency":"GBP","vatBasis":"exclusive","sourceReference":"synthetic","status":"active","replacementRateKey":null}]}$s$ AS snapshot_a,
  $m${"manifestVersion":"1","catalogRevision":"mboq-2099.03.02","source":{"id":"src-b","name":"S","version":"1","effectiveDate":"2099-03-02","licenceReference":"syn","licenceStatus":"synthetic"},"transformation":{"schemaVersion":"1","normaliserVersion":"1"},"package":{"snapshotPath":"snapshot.json","production":false}}$m$ AS manifest_b,
  $s${"schemaVersion":"1","catalogRevision":"mboq-2099.03.02","currency":"GBP","vatBasis":"exclusive","regionalBasis":"uk-region-multipliers-v1","effectiveFrom":"2099-03-02","sourceDescription":"SYNTHETIC B2E FIXTURE B","entryCount":1,"production":false,"entries":[{"rateKey":"paint.wall.m2","displayName":"Paint walls","description":null,"tradeOrDomain":"decor","unit":"m2","costType":"labour","baseUnitRate":13.5,"currency":"GBP","vatBasis":"exclusive","sourceReference":"synthetic","status":"active","replacementRateKey":null}]}$s$ AS snapshot_b,
  $m${"manifestVersion":"1","catalogRevision":"mboq-2099.03.03","source":{"id":"src-ru","name":"S","version":"1","effectiveDate":"2099-03-03","licenceReference":"ru","licenceStatus":"rights_unverified"},"transformation":{"schemaVersion":"1","normaliserVersion":"1"},"package":{"snapshotPath":"snapshot.json","production":false}}$m$ AS manifest_ru,
  $s${"schemaVersion":"1","catalogRevision":"mboq-2099.03.03","currency":"GBP","vatBasis":"exclusive","regionalBasis":"uk-region-multipliers-v1","effectiveFrom":"2099-03-03","sourceDescription":"RIGHTS UNVERIFIED B2E FIXTURE","entryCount":1,"production":false,"entries":[{"rateKey":"paint.wall.m2","displayName":"Paint walls","description":null,"tradeOrDomain":"decor","unit":"m2","costType":"labour","baseUnitRate":14.5,"currency":"GBP","vatBasis":"exclusive","sourceReference":"ru","status":"active","replacementRateKey":null}]}$s$ AS snapshot_ru,
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'::text AS content_ck,
  $j$[{"rate_key":"paint.wall.m2","display_name":"Paint walls","description":null,"trade_or_domain":"decor","unit":"m2","cost_type":"labour","base_unit_rate":12.5,"currency":"GBP","vat_basis":"exclusive","source_reference":"synthetic","status":"active","replacement_rate_key":null}]$j$::jsonb AS entries_a,
  $j$[{"rate_key":"paint.wall.m2","display_name":"Paint walls","description":null,"trade_or_domain":"decor","unit":"m2","cost_type":"labour","base_unit_rate":13.5,"currency":"GBP","vat_basis":"exclusive","source_reference":"synthetic","status":"active","replacement_rate_key":null}]$j$::jsonb AS entries_b,
  $j$[{"rate_key":"paint.wall.m2","display_name":"Paint walls","description":null,"trade_or_domain":"decor","unit":"m2","cost_type":"labour","base_unit_rate":14.5,"currency":"GBP","vat_basis":"exclusive","source_reference":"ru","status":"active","replacement_rate_key":null}]$j$::jsonb AS entries_ru,
  $r${"tool":"catalogue-persist","ok":true,"licenceStatus":"synthetic","production":false,"schemaVersion":"1","effectiveFrom":"2099-03-01","sourceDescription":"SYNTHETIC B2E FIXTURE A","createdBy":"persist_measured_boq_catalog_draft"}$r$::jsonb AS report_a,
  $r${"tool":"catalogue-persist","ok":true,"licenceStatus":"synthetic","production":false,"schemaVersion":"1","effectiveFrom":"2099-03-02","sourceDescription":"SYNTHETIC B2E FIXTURE B","createdBy":"persist_measured_boq_catalog_draft"}$r$::jsonb AS report_b,
  $r${"tool":"catalogue-persist","ok":true,"licenceStatus":"rights_unverified","production":false,"schemaVersion":"1","effectiveFrom":"2099-03-03","sourceDescription":"RIGHTS UNVERIFIED B2E FIXTURE","createdBy":"persist_measured_boq_catalog_draft"}$r$::jsonb AS report_ru;

-- create synthetic draft A
SELECT is(
  (
    SELECT (public.persist_measured_boq_catalog_draft(
      p.manifest_a, p.snapshot_a, 'mboq-2099.03.01', 'src-a', 1, '1',
      public.measured_boq_package_input_checksum(p.manifest_a, p.snapshot_a),
      p.content_ck, p.entries_a, p.report_a,
      'a1111111-1111-4111-8111-111111111111'::uuid
    ) ->> 'outcome')
    FROM _b2e_payload p
  ),
  'created',
  'fixture A draft created'
);

-- create synthetic draft B (prior for rollback)
SELECT is(
  (
    SELECT (public.persist_measured_boq_catalog_draft(
      p.manifest_b, p.snapshot_b, 'mboq-2099.03.02', 'src-b', 1, '1',
      public.measured_boq_package_input_checksum(p.manifest_b, p.snapshot_b),
      p.content_ck, p.entries_b, p.report_b,
      'a1111111-1111-4111-8111-111111111112'::uuid
    ) ->> 'outcome')
    FROM _b2e_payload p
  ),
  'created',
  'fixture B draft created'
);

-- rights_unverified draft
SELECT is(
  (
    SELECT (public.persist_measured_boq_catalog_draft(
      p.manifest_ru, p.snapshot_ru, 'mboq-2099.03.03', 'src-ru', 1, '1',
      public.measured_boq_package_input_checksum(p.manifest_ru, p.snapshot_ru),
      p.content_ck, p.entries_ru, p.report_ru,
      'a1111111-1111-4111-8111-111111111113'::uuid
    ) ->> 'outcome')
    FROM _b2e_payload p
  ),
  'created',
  'fixture rights_unverified draft created'
);

CREATE TEMP TABLE _b2e_ids AS
SELECT
  (SELECT id FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.01') AS rev_a,
  (SELECT id FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.02') AS rev_b,
  (SELECT id FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.03') AS rev_ru,
  (SELECT content_checksum FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.01') AS content_a,
  (SELECT input_checksum FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.01') AS input_a;

-- ── publish synthetic ───────────────────────────────────────────────
SELECT is(
  (
    SELECT (public.publish_measured_boq_catalog_revision(
      i.rev_a, 'draft', 'b1111111-1111-4111-8111-111111111111'::uuid
    ) ->> 'outcome')
    FROM _b2e_ids i
  ),
  'published',
  'synthetic draft publishes'
);

SELECT is(
  (SELECT status FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.01'),
  'published',
  'revision A status is published'
);

SELECT is(
  (SELECT published_by_kind FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.01'),
  'service_role',
  'published_by_kind is service_role'
);

SELECT ok(
  (SELECT published_at IS NOT NULL AND published_by_id IS NULL
   FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.01'),
  'published_at set and published_by_id null'
);

SELECT is(
  (SELECT content_checksum FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.01'),
  (SELECT content_a FROM _b2e_ids),
  'content checksum unchanged after publish'
);

SELECT is(
  (
    SELECT count(*)::int FROM public.measured_boq_catalog_events
    WHERE request_id = 'b1111111-1111-4111-8111-111111111111'
      AND event_type = 'publication'
      AND result = 'published'
  ),
  1,
  'one publication event recorded'
);

-- exact publish replay
SELECT is(
  (
    SELECT (public.publish_measured_boq_catalog_revision(
      i.rev_a, 'draft', 'b1111111-1111-4111-8111-111111111111'::uuid
    ) ->> 'outcome')
    FROM _b2e_ids i
  ),
  'idempotent_replay',
  'exact publish request replay is idempotent'
);

SELECT is(
  (
    SELECT count(*)::int FROM public.measured_boq_catalog_events
    WHERE request_id = 'b1111111-1111-4111-8111-111111111111'
  ),
  1,
  'exact publish replay inserts no duplicate event'
);

-- already_published with new request
SELECT is(
  (
    SELECT (public.publish_measured_boq_catalog_revision(
      i.rev_a, 'draft', 'b1111111-1111-4111-8111-111111111112'::uuid
    ) ->> 'outcome')
    FROM _b2e_ids i
  ),
  'already_published',
  'new request against published returns already_published'
);

-- request conflict (same request id, different revision)
SELECT is(
  (
    SELECT (public.publish_measured_boq_catalog_revision(
      i.rev_b, 'draft', 'b1111111-1111-4111-8111-111111111111'::uuid
    ) ->> 'outcome')
    FROM _b2e_ids i
  ),
  'request_conflict',
  'publish request conflict when identity differs'
);

-- rights_unverified denied
SELECT is(
  (
    SELECT (public.publish_measured_boq_catalog_revision(
      i.rev_ru, 'draft', 'b1111111-1111-4111-8111-111111111113'::uuid
    ) ->> 'outcome')
    FROM _b2e_ids i
  ),
  'rights_not_publishable',
  'rights_unverified cannot publish'
);

SELECT is(
  (SELECT status FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.03'),
  'draft',
  'rights_unverified remains draft'
);

SELECT is(
  (
    SELECT count(*)::int FROM public.measured_boq_catalog_events
    WHERE request_id = 'b1111111-1111-4111-8111-111111111113'
  ),
  0,
  'rights denial creates no lifecycle event'
);

-- revision_not_found
SELECT is(
  (
    SELECT public.publish_measured_boq_catalog_revision(
      'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,
      'draft',
      'b1111111-1111-4111-8111-111111111114'::uuid
    ) ->> 'outcome'
  ),
  'revision_not_found',
  'missing revision returns revision_not_found'
);

-- stale_status (wrong expected)
SELECT is(
  (
    SELECT (public.publish_measured_boq_catalog_revision(
      i.rev_b, 'published', 'b1111111-1111-4111-8111-111111111115'::uuid
    ) ->> 'outcome')
    FROM _b2e_ids i
  ),
  'stale_status',
  'publish with wrong expected status is stale_status'
);

-- production policy (manual production flag on draft B before publish)
-- Use a temporary direct owner path only for constructing a production row state.
SELECT set_config('app.measured_boq_catalog_lifecycle_command', '', true);
-- production flag is content-immutable after insert; insert a dedicated production fixture via
-- SECURITY DEFINER path is not available, so mutate only through replica role for this probe.
SET session_replication_role = replica;
UPDATE public.measured_boq_catalog_revisions
SET production = true
WHERE catalog_revision = 'mboq-2099.03.03';
UPDATE public.measured_boq_catalog_packages
SET production = true
WHERE catalog_revision = 'mboq-2099.03.03';
SET session_replication_role = DEFAULT;

SELECT is(
  (
    SELECT (public.publish_measured_boq_catalog_revision(
      i.rev_ru, 'draft', 'b1111111-1111-4111-8111-111111111116'::uuid
    ) ->> 'outcome')
    FROM _b2e_ids i
  ),
  'production_policy_rejected',
  'production row is production_policy_rejected'
);

-- restore rights_unverified non-production for isolation
SET session_replication_role = replica;
UPDATE public.measured_boq_catalog_revisions
SET production = false
WHERE catalog_revision = 'mboq-2099.03.03';
UPDATE public.measured_boq_catalog_packages
SET production = false
WHERE catalog_revision = 'mboq-2099.03.03';
SET session_replication_role = DEFAULT;

-- provenance_required (legacy-style revision without package)
INSERT INTO public.measured_boq_catalog_revisions (
  catalog_revision, status, schema_version, currency, vat_basis, regional_basis,
  source_description, entry_count, content_checksum, effective_from, created_by
) VALUES (
  'mboq-2099.03.28', 'draft', '1', 'GBP', 'exclusive', 'uk-region-multipliers-v1',
  'LEGACY NO PACKAGE', 0,
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  '2099-03-28'::date, 'legacy-test'
);

SELECT is(
  (
    SELECT public.publish_measured_boq_catalog_revision(
      (SELECT id FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.28'),
      'draft',
      'b1111111-1111-4111-8111-111111111117'::uuid
    ) ->> 'outcome'
  ),
  'provenance_required',
  'legacy row without package returns provenance_required'
);

-- ── publish B for rollback prior ────────────────────────────────────
SELECT is(
  (
    SELECT (public.publish_measured_boq_catalog_revision(
      i.rev_b, 'draft', 'b1111111-1111-4111-8111-111111111118'::uuid
    ) ->> 'outcome')
    FROM _b2e_ids i
  ),
  'published',
  'fixture B publishes as prior'
);

-- ── retire A ────────────────────────────────────────────────────────
SELECT is(
  (
    SELECT (public.retire_measured_boq_catalog_revision(
      i.rev_a, 'published', 'superseded by B', 'c1111111-1111-4111-8111-111111111111'::uuid
    ) ->> 'outcome')
    FROM _b2e_ids i
  ),
  'retired',
  'published A retires with reason'
);

SELECT is(
  (SELECT status FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.01'),
  'retired',
  'A status is retired'
);

SELECT is(
  (SELECT retirement_reason FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.01'),
  'superseded by B',
  'retirement_reason stored'
);

SELECT is(
  (SELECT published_by_kind FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.01'),
  'service_role',
  'publication attribution frozen on retire'
);

SELECT is(
  (
    SELECT (public.retire_measured_boq_catalog_revision(
      i.rev_a, 'published', 'superseded by B', 'c1111111-1111-4111-8111-111111111111'::uuid
    ) ->> 'outcome')
    FROM _b2e_ids i
  ),
  'idempotent_replay',
  'exact retire request replay is idempotent'
);

SELECT is(
  (
    SELECT (public.retire_measured_boq_catalog_revision(
      i.rev_a, 'published', 'different reason', 'c1111111-1111-4111-8111-111111111111'::uuid
    ) ->> 'outcome')
    FROM _b2e_ids i
  ),
  'request_conflict',
  'retire request conflict on different reason'
);

SELECT is(
  (
    SELECT (public.retire_measured_boq_catalog_revision(
      i.rev_a, 'published', 'already gone', 'c1111111-1111-4111-8111-111111111112'::uuid
    ) ->> 'outcome')
    FROM _b2e_ids i
  ),
  'already_retired',
  'new request on retired returns already_retired'
);

SELECT is(
  (
    SELECT (public.retire_measured_boq_catalog_revision(
      i.rev_b, 'draft', 'bad expected', 'c1111111-1111-4111-8111-111111111113'::uuid
    ) ->> 'outcome')
    FROM _b2e_ids i
  ),
  'stale_status',
  'retire with wrong expected status is stale_status'
);

SELECT is(
  (
    SELECT public.retire_measured_boq_catalog_revision(
      i.rev_b, 'published', '', 'c1111111-1111-4111-8111-111111111114'::uuid
    ) ->> 'outcome'
    FROM _b2e_ids i
  ),
  'database_failure',
  'empty retire reason rejected'
);

-- ── recreate publishable target for rollback (new draft C + publish) ─
SELECT is(
  (
    SELECT (public.persist_measured_boq_catalog_draft(
      $m${"manifestVersion":"1","catalogRevision":"mboq-2099.03.04","source":{"id":"src-c","name":"S","version":"1","effectiveDate":"2099-03-04","licenceReference":"syn","licenceStatus":"synthetic"},"transformation":{"schemaVersion":"1","normaliserVersion":"1"},"package":{"snapshotPath":"snapshot.json","production":false}}$m$,
      $s${"schemaVersion":"1","catalogRevision":"mboq-2099.03.04","currency":"GBP","vatBasis":"exclusive","regionalBasis":"uk-region-multipliers-v1","effectiveFrom":"2099-03-04","sourceDescription":"SYNTHETIC B2E FIXTURE C","entryCount":1,"production":false,"entries":[{"rateKey":"paint.wall.m2","displayName":"Paint walls","description":null,"tradeOrDomain":"decor","unit":"m2","costType":"labour","baseUnitRate":15.5,"currency":"GBP","vatBasis":"exclusive","sourceReference":"synthetic","status":"active","replacementRateKey":null}]}$s$,
      'mboq-2099.03.04', 'src-c', 1, '1',
      public.measured_boq_package_input_checksum(
        $m${"manifestVersion":"1","catalogRevision":"mboq-2099.03.04","source":{"id":"src-c","name":"S","version":"1","effectiveDate":"2099-03-04","licenceReference":"syn","licenceStatus":"synthetic"},"transformation":{"schemaVersion":"1","normaliserVersion":"1"},"package":{"snapshotPath":"snapshot.json","production":false}}$m$,
        $s${"schemaVersion":"1","catalogRevision":"mboq-2099.03.04","currency":"GBP","vatBasis":"exclusive","regionalBasis":"uk-region-multipliers-v1","effectiveFrom":"2099-03-04","sourceDescription":"SYNTHETIC B2E FIXTURE C","entryCount":1,"production":false,"entries":[{"rateKey":"paint.wall.m2","displayName":"Paint walls","description":null,"tradeOrDomain":"decor","unit":"m2","costType":"labour","baseUnitRate":15.5,"currency":"GBP","vatBasis":"exclusive","sourceReference":"synthetic","status":"active","replacementRateKey":null}]}$s$
      ),
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      $j$[{"rate_key":"paint.wall.m2","display_name":"Paint walls","description":null,"trade_or_domain":"decor","unit":"m2","cost_type":"labour","base_unit_rate":15.5,"currency":"GBP","vat_basis":"exclusive","source_reference":"synthetic","status":"active","replacement_rate_key":null}]$j$::jsonb,
      $r${"tool":"catalogue-persist","ok":true,"licenceStatus":"synthetic","production":false,"schemaVersion":"1","effectiveFrom":"2099-03-04","sourceDescription":"SYNTHETIC B2E FIXTURE C","createdBy":"persist_measured_boq_catalog_draft"}$r$::jsonb,
      'a1111111-1111-4111-8111-111111111114'::uuid
    ) ->> 'outcome')
  ),
  'created',
  'fixture C draft created for rollback target'
);

CREATE TEMP TABLE _b2e_ids2 AS
SELECT
  (SELECT id FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.04') AS rev_c,
  (SELECT id FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.02') AS rev_b,
  (SELECT to_jsonb(r.*) FROM public.measured_boq_catalog_revisions r WHERE catalog_revision = 'mboq-2099.03.02') AS prior_json_before;

SELECT is(
  (
    SELECT public.publish_measured_boq_catalog_revision(
      i.rev_c, 'draft', 'b1111111-1111-4111-8111-111111111119'::uuid
    ) ->> 'outcome'
    FROM _b2e_ids2 i
  ),
  'published',
  'fixture C publishes as rollback target'
);

-- capture prior fingerprint after both published
UPDATE _b2e_ids2 SET prior_json_before = (
  SELECT to_jsonb(r.*) FROM public.measured_boq_catalog_revisions r WHERE catalog_revision = 'mboq-2099.03.02'
);

SELECT is(
  (
    SELECT public.rollback_measured_boq_catalog_publication(
      i.rev_c, i.rev_b, 'published', 'erroneous C', 'd1111111-1111-4111-8111-111111111111'::uuid
    ) ->> 'outcome'
    FROM _b2e_ids2 i
  ),
  'rollback_recorded',
  'rollback retires target C'
);

SELECT is(
  (SELECT status FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.04'),
  'retired',
  'rollback target C is retired'
);

SELECT is(
  (SELECT status FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.02'),
  'published',
  'prior B remains published'
);

SELECT ok(
  (
    SELECT to_jsonb(r.*) = (SELECT prior_json_before FROM _b2e_ids2)
    FROM public.measured_boq_catalog_revisions r
    WHERE catalog_revision = 'mboq-2099.03.02'
  ),
  'prior revision is byte-for-byte unchanged after rollback'
);

SELECT is(
  (
    SELECT prior_revision_id::text
    FROM public.measured_boq_catalog_events
    WHERE request_id = 'd1111111-1111-4111-8111-111111111111'
  ),
  (SELECT rev_b::text FROM _b2e_ids2),
  'rollback event records prior_revision_id'
);

SELECT is(
  (
    SELECT public.rollback_measured_boq_catalog_publication(
      i.rev_c, i.rev_b, 'published', 'erroneous C', 'd1111111-1111-4111-8111-111111111111'::uuid
    ) ->> 'outcome'
    FROM _b2e_ids2 i
  ),
  'idempotent_replay',
  'exact rollback request replay is idempotent'
);

SELECT is(
  (
    SELECT public.rollback_measured_boq_catalog_publication(
      i.rev_c, i.rev_b, 'published', 'different reason', 'd1111111-1111-4111-8111-111111111111'::uuid
    ) ->> 'outcome'
    FROM _b2e_ids2 i
  ),
  'request_conflict',
  'rollback request conflict on different reason'
);

SELECT is(
  (
    SELECT public.rollback_measured_boq_catalog_publication(
      i.rev_c, i.rev_c, 'published', 'same ids', 'd1111111-1111-4111-8111-111111111112'::uuid
    ) ->> 'outcome'
    FROM _b2e_ids2 i
  ),
  'database_failure',
  'rollback requires distinct target and prior'
);

-- reverse argument order still retires only target (use fresh pair)
SELECT is(
  (
    SELECT (public.persist_measured_boq_catalog_draft(
      $m${"manifestVersion":"1","catalogRevision":"mboq-2099.03.05","source":{"id":"src-d","name":"S","version":"1","effectiveDate":"2099-03-05","licenceReference":"syn","licenceStatus":"synthetic"},"transformation":{"schemaVersion":"1","normaliserVersion":"1"},"package":{"snapshotPath":"snapshot.json","production":false}}$m$,
      $s${"schemaVersion":"1","catalogRevision":"mboq-2099.03.05","currency":"GBP","vatBasis":"exclusive","regionalBasis":"uk-region-multipliers-v1","effectiveFrom":"2099-03-05","sourceDescription":"SYNTHETIC B2E FIXTURE D","entryCount":1,"production":false,"entries":[{"rateKey":"paint.wall.m2","displayName":"Paint walls","description":null,"tradeOrDomain":"decor","unit":"m2","costType":"labour","baseUnitRate":16.5,"currency":"GBP","vatBasis":"exclusive","sourceReference":"synthetic","status":"active","replacementRateKey":null}]}$s$,
      'mboq-2099.03.05', 'src-d', 1, '1',
      public.measured_boq_package_input_checksum(
        $m${"manifestVersion":"1","catalogRevision":"mboq-2099.03.05","source":{"id":"src-d","name":"S","version":"1","effectiveDate":"2099-03-05","licenceReference":"syn","licenceStatus":"synthetic"},"transformation":{"schemaVersion":"1","normaliserVersion":"1"},"package":{"snapshotPath":"snapshot.json","production":false}}$m$,
        $s${"schemaVersion":"1","catalogRevision":"mboq-2099.03.05","currency":"GBP","vatBasis":"exclusive","regionalBasis":"uk-region-multipliers-v1","effectiveFrom":"2099-03-05","sourceDescription":"SYNTHETIC B2E FIXTURE D","entryCount":1,"production":false,"entries":[{"rateKey":"paint.wall.m2","displayName":"Paint walls","description":null,"tradeOrDomain":"decor","unit":"m2","costType":"labour","baseUnitRate":16.5,"currency":"GBP","vatBasis":"exclusive","sourceReference":"synthetic","status":"active","replacementRateKey":null}]}$s$
      ),
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      $j$[{"rate_key":"paint.wall.m2","display_name":"Paint walls","description":null,"trade_or_domain":"decor","unit":"m2","cost_type":"labour","base_unit_rate":16.5,"currency":"GBP","vat_basis":"exclusive","source_reference":"synthetic","status":"active","replacement_rate_key":null}]$j$::jsonb,
      $r${"tool":"catalogue-persist","ok":true,"licenceStatus":"synthetic","production":false,"schemaVersion":"1","effectiveFrom":"2099-03-05","sourceDescription":"SYNTHETIC B2E FIXTURE D","createdBy":"persist_measured_boq_catalog_draft"}$r$::jsonb,
      'a1111111-1111-4111-8111-111111111115'::uuid
    ) ->> 'outcome')
  ),
  'created',
  'fixture D draft created'
);

SELECT is(
  (
    SELECT public.publish_measured_boq_catalog_revision(
      (SELECT id FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.05'),
      'draft',
      'b1111111-1111-4111-8111-11111111111a'::uuid
    ) ->> 'outcome'
  ),
  'published',
  'fixture D publishes'
);

-- D as target, B as prior; call with whatever UUID order — still retires D only
SELECT is(
  (
    SELECT public.rollback_measured_boq_catalog_publication(
      (SELECT id FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.05'),
      (SELECT id FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.02'),
      'published',
      'rollback D',
      'd1111111-1111-4111-8111-111111111113'::uuid
    ) ->> 'outcome'
  ),
  'rollback_recorded',
  'rollback D succeeds'
);

SELECT is(
  (SELECT status FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.05'),
  'retired',
  'D retired'
);

SELECT is(
  (SELECT status FROM public.measured_boq_catalog_revisions WHERE catalog_revision = 'mboq-2099.03.02'),
  'published',
  'B still published after second rollback'
);

-- ── direct DML / GUC spoof still fail for service_role ──────────────
SELECT throws_ok(
  $$
    SET LOCAL ROLE service_role;
    UPDATE public.measured_boq_catalog_revisions
    SET status = 'published', published_at = now()
    WHERE catalog_revision = 'mboq-2099.03.03';
  $$,
  '42501',
  NULL,
  'service_role cannot direct-update status without privilege'
);

-- events append-only
SELECT throws_ok(
  $$
    UPDATE public.measured_boq_catalog_events
    SET result = 'tampered'
    WHERE request_id = 'b1111111-1111-4111-8111-111111111111';
  $$,
  'P0001',
  NULL,
  'events remain append-only'
);

-- phase exclusions
SELECT is(
  (
    SELECT count(*)::int
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'republish_as_new_revision',
        'set_active_measured_boq_catalog_revision',
        'activate_measured_boq_catalog_revision'
      )
  ),
  0,
  'no republish or active-pointer RPCs'
);

SELECT is(
  (
    SELECT count(*)::int
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name LIKE 'measured_boq_catalog_%'
      AND column_name IN ('active', 'is_active', 'active_revision', 'is_current')
  ),
  0,
  'no active-pointer columns'
);

-- exactly three public lifecycle command RPCs
SELECT is(
  (
    SELECT count(*)::int
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'publish_measured_boq_catalog_revision',
        'retire_measured_boq_catalog_revision',
        'rollback_measured_boq_catalog_publication'
      )
  ),
  3,
  'exactly three lifecycle RPCs'
);

-- table grants unchanged
SELECT ok(
  has_table_privilege('service_role', 'public.measured_boq_catalog_revisions', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.measured_boq_catalog_revisions', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.measured_boq_catalog_revisions', 'SELECT'),
  'SELECT matrix preserved for revisions'
);

SELECT * FROM finish();
ROLLBACK;
