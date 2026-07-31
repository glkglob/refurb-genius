-- Ticket 4C2C-B — measured-BOQ catalogue foundation (pgTAP)
create extension if not exists pgtap with schema extensions;

begin;
select plan(48);

-- ── fixtures ──────────────────────────────────────────────────────────────
do $$
declare
  v_owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_other uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_project uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner4c2c@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'other4c2c@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (id, email)
  values (v_owner, 'owner4c2c@example.com'), (v_other, 'other4c2c@example.com')
  on conflict (id) do nothing;

  insert into public.projects (
    id, user_id, name, address, postcode, region, property_type,
    bedrooms, bathrooms, size_sqm, purchase_price, estimated_gdv, estimate_done
  ) values (
    v_project, v_owner, '4C2C Project', '1 Test St', 'SW1A 1AA', 'London', 'Flat',
    2, 1, 90, 250000, 400000, false
  ) on conflict (id) do update set user_id = excluded.user_id;
end $$;

-- ── privacy ───────────────────────────────────────────────────────────────
set local role anon;
select throws_ok(
  $$ select count(*) from public.measured_boq_catalog_revisions $$,
  '42501',
  null,
  'anon cannot select catalogue revisions'
);
select throws_ok(
  $$ select count(*) from public.measured_boq_catalog_entries $$,
  '42501',
  null,
  'anon cannot select catalogue entries'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$ select count(*) from public.measured_boq_catalog_revisions $$,
  '42501',
  null,
  'authenticated cannot select catalogue revisions'
);
select throws_ok(
  $$ select count(*) from public.measured_boq_catalog_entries $$,
  '42501',
  null,
  'authenticated cannot select catalogue entries'
);
reset role;

set local role service_role;
select lives_ok(
  $$ select count(*) from public.measured_boq_catalog_revisions $$,
  'service_role can read revisions'
);
select lives_ok(
  $$ select count(*) from public.measured_boq_catalog_entries $$,
  'service_role can read entries'
);

-- ── draft revision + entries ──────────────────────────────────────────────
select lives_ok(
  $$
    insert into public.measured_boq_catalog_revisions (
      catalog_revision, status, schema_version, currency, vat_basis, regional_basis,
      source_description, entry_count, content_checksum, effective_from, created_by
    ) values (
      'mboq-2099.01.01', 'draft', 'mboq-catalogue-v1', 'GBP', 'exclusive', 'uk-region-multipliers-v1',
      'SYNTHETIC TEST FIXTURE — not production', 0,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '2099-01-01', 'test-publisher'
    )
  $$,
  'draft revision may be inserted'
);

select lives_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type,
      base_unit_rate, currency, vat_basis, source_reference, status
    ) values (
      'mboq-2099.01.01', 'synth.paint.m2', 'SYNTHETIC paint', 'test', 'm2', 'combined',
      10.0000, 'GBP', 'exclusive', 'synthetic-fixture', 'active'
    )
  $$,
  'draft revision may receive entries'
);

select lives_ok(
  $$
    update public.measured_boq_catalog_entries
    set base_unit_rate = 11.0000
    where catalog_revision = 'mboq-2099.01.01' and rate_key = 'synth.paint.m2'
  $$,
  'draft entry may be updated'
);

select lives_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type,
      base_unit_rate, currency, vat_basis, status
    ) values (
      'mboq-2099.01.01', 'synth.tile.m2', 'SYNTHETIC tile', 'test', 'm2', 'materials',
      20.0000, 'GBP', 'exclusive', 'active'
    )
  $$,
  'second draft entry allowed'
);

select lives_ok(
  $$
    delete from public.measured_boq_catalog_entries
    where catalog_revision = 'mboq-2099.01.01' and rate_key = 'synth.tile.m2'
  $$,
  'draft entry may be deleted'
);

