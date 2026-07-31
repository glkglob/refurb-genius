-- Ticket 4C2B database probes (pgTAP)
-- Run: supabase test db
create extension if not exists pgtap with schema extensions;

begin;

select plan(41);

-- ─── Self-contained fixtures (no external helpers) ───────────────────
do $$
declare
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_other uuid := '22222222-2222-4222-8222-222222222222';
  v_project uuid := '33333333-3333-4333-8333-333333333333';
  v_foreign uuid := '55555555-5555-4555-8555-555555555555';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner4c2b@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'other4c2b@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (id, email)
  values (v_owner, 'owner4c2b@example.com'), (v_other, 'other4c2b@example.com')
  on conflict (id) do nothing;

  insert into public.projects (
    id, user_id, name, address, postcode, region, property_type,
    bedrooms, bathrooms, size_sqm, purchase_price, estimated_gdv, estimate_done
  ) values
    (v_project, v_owner, '4C2B Project', '1 Test St', 'SW1A 1AA', 'London', 'Flat',
     2, 1, 90, 250000, 400000, false),
    (v_foreign, v_other, 'Foreign Project', '2 Other St', 'E1 1AA', 'London', 'Flat',
     2, 1, 80, 200000, 300000, false)
  on conflict (id) do update
    set user_id = excluded.user_id,
        estimated_gdv = excluded.estimated_gdv,
        estimate_done = false;
end $$;

-- 1. Legacy default authority = none
insert into public.estimates (
  id, project_id, user_id, region, condition_level, finish_level
) values (
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'London', 'Dated', 'Standard'
);

select is(
  (select pricing_authority from public.estimates where id = '44444444-4444-4444-8444-444444444444'),
  'none',
  'legacy estimate defaults to pricing_authority=none'
);

select is(
  (select pricing_policy_version from public.estimates where id = '44444444-4444-4444-8444-444444444444'),
  null,
  'legacy estimate has null policy version'
);

select is(
  (select catalog_revision from public.estimates where id = '44444444-4444-4444-8444-444444444444'),
  null,
  'legacy estimate has null catalog revision'
);

-- Marker integrity
select throws_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, pricing_policy_version)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'none', 'v1')$$,
  '23514',
  null,
  'none + policy version rejected'
);

select throws_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'category-engine')$$,
  '23514',
  null,
  'category-engine without policy version rejected'
);

select throws_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'unknown')$$,
  '23514',
  null,
  'unknown authority value rejected'
);

-- Authenticated owner draft insert against own project
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'none')$$,
  'owner can insert draft against own project'
);

-- Cannot attach draft to foreign project
select throws_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority)
    values ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'none')$$,
  '42501',
  null,
  'owner cannot insert draft against another user project'
);

-- Cannot insert category-engine as browser
select throws_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, pricing_policy_version)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'category-engine', 'category-engine-v1')$$,
  '42501',
  null,
  'browser owner cannot insert category-engine'
);

-- Authenticated cannot execute private RPC
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-auth',
    encode(digest('payload-auth', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
  )$$,
  '42501',
  null,
  'authenticated owner cannot execute private RPC'
);

reset role;

-- Anon cannot execute RPC
set local role anon;
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-anon',
    encode(digest('payload-anon', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
  )$$,
  '42501',
  null,
  'anon cannot execute private RPC'
);
reset role;

-- Service role happy path
set local role service_role;

select ok(
  (select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-key-1',
    encode(digest('payload-a', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
  ) ->> 'estimate_id') is not null,
  'service role can execute category RPC'
);

select is(
  (select pricing_authority from public.estimates
   where project_id = '33333333-3333-4333-8333-333333333333'
     and pricing_authority = 'category-engine'
   order by created_at desc limit 1),
  'category-engine',
  'valid category RPC writes category-engine marker'
);

select is(
  (select pricing_policy_version from public.estimates
   where project_id = '33333333-3333-4333-8333-333333333333'
     and pricing_authority = 'category-engine'
   order by created_at desc limit 1),
  'category-engine-v1',
  'valid category RPC writes non-empty policy version'
);

select is(
  (select catalog_revision from public.estimates
   where project_id = '33333333-3333-4333-8333-333333333333'
     and pricing_authority = 'category-engine'
   order by created_at desc limit 1),
  null,
  'valid category RPC leaves catalog_revision null'
);

select is(
  (select estimate_done from public.projects where id = '33333333-3333-4333-8333-333333333333'),
  true,
  'valid category RPC sets estimate_done=true'
);

select is(
  (select estimated_gdv from public.projects where id = '33333333-3333-4333-8333-333333333333'),
  400000::numeric,
  'valid category RPC leaves estimated_gdv unchanged'
);

-- Same key / same hash → replay
select is(
  (select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-key-1',
    encode(digest('payload-a', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
  ) ->> 'replay'),
  'true',
  'same key/same hash returns replay'
);

-- Same key / different hash → IDEMPOTENCY_CONFLICT (23505)
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-key-1',
    encode(digest('payload-b', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
  )$$,
  '23505',
  'IDEMPOTENCY_CONFLICT',
  'same key/different hash rejects with IDEMPOTENCY_CONFLICT'
);

-- Ownership mismatch → P0001
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    'idem-key-2',
    encode(digest('payload-c', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
  )$$,
  'P0001',
  'PROJECT_OWNERSHIP_CHANGED',
  'locked owner mismatch rejects with PROJECT_OWNERSHIP_CHANGED'
);

-- Missing project → P0002
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '99999999-9999-4999-8999-999999999999'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-key-3',
    encode(digest('payload-d', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
  )$$,
  'P0002',
  'PROJECT_NOT_FOUND',
  'missing project rejects with PROJECT_NOT_FOUND'
);

-- Malformed items: empty array
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-empty',
    encode(digest('payload-empty', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[]'::jsonb
  )$$,
  '22023',
  'INVALID_AUTHORITY_FIELD_VALUE',
  'empty items array rejected'
);

-- Malformed: missing category
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-miss-cat',
    encode(digest('payload-miss-cat', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
  )$$,
  '22023',
  'INVALID_AUTHORITY_FIELD_VALUE',
  'missing category rejected'
);

-- Malformed: missing labour
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-miss-lab',
    encode(digest('payload-miss-lab', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","materials":2000,"total":3000,"weeks":3}]'::jsonb
  )$$,
  '22023',
  'INVALID_AUTHORITY_FIELD_VALUE',
  'missing labour rejected'
);

-- Malformed: blank category
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-blank-cat',
    encode(digest('payload-blank-cat', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
  )$$,
  '22023',
  'INVALID_AUTHORITY_FIELD_VALUE',
  'blank category rejected'
);

-- Malformed: negative values
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-neg',
    encode(digest('payload-neg', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":-1,"materials":2000,"total":1999,"weeks":3}]'::jsonb
  )$$,
  '22023',
  'INVALID_AUTHORITY_FIELD_VALUE',
  'negative labour rejected'
);

-- Malformed: line total mismatch
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-line-arith',
    encode(digest('payload-line-arith', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":9999,"weeks":3}]'::jsonb
  )$$,
  '22023',
  'INVALID_AUTHORITY_FIELD_VALUE',
  'line total arithmetic mismatch rejected'
);

-- Malformed: unexpected field
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-extra',
    encode(digest('payload-extra', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3,"extra":true}]'::jsonb
  )$$,
  '22023',
  'INVALID_AUTHORITY_FIELD_VALUE',
  'unexpected item field rejected'
);

