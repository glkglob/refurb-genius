-- Ticket 4C2E-B2C1 — measured-BOQ catalogue persistence foundation (pgTAP)
-- Fixtures use table owner (postgres). Application roles never write catalogue rows.
create extension if not exists pgtap with schema extensions;

begin;
select plan(68);

-- ── B1 v2 checksum helper parity (owner / internal path) ─────────────────
-- manifest = {"a":1}
-- snapshot = {"b":2}
-- input = c31191ce374322c4bb9a8a01227296431172c99226a19d072cdf2b6f91ee4a96
select is(
  public.measured_boq_package_input_checksum('{"a":1}', '{"b":2}'),
  'c31191ce374322c4bb9a8a01227296431172c99226a19d072cdf2b6f91ee4a96',
  'B1 v2 package input checksum matches Node fixture'
);

select is(
  public.measured_boq_package_input_checksum('{"a":1}', '{"b":2}'),
  public.measured_boq_package_input_checksum('{"a":1}', '{"b":2}'),
  'checksum helper is deterministic'
);

select isnt(
  public.measured_boq_package_input_checksum('{"a":1}', '{"b":2}'),
  public.measured_boq_package_input_checksum('{"a":2}', '{"b":2}'),
  'checksum changes when manifest bytes change'
);

-- ── checksum helper: no application-role execute ─────────────────────────
set local role anon;
select throws_ok(
  $$ select public.measured_boq_package_input_checksum('a','b') $$,
  '42501',
  null,
  'anon cannot execute checksum helper'
);
reset role;

set local role authenticated;
select throws_ok(
  $$ select public.measured_boq_package_input_checksum('a','b') $$,
  '42501',
  null,
  'authenticated cannot execute checksum helper'
);
reset role;

set local role service_role;
select throws_ok(
  $$ select public.measured_boq_package_input_checksum('a','b') $$,
  '42501',
  null,
  'service_role cannot execute checksum helper'
);
reset role;

select ok(
  not has_function_privilege(
    'service_role',
    'public.measured_boq_package_input_checksum(text,text)',
    'execute'
  ),
  'service_role lacks execute privilege on checksum helper'
);

-- ── privacy: packages / events select ────────────────────────────────────
set local role anon;
select throws_ok(
  $$ select count(*) from public.measured_boq_catalog_packages $$,
  '42501',
  null,
  'anon cannot select packages'
);
select throws_ok(
  $$ select count(*) from public.measured_boq_catalog_events $$,
  '42501',
  null,
  'anon cannot select events'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$ select count(*) from public.measured_boq_catalog_packages $$,
  '42501',
  null,
  'authenticated cannot select packages'
);
select throws_ok(
  $$ select count(*) from public.measured_boq_catalog_events $$,
  '42501',
  null,
  'authenticated cannot select events'
);
reset role;

set local role service_role;
select lives_ok(
  $$ select count(*) from public.measured_boq_catalog_packages $$,
  'service_role can select packages'
);
select lives_ok(
  $$ select count(*) from public.measured_boq_catalog_events $$,
  'service_role can select events'
);
select lives_ok(
  $$ select count(*) from public.measured_boq_catalog_revisions $$,
  'service_role can select revisions'
);
select lives_ok(
  $$ select count(*) from public.measured_boq_catalog_entries $$,
  'service_role can select entries'
);

-- ── direct DML revoked for service_role on all four tables ───────────────
select throws_ok(
  $$
    insert into public.measured_boq_catalog_packages (
      revision_id, catalog_revision, input_checksum, content_checksum,
      source_id, licence_status, production, manifest_version, normaliser_version,
      manifest_text, snapshot_text, validation_report
    ) values (
      '00000000-0000-4000-8000-000000000001', 'mboq-2099.03.01',
      'c31191ce374322c4bb9a8a01227296431172c99226a19d072cdf2b6f91ee4a96',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'test-source', 'synthetic', false, 1, 'b1-test',
      '{"a":1}', '{"b":2}', '{}'::jsonb
    )
  $$,
  '42501',
  null,
  'service_role cannot insert packages'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_events (
      event_type, command_scope, request_id, catalog_revision, revision_id,
      actor_kind, result
    ) values (
      'ingestion_accepted', 'persist_draft', gen_random_uuid(),
      'mboq-2099.03.01', '00000000-0000-4000-8000-000000000001',
      'service_role', 'created'
    )
  $$,
  '42501',
  null,
  'service_role cannot insert events'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_revisions (
      catalog_revision, status, schema_version, source_description, entry_count,
      content_checksum, effective_from, created_by
    ) values (
      'mboq-2099.99.01', 'draft', 'mboq-catalogue-v1', 'denied', 0,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '2099-01-01', 'service'
    )
  $$,
  '42501',
  null,
  'service_role cannot insert revisions'
);