-- constraints
select throws_ok(
  $$
    insert into public.measured_boq_catalog_revisions (
      catalog_revision, status, schema_version, source_description, entry_count,
      content_checksum, effective_from, created_by
    ) values (
      'mboq-2099.01.01', 'draft', 'v1', 'dup', 0,
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      '2099-01-01', 'test'
    )
  $$,
  '23505',
  null,
  'duplicate revision rejected'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.01.01', 'synth.paint.m2', 'dup', 'test', 'm2', 'combined', 1
    )
  $$,
  '23505',
  null,
  'duplicate key within revision rejected'
);

select lives_ok(
  $$
    insert into public.measured_boq_catalog_revisions (
      catalog_revision, status, schema_version, source_description, entry_count,
      content_checksum, effective_from, created_by
    ) values (
      'mboq-2099.01.02', 'draft', 'mboq-catalogue-v1', 'SYNTHETIC B', 0,
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      '2099-01-02', 'test-publisher'
    );
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.01.02', 'synth.paint.m2', 'SYNTHETIC paint B', 'test', 'm2', 'combined', 15
    )
  $$,
  'same key in another revision allowed'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_revisions (
      catalog_revision, status, schema_version, source_description, entry_count,
      content_checksum, effective_from, created_by
    ) values (
      'latest', 'draft', 'v1', 'bad', 0,
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      '2099-01-01', 'test'
    )
  $$,
  '23514',
  null,
  'invalid revision grammar rejected'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.01.01', 'Bad Key', 'x', 'test', 'm2', 'combined', 1
    )
  $$,
  '23514',
  null,
  'invalid key rejected'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.01.01', 'synth.bad.unit', 'x', 'test', 'sqm', 'combined', 1
    )
  $$,
  '23514',
  null,
  'invalid unit rejected'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.01.01', 'synth.bad.cost', 'x', 'test', 'm2', 'plant', 1
    )
  $$,
  '23514',
  null,
  'invalid cost type rejected'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.01.01', 'synth.zero.m2', 'x', 'test', 'm2', 'combined', 0
    )
  $$,
  '23514',
  null,
  'zero rate rejected'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.01.01', 'synth.neg.m2', 'x', 'test', 'm2', 'combined', -1
    )
  $$,
  '23514',
  null,
  'negative rate rejected'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_revisions (
      catalog_revision, status, schema_version, currency, source_description, entry_count,
      content_checksum, effective_from, created_by
    ) values (
      'mboq-2099.02.01', 'draft', 'v1', 'USD', 'bad currency', 0,
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      '2099-02-01', 'test'
    )
  $$,
  '23514',
  null,
  'non-GBP rejected'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_revisions (
      catalog_revision, status, schema_version, vat_basis, source_description, entry_count,
      content_checksum, effective_from, created_by
    ) values (
      'mboq-2099.02.02', 'draft', 'v1', 'inclusive', 'bad vat', 0,
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      '2099-02-02', 'test'
    )
  $$,
  '23514',
  null,
  'non-exclusive VAT rejected'
);

-- publish
select lives_ok(
  $$
    update public.measured_boq_catalog_revisions
    set status = 'published',
        published_at = now(),
        entry_count = 1,
        content_checksum = '1111111111111111111111111111111111111111111111111111111111111111'
    where catalog_revision = 'mboq-2099.01.01'
  $$,
  'draft may transition to published'
);

select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set source_description = 'mutated'
    where catalog_revision = 'mboq-2099.01.01'
  $$,
  'P0001',
  null,
  'published revision update rejected'
);

select throws_ok(
  $$ delete from public.measured_boq_catalog_revisions where catalog_revision = 'mboq-2099.01.01' $$,
  'P0001',
  null,
  'published revision delete rejected'
);

select throws_ok(
  $$
    insert into public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) values (
      'mboq-2099.01.01', 'synth.after.m2', 'x', 'test', 'm2', 'combined', 1
    )
  $$,
  'P0001',
  null,
  'published entry insert rejected'
);