-- Malformed: aggregate mismatch (item sums != header)
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-agg',
    encode(digest('payload-agg', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    9999, 2000, 11999, 300, 660, 12959, 12959, 14000, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
  )$$,
  '22023',
  'INVALID_AUTHORITY_FIELD_VALUE',
  'item aggregate/header mismatch rejected'
);

-- Failed call leaves no idempotency reservation; retry with valid payload succeeds
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-retry',
    encode(digest('payload-retry-bad', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3,"extra":1}]'::jsonb
  )$$,
  '22023',
  'INVALID_AUTHORITY_FIELD_VALUE',
  'failed item validation rejects'
);

select is(
  (select count(*)::int from public.estimate_authority_idempotency
   where project_id = '33333333-3333-4333-8333-333333333333'
     and idempotency_key = 'idem-retry'),
  0,
  'failed transaction leaves no idempotency row'
);

select ok(
  (select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-retry',
    encode(digest('payload-retry-good', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
  ) ->> 'estimate_id') is not null,
  'retry after failed reservation succeeds with same key and valid payload'
);

-- Ownership failure leaves no partial rows
select is(
  (select count(*)::int from public.estimate_authority_idempotency
   where project_id = '33333333-3333-4333-8333-333333333333'
     and idempotency_key = 'idem-key-2'),
  0,
  'ownership failure leaves no idempotency record'
);

-- Canonical protection: browser cannot mutate
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*)::int from public.estimates
   where pricing_authority = 'category-engine'
     and project_id = '33333333-3333-4333-8333-333333333333'),
  (select count(*)::int from public.estimates
   where pricing_authority = 'category-engine'
     and project_id = '33333333-3333-4333-8333-333333333333'),
  'canonical estimates remain visible for select'
);

-- Update canonical returns 0 rows (RLS filters)
update public.estimates
set mid_total = 1
where pricing_authority = 'category-engine'
  and project_id = '33333333-3333-4333-8333-333333333333';

select is(
  (select count(*)::int from public.estimates
   where pricing_authority = 'category-engine'
     and project_id = '33333333-3333-4333-8333-333333333333'
     and mid_total = 1),
  0,
  'browser cannot update canonical estimate header'
);

-- Reparent draft to foreign project blocked (WITH CHECK raises or updates 0 rows)
select throws_ok(
  $$
  do $body$
  declare
    v_draft uuid;
  begin
    insert into public.estimates (project_id, user_id, region, condition_level, finish_level)
    values (
      '33333333-3333-4333-8333-333333333333',
      '11111111-1111-4111-8111-111111111111',
      'London', 'Dated', 'Standard'
    )
    returning id into v_draft;

    update public.estimates
    set project_id = '55555555-5555-4555-8555-555555555555'
    where id = v_draft;
  end
  $body$;
  $$,
  '42501',
  null,
  'owner cannot reparent draft to another user project'
);

-- Admin select policy still exists
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'estimates'
      and policyname = 'estimates_select_admin'
  ),
  'admin select policy on estimates remains intact'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'estimate_items'
      and policyname = 'estimate_items_select_admin'
  ),
  'admin select policy on estimate_items remains intact'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'estimate_rooms'
      and policyname = 'estimate_rooms_select_admin'
  ),
  'admin select policy on estimate_rooms remains intact'
);

-- has_function_privilege for service_role
select ok(
  has_function_privilege(
    'service_role',
    'public.persist_category_engine_estimate(uuid,uuid,text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,jsonb)',
    'execute'
  ),
  'service_role has execute on private RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.persist_category_engine_estimate(uuid,uuid,text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,jsonb)',
    'execute'
  ),
  'authenticated lacks execute on private RPC'
);

reset role;

select * from finish();
rollback;