select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set source_description = 'x'
    where false
  $$,
  '42501',
  null,
  'service_role cannot update revisions'
);

select throws_ok(
  $$ delete from public.measured_boq_catalog_revisions where false $$,
  '42501',
  null,
  'service_role cannot delete revisions'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.99.01', 'synth.denied.m2', 'x', 'test', 'm2', 'combined', 1
    )
  $$,
  '42501',
  null,
  'service_role cannot insert entries'
);

select throws_ok(
  $$
    update public.measured_boq_catalog_entries
    set display_name = 'x'
    where false
  $$,
  '42501',
  null,
  'service_role cannot update entries'
);

select throws_ok(
  $$ delete from public.measured_boq_catalog_entries where false $$,
  '42501',
  null,
  'service_role cannot delete entries'
);
reset role;

-- ── anon / authenticated DML revoked on revisions / entries ──────────────
set local role anon;
select throws_ok(
  $$
    insert into public.measured_boq_catalog_revisions (
      catalog_revision, status, schema_version, source_description, entry_count,
      content_checksum, effective_from, created_by
    ) values (
      'mboq-2099.98.01', 'draft', 'mboq-catalogue-v1', 'anon', 0,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '2099-01-01', 'anon'
    )
  $$,
  '42501',
  null,
  'anon cannot insert revisions'
);
select throws_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.98.01', 'synth.anon.m2', 'x', 'test', 'm2', 'combined', 1
    )
  $$,
  '42501',
  null,
  'anon cannot insert entries'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$
    insert into public.measured_boq_catalog_revisions (
      catalog_revision, status, schema_version, source_description, entry_count,
      content_checksum, effective_from, created_by
    ) values (
      'mboq-2099.97.01', 'draft', 'mboq-catalogue-v1', 'auth', 0,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '2099-01-01', 'auth'
    )
  $$,
  '42501',
  null,
  'authenticated cannot insert revisions'
);
select throws_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.97.01', 'synth.auth.m2', 'x', 'test', 'm2', 'combined', 1
    )
  $$,
  '42501',
  null,
  'authenticated cannot insert entries'
);
reset role;

-- ── package insert as table owner (postgres) ─────────────────────────────
select lives_ok(
  $$
    insert into public.measured_boq_catalog_revisions (
      id, catalog_revision, status, schema_version, currency, vat_basis, regional_basis,
      source_description, entry_count, content_checksum, effective_from, created_by,
      source_id, licence_status, production, input_checksum, normaliser_version
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'mboq-2099.03.01', 'draft', 'mboq-catalogue-v1', 'GBP', 'exclusive', 'uk-region-multipliers-v1',
      'SYNTHETIC B2C package-backed', 0,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '2099-03-01', 'b2c-test',
      'test-source', 'synthetic', false,
      'c31191ce374322c4bb9a8a01227296431172c99226a19d072cdf2b6f91ee4a96',
      'b1-test'
    )
  $$,
  'draft revision for package-backed tests may be inserted by owner'
);

select lives_ok(
  $$
    insert into public.measured_boq_catalog_packages (
      id, revision_id, catalog_revision, input_checksum, content_checksum,
      source_id, licence_status, production, manifest_version, normaliser_version,
      manifest_text, snapshot_text, validation_report
    ) values (
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      'mboq-2099.03.01',
      'c31191ce374322c4bb9a8a01227296431172c99226a19d072cdf2b6f91ee4a96',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'test-source', 'synthetic', false, 1, 'b1-test',
      '{"a":1}', '{"b":2}', '{"ok":true}'::jsonb
    )
  $$,
  'package with matching B1 checksum may be inserted by owner'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_packages (
      revision_id, catalog_revision, input_checksum, content_checksum,
      source_id, licence_status, production, manifest_version, normaliser_version,
      manifest_text, snapshot_text, validation_report
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'mboq-2099.03.01',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'test-source', 'synthetic', false, 1, 'b1-test',
      '{"a":1}', '{"b":2}', '{}'::jsonb
    )
  $$,
  'P0001',
  null,
  'package with mismatched input_checksum rejected'
);