select throws_ok(
  $$
    update public.measured_boq_catalog_entries
    set base_unit_rate = 99
    where catalog_revision = 'mboq-2099.01.01' and rate_key = 'synth.paint.m2'
  $$,
  'P0001',
  null,
  'published entry update rejected'
);

select throws_ok(
  $$
    delete from public.measured_boq_catalog_entries
    where catalog_revision = 'mboq-2099.01.01' and rate_key = 'synth.paint.m2'
  $$,
  'P0001',
  null,
  'published entry delete rejected'
);

select lives_ok(
  $$
    update public.measured_boq_catalog_revisions
    set status = 'retired', retired_at = now()
    where catalog_revision = 'mboq-2099.01.01'
  $$,
  'published may transition to retired only'
);

select throws_ok(
  $$
    update public.measured_boq_catalog_revisions
    set source_description = 'mutated retired'
    where catalog_revision = 'mboq-2099.01.01'
  $$,
  'P0001',
  null,
  'retired revision update rejected'
);

select throws_ok(
  $$ delete from public.measured_boq_catalog_revisions where catalog_revision = 'mboq-2099.01.01' $$,
  'P0001',
  null,
  'retired revision delete rejected'
);

select throws_ok(
  $$
    update public.measured_boq_catalog_entries
    set display_name = 'nope'
    where catalog_revision = 'mboq-2099.01.01'
  $$,
  'P0001',
  null,
  'retired entry mutation rejected'
);

-- ── provenance ────────────────────────────────────────────────────────────
select lives_ok(
  $$
    insert into public.estimates (
      id, project_id, user_id, region, condition_level, finish_level,
      mid_total, pricing_authority
    ) values (
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'London', 'Dated', 'Standard',
      100, 'none'
    )
  $$,
  'draft estimate header ok'
);

select lives_ok(
  $$
    insert into public.estimate_items (
      id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost
    ) values (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'paint', 'Legacy item', 1, 'm2', 10, 10
    )
  $$,
  'legacy estimate item remains valid with NULL provenance'
);

select throws_ok(
  $$
    insert into public.estimate_items (
      id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost,
      rate_source, rate_key, catalog_revision, base_unit_rate, regional_multiplier, resolved_unit_rate
    ) values (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'paint', 'Bad draft provenance', 1, 'm2', 10, 10,
      'library', 'synth.paint.m2', 'mboq-2099.01.01', 10, 1.3, 13
    )
  $$,
  'P0001',
  null,
  'draft item claiming library provenance fails'
);

select lives_ok(
  $$
    insert into public.estimates (
      id, project_id, user_id, region, condition_level, finish_level,
      mid_total, pricing_authority, pricing_policy_version
    ) values (
      '12121212-1212-4121-8121-121212121212',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'London', 'Dated', 'Standard',
      100, 'category-engine', 'category-engine-v1'
    )
  $$,
  'category-engine header remains valid'
);

select lives_ok(
  $$
    insert into public.estimate_items (
      id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost
    ) values (
      '13131313-1313-4131-8131-131313131313',
      '12121212-1212-4121-8121-121212121212',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'paint', 'Category item', 1, 'item', 50, 50
    )
  $$,
  'category items remain valid without measured provenance'
);

select throws_ok(
  $$
    insert into public.estimate_items (
      id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost,
      rate_source
    ) values (
      '14141414-1414-4141-8141-141414141414',
      '12121212-1212-4121-8121-121212121212',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'paint', 'partial', 1, 'm2', 10, 10,
      'library'
    )
  $$,
  'P0001',
  null,
  'partial provenance fails'
);

-- measured header + item (use still-retired revision which is readable for FK)
select lives_ok(
  $$
    insert into public.estimates (
      id, project_id, user_id, region, condition_level, finish_level,
      mid_total, pricing_authority, pricing_policy_version, catalog_revision
    ) values (
      '15151515-1515-4151-8151-151515151515',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'London', 'Dated', 'Standard',
      26, 'measured-boq-engine', '2026-07-30.1', 'mboq-2099.01.01'
    )
  $$,
  'measured header ok'
);

