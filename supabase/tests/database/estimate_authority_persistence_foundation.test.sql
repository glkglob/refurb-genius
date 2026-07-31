-- Ticket 4C2B database probes (pgTAP)
-- Run: supabase test db
begin;
select plan(40);

-- Extensions / helpers
create extension if not exists pgtap with schema extensions;

-- Fixture users (auth.users) + project
-- Use fixed UUIDs for deterministic probes
select tests.create_supabase_user('owner@example.com') as owner_id \gset
-- Fallback if tests helpers unavailable: manual inserts

-- Prefer self-contained fixtures when create_supabase_user is absent
do $$
declare
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_other uuid := '22222222-2222-4222-8222-222222222222';
  v_project uuid := '33333333-3333-4333-8333-333333333333';
begin
  -- Ensure auth.users rows exist (local supabase)
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_owner, 'authenticated', 'authenticated', 'owner4c2b@example.com', crypt('pw', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (v_other, 'authenticated', 'authenticated', 'other4c2b@example.com', crypt('pw', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (id, email)
  values (v_owner, 'owner4c2b@example.com'), (v_other, 'other4c2b@example.com')
  on conflict (id) do nothing;

  insert into public.projects (
    id, user_id, name, address, postcode, region, property_type,
    bedrooms, bathrooms, size_sqm, purchase_price, estimated_gdv, estimate_done
  ) values (
    v_project, v_owner, '4C2B Project', '1 Test St', 'SW1A 1AA', 'London', 'Flat',
    2, 1, 90, 250000, 400000, false
  ) on conflict (id) do nothing;
end $$;

-- 1. Legacy estimate defaults to pricing_authority=none
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

-- Marker integrity: invalid combinations rejected
select throws_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, pricing_policy_version)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'none', 'v1')$$,
  '23514',
  null,
  'none + policy version rejected'
);

select throws_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, catalog_revision)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'none', 'rev')$$,
  '23514',
  null,
  'none + catalogue revision rejected'
);

select throws_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'category-engine')$$,
  '23514',
  null,
  'category-engine without policy version rejected'
);

select throws_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, pricing_policy_version, catalog_revision)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'category-engine', 'category-engine-v1', 'rev')$$,
  '23514',
  null,
  'category-engine with catalogue revision rejected'
);

select throws_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, pricing_policy_version)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'measured-boq-engine', 'v1')$$,
  '23514',
  null,
  'measured-boq-engine without catalogue revision rejected'
);

select throws_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'unknown')$$,
  '23514',
  null,
  'unknown authority value rejected'
);

-- Authenticated owner draft insert allowed
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'none')$$,
  'browser owner can insert a none/draft estimate'
);

-- Browser cannot insert category-engine
select throws_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, pricing_policy_version)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'category-engine', 'category-engine-v1')$$,
  '42501',
  null,
  'browser owner cannot insert category-engine'
);

select throws_ok(
  $$insert into public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, pricing_policy_version, catalog_revision)
    values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'London', 'Dated', 'Standard', 'measured-boq-engine', 'v1', 'rev1')$$,
  '42501',
  null,
  'browser owner cannot insert measured-boq-engine'
);

reset role;

-- Service role RPC happy path
set local role service_role;

select ok(
  (select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-key-1',
    encode(digest('payload-a', 'sha256'), 'hex'),
    'category-engine-v1',
    'London',
    'Dated',
    'Standard',
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
  (select estimate_done from public.projects where id = '33333333-3333-4333-8333-333333333333'),
  true,
  'valid category RPC sets estimate_done=true'
);

select is(
  (select estimated_gdv from public.projects where id = '33333333-3333-4333-8333-333333333333'),
  400000::numeric,
  'valid category RPC leaves estimated_gdv unchanged'
);

-- Same key / same hash → same estimate
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

-- Same key / different hash → conflict
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
  null,
  null,
  'same key/different hash rejects'
);

-- Ownership mismatch rejects
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
  null,
  null,
  'locked owner mismatch rejects'
);

-- Missing project rejects
select throws_ok(
  $$select public.persist_category_engine_estimate(
    '99999999-9999-4999-8999-999999999999'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-key-3',
    encode(digest('payload-d', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[]'::jsonb
  )$$,
  null,
  null,
  'missing project rejects'
);

reset role;

-- Authenticated cannot execute private RPC
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.persist_category_engine_estimate(
    '33333333-3333-4333-8333-333333333333'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'idem-auth',
    encode(digest('payload-auth', 'sha256'), 'hex'),
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1, 1, 1, 1, 1, 1, 1, 1, 1,
    '[]'::jsonb
  )$$,
  '42501',
  null,
  'authenticated owner cannot execute private RPC'
);

reset role;

select finish();
rollback;