select throws_ok(
  $$
    update public.measured_boq_catalog_packages
    set source_id = 'mutated'
    where id = '22222222-2222-4222-8222-222222222222'
  $$,
  'P0001',
  null,
  'package update rejected'
);

select throws_ok(
  $$
    delete from public.measured_boq_catalog_packages
    where id = '22222222-2222-4222-8222-222222222222'
  $$,
  'P0001',
  null,
  'package delete rejected'
);

-- package-backed content freeze on revision
select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set source_description = 'mutated content'
    where catalog_revision = 'mboq-2099.03.01'
  $$,
  'P0001',
  null,
  'package-backed draft content update rejected'
);

select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set content_checksum = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    where catalog_revision = 'mboq-2099.03.01'
  $$,
  'P0001',
  null,
  'package-backed content_checksum update rejected'
);

-- service_role cannot publish (no DML privilege; GUC spoof irrelevant)
set local role service_role;
select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set status = 'published', published_at = now()
    where catalog_revision = 'mboq-2099.03.01'
  $$,
  '42501',
  null,
  'service_role cannot update revisions to publish'
);

select set_config('app.measured_boq_catalog_lifecycle_command', 'publish', true);
select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set status = 'published', published_at = now()
    where catalog_revision = 'mboq-2099.03.01'
  $$,
  '42501',
  null,
  'service_role with spoofed lifecycle GUC still cannot publish'
);
select set_config('app.measured_boq_catalog_lifecycle_command', '', true);
reset role;

-- content + status simultaneous mutation rejected even for owner with GUC
select set_config('app.measured_boq_catalog_lifecycle_command', 'publish', true);
select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set status = 'published',
        published_at = now(),
        source_description = 'simultaneous content change'
    where catalog_revision = 'mboq-2099.03.01'
  $$,
  'P0001',
  null,
  'simultaneous content and publish mutation rejected'
);
select set_config('app.measured_boq_catalog_lifecycle_command', '', true);

-- unknown lifecycle command rejected
select set_config('app.measured_boq_catalog_lifecycle_command', 'explode', true);
select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set status = 'published', published_at = now()
    where catalog_revision = 'mboq-2099.03.01'
  $$,
  'P0001',
  null,
  'unknown lifecycle command rejected'
);
select set_config('app.measured_boq_catalog_lifecycle_command', '', true);

-- trusted owner + correct GUC can publish package-backed
select set_config('app.measured_boq_catalog_lifecycle_command', 'publish', true);
select lives_ok(
  $$
    update public.measured_boq_catalog_revisions
    set status = 'published',
        published_at = now(),
        published_by_kind = 'service_role',
        published_by_id = null
    where catalog_revision = 'mboq-2099.03.01'
  $$,
  'trusted owner with GUC=publish may publish package-backed revision'
);
select set_config('app.measured_boq_catalog_lifecycle_command', '', true);

-- entry insert as service_role blocked by privilege
set local role service_role;
select throws_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.03.01', 'synth.b2c.m2', 'x', 'test', 'm2', 'combined', 1
    )
  $$,
  '42501',
  null,
  'service_role cannot insert entries (privilege)'
);
reset role;

-- published package-backed entry insert blocked (parent not draft)
select throws_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.03.01', 'synth.b2c2.m2', 'x', 'test', 'm2', 'combined', 1
    )
  $$,
  'P0001',
  null,
  'entry insert on published package-backed revision rejected'
);

-- retire requires GUC
select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set status = 'retired', retired_at = now(), retirement_reason = 'test retire'
    where catalog_revision = 'mboq-2099.03.01'
  $$,
  'P0001',
  null,
  'retire without lifecycle GUC rejected'
);

select set_config('app.measured_boq_catalog_lifecycle_command', 'retire', true);
select lives_ok(
  $$
    update public.measured_boq_catalog_revisions
    set status = 'retired',
        retired_at = now(),
        retired_by_kind = 'service_role',
        retirement_reason = 'test retire'
    where catalog_revision = 'mboq-2099.03.01'
  $$,
  'trusted owner with GUC=retire may retire'
);
select set_config('app.measured_boq_catalog_lifecycle_command', '', true);

select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set retirement_reason = 'mutated'
    where catalog_revision = 'mboq-2099.03.01'
  $$,
  'P0001',
  null,
  'retired revision is fully immutable'
);