select lives_ok(
  $$
    insert into public.estimate_items (
      id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost,
      rate_source, rate_key, catalog_revision, base_unit_rate, regional_multiplier, resolved_unit_rate
    ) values (
      '16161616-1616-4161-8161-161616161616',
      '15151515-1515-4151-8151-151515151515',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'paint', 'Measured paint', 2, 'm2', 13, 26,
      'library', 'synth.paint.m2', 'mboq-2099.01.01', 10, 1.3, 13
    )
  $$,
  'valid measured library item succeeds'
);

select throws_ok(
  $$
    insert into public.estimate_items (
      id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost,
      rate_source, rate_key, catalog_revision, base_unit_rate, regional_multiplier, resolved_unit_rate
    ) values (
      '17171717-1717-4171-8171-171717171717',
      '15151515-1515-4151-8151-151515151515',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'paint', 'Wrong rev', 1, 'm2', 13, 13,
      'library', 'synth.paint.m2', 'mboq-2099.01.02', 15, 1.3, 19.5
    )
  $$,
  'P0001',
  null,
  'measured item revision differing from header fails'
);

select throws_ok(
  $$
    insert into public.estimate_items (
      id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost,
      rate_source, rate_key, catalog_revision, base_unit_rate, regional_multiplier, resolved_unit_rate
    ) values (
      '18181818-1818-4181-8181-181818181818',
      '15151515-1515-4151-8151-151515151515',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'paint', 'Bad arith', 1, 'm2', 13, 13,
      'library', 'synth.paint.m2', 'mboq-2099.01.01', 10, 1.3, 99
    )
  $$,
  'P0001',
  null,
  'invalid resolved-rate arithmetic fails'
);

select throws_ok(
  $$
    insert into public.estimate_items (
      id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost,
      rate_source, rate_key, catalog_revision, base_unit_rate, regional_multiplier, resolved_unit_rate
    ) values (
      '19191919-1919-4191-8191-191919191919',
      '15151515-1515-4151-8151-151515151515',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'paint', 'Bad total', 2, 'm2', 13, 999,
      'library', 'synth.paint.m2', 'mboq-2099.01.01', 10, 1.3, 13
    )
  $$,
  'P0001',
  null,
  'invalid line-total arithmetic fails'
);

-- browser policy: provenance injection rejected
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$
    insert into public.estimate_items (
      id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost,
      rate_source, rate_key, catalog_revision, base_unit_rate, regional_multiplier, resolved_unit_rate
    ) values (
      '20202020-2020-4202-8202-202020202020',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'paint', 'Browser inject', 1, 'm2', 10, 10,
      'library', 'synth.paint.m2', 'mboq-2099.01.01', 10, 1.3, 13
    )
  $$,
  'P0001',
  null,
  'browser provenance injection is rejected'
);

select lives_ok(
  $$
    insert into public.estimate_items (
      id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost
    ) values (
      '21212121-2121-4212-8212-212121212121',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'paint', 'Browser draft ok', 1, 'm2', 10, 10
    )
  $$,
  'draft browser policy remains functional'
);
reset role;

-- 4C2B RPC privileges unchanged
select ok(
  has_function_privilege('service_role', 'public.persist_category_engine_estimate(uuid,uuid,text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,jsonb)', 'execute'),
  'service_role retains category RPC execute'
);
select ok(
  not has_function_privilege('authenticated', 'public.persist_category_engine_estimate(uuid,uuid,text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,jsonb)', 'execute'),
  'authenticated still cannot execute category RPC'
);
select ok(
  not has_function_privilege('anon', 'public.persist_category_engine_estimate(uuid,uuid,text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,jsonb)', 'execute'),
  'anon still cannot execute category RPC'
);

select * from finish();
rollback;