-- ── events append-only ───────────────────────────────────────────────────
select lives_ok(
  $$
    insert into public.measured_boq_catalog_events (
      event_type, command_scope, request_id, catalog_revision, revision_id,
      package_id, input_checksum, content_checksum, actor_kind, actor_user_id,
      result, payload_json
    ) values (
      'publication', 'publish', '33333333-3333-4333-8333-333333333333',
      'mboq-2099.03.01', '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      'c31191ce374322c4bb9a8a01227296431172c99226a19d072cdf2b6f91ee4a96',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'service_role', null, 'published', '{}'::jsonb
    )
  $$,
  'event insert allowed for owner'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_events (
      event_type, command_scope, request_id, catalog_revision, revision_id,
      actor_kind, result
    ) values (
      'publication_replay', 'publish', '33333333-3333-4333-8333-333333333333',
      'mboq-2099.03.01', '11111111-1111-4111-8111-111111111111',
      'service_role', 'idempotent_replay'
    )
  $$,
  '23505',
  null,
  'duplicate (command_scope, request_id) rejected'
);

select throws_ok(
  $$
    update public.measured_boq_catalog_events
    set result = 'mutated'
    where request_id = '33333333-3333-4333-8333-333333333333'
  $$,
  'P0001',
  null,
  'event update rejected'
);

select throws_ok(
  $$
    delete from public.measured_boq_catalog_events
    where request_id = '33333333-3333-4333-8333-333333333333'
  $$,
  'P0001',
  null,
  'event delete rejected'
);

-- ── size limits ──────────────────────────────────────────────────────────
select lives_ok(
  $$
    insert into public.measured_boq_catalog_revisions (
      id, catalog_revision, status, schema_version, source_description, entry_count,
      content_checksum, effective_from, created_by
    ) values (
      '44444444-4444-4444-8444-444444444444',
      'mboq-2099.04.01', 'draft', 'mboq-catalogue-v1', 'size test', 0,
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      '2099-04-01', 'b2c-test'
    )
  $$,
  'revision for size-limit test'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_packages (
      revision_id, catalog_revision, input_checksum, content_checksum,
      source_id, licence_status, production, manifest_version, normaliser_version,
      manifest_text, snapshot_text, validation_report
    ) values (
      '44444444-4444-4444-8444-444444444444',
      'mboq-2099.04.01',
      public.measured_boq_package_input_checksum(repeat('x', 1048577), '{"b":2}'),
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      'test-source', 'synthetic', false, 1, 'b1-test',
      repeat('x', 1048577), '{"b":2}', '{}'::jsonb
    )
  $$,
  '23514',
  null,
  'manifest over 1 MiB rejected'
);

-- ── lifecycle RPCs remain absent; B2D may add persist only ───────────────
select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'publish_measured_boq_catalog_revision',
        'retire_measured_boq_catalog_revision',
        'rollback_measured_boq_catalog_publication'
      )
  ),
  0,
  'no public publish/retire/rollback RPCs exist'
);

-- ── no active pointer ────────────────────────────────────────────────────
select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'measured_boq_catalog_revisions',
        'measured_boq_catalog_packages',
        'measured_boq_catalog_events'
      )
      and column_name in ('active', 'is_active', 'active_revision', 'is_current')
  ),
  0,
  'no active-pointer columns on catalogue tables'
);

-- ── UNIQUE revision_id on packages ───────────────────────────────────────
select lives_ok(
  $$
    insert into public.measured_boq_catalog_revisions (
      id, catalog_revision, status, schema_version, source_description, entry_count,
      content_checksum, effective_from, created_by
    ) values (
      '55555555-5555-4555-8555-555555555555',
      'mboq-2099.05.01', 'draft', 'mboq-catalogue-v1', 'uniq package test', 0,
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      '2099-05-01', 'b2c-test'
    );
    insert into public.measured_boq_catalog_packages (
      revision_id, catalog_revision, input_checksum, content_checksum,
      source_id, licence_status, production, manifest_version, normaliser_version,
      manifest_text, snapshot_text, validation_report
    ) values (
      '55555555-5555-4555-8555-555555555555',
      'mboq-2099.05.01',
      public.measured_boq_package_input_checksum('{"z":1}', '{"y":2}'),
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      'test-source', 'synthetic', false, 1, 'b1-test',
      '{"z":1}', '{"y":2}', '{}'::jsonb
    )
  $$,
  'second package-backed revision ok'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_packages (
      revision_id, catalog_revision, input_checksum, content_checksum,
      source_id, licence_status, production, manifest_version, normaliser_version,
      manifest_text, snapshot_text, validation_report
    ) values (
      '55555555-5555-4555-8555-555555555555',
      'mboq-2099.05.01',
      public.measured_boq_package_input_checksum('{"z":9}', '{"y":9}'),
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      'test-source', 'synthetic', false, 1, 'b1-test',
      '{"z":9}', '{"y":9}', '{}'::jsonb
    )
  $$,
  '23505',
  null,
  'second package for same revision_id rejected'
);

-- ── legacy rows: valid + readable + no direct-write bypass ───────────────
select lives_ok(
  $$
    insert into public.measured_boq_catalog_revisions (
      id, catalog_revision, status, schema_version, source_description, entry_count,
      content_checksum, effective_from, created_by
    ) values (
      '66666666-6666-4666-8666-666666666666',
      'mboq-2099.06.01', 'draft', 'mboq-catalogue-v1', 'legacy no package', 0,
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      '2099-06-01', 'b2c-test'
    )
  $$,
  'legacy draft without package remains insertable by owner'
);

select lives_ok(
  $$
    select id from public.measured_boq_catalog_revisions
    where catalog_revision = 'mboq-2099.06.01'
  $$,
  'legacy revision remains selectable'
);

select is(
  (
    select count(*)::integer
    from public.measured_boq_catalog_packages p
    where p.revision_id = '66666666-6666-4666-8666-666666666666'
  ),
  0,
  'no package row fabricated for legacy revision'
);

select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set source_description = 'legacy still editable'
    where catalog_revision = 'mboq-2099.06.01'
  $$,
  'P0001',
  null,
  'legacy draft content update rejected (no direct-write bypass)'
);

set local role service_role;
select lives_ok(
  $$
    select catalog_revision from public.measured_boq_catalog_revisions
    where catalog_revision = 'mboq-2099.06.01'
  $$,
  'service_role can select legacy revision'
);
select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set source_description = 'service mutate'
    where catalog_revision = 'mboq-2099.06.01'
  $$,
  '42501',
  null,
  'service_role cannot update legacy revision'
);
select set_config('app.measured_boq_catalog_lifecycle_command', 'publish', true);
select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set status = 'published', published_at = now()
    where catalog_revision = 'mboq-2099.06.01'
  $$,
  '42501',
  null,
  'service_role cannot publish legacy revision even with GUC'
);
select set_config('app.measured_boq_catalog_lifecycle_command', '', true);
reset role;

-- legacy publish without GUC rejected for owner
select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set status = 'published', published_at = now()
    where catalog_revision = 'mboq-2099.06.01'
  $$,
  'P0001',
  null,
  'legacy publish without lifecycle GUC rejected'
);

-- legacy entry insert/update/delete by service_role fails
select lives_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.06.01', 'synth.test.item', 'legacy entry', 'test', 'm2', 'combined', 1
    )
  $$,
  'owner may insert entry on legacy draft'
);

select throws_ok(
  $$
    update public.measured_boq_catalog_entries
    set display_name = 'mutated'
    where catalog_revision = 'mboq-2099.06.01' and rate_key = 'synth.test.item'
  $$,
  'P0001',
  null,
  'entry update rejected on all revisions'
);

select throws_ok(
  $$
    delete from public.measured_boq_catalog_entries
    where catalog_revision = 'mboq-2099.06.01' and rate_key = 'synth.test.item'
  $$,
  'P0001',
  null,
  'entry delete rejected on all revisions'
);

set local role service_role;
select throws_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.06.01', 'synth.test.item', 'x', 'test', 'm2', 'combined', 1
    )
  $$,
  '42501',
  null,
  'service_role cannot insert legacy entries'
);
select throws_ok(
  $$
    update public.measured_boq_catalog_entries
    set display_name = 'x'
    where catalog_revision = 'mboq-2099.06.01'
  $$,
  '42501',
  null,
  'service_role cannot update legacy entries'
);
select throws_ok(
  $$
    delete from public.measured_boq_catalog_entries
    where catalog_revision = 'mboq-2099.06.01'
  $$,
  '42501',
  null,
  'service_role cannot delete legacy entries'
);
reset role;

select * from finish();
rollback;
