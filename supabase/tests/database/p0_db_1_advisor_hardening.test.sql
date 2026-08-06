-- P0-DB-1 — Security DEFINER grants, INVOKER share link, RLS matrix, indexes
create extension if not exists pgtap with schema extensions;

begin;
select plan(43);

-- ── fixtures ──────────────────────────────────────────────────────────────
do $$
declare
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_other uuid := '22222222-2222-4222-8222-222222222222';
  v_admin uuid := '33333333-3333-4333-8333-333333333333';
  v_project uuid := '44444444-4444-4444-8444-444444444444';
  v_study uuid := '55555555-5555-4555-8555-555555555555';
  v_job uuid := '66666666-6666-4666-8666-666666666666';
  v_tradesperson uuid := '77777777-7777-4777-8777-777777777777';
  v_qr uuid := '88888888-8888-4888-8888-888888888888';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'p0db1-owner@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'p0db1-other@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'p0db1-admin@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now())
  on conflict (id) do nothing;

  -- INSERT does not fire prevent_role_self_escalation (UPDATE-only trigger).
  insert into public.profiles (id, email, role)
  values
    (v_owner, 'p0db1-owner@example.com', 'user'),
    (v_other, 'p0db1-other@example.com', 'user'),
    (v_admin, 'p0db1-admin@example.com', 'admin')
  on conflict (id) do nothing;

  insert into public.projects (
    id, user_id, name, address, postcode, region, property_type,
    bedrooms, bathrooms, size_sqm, purchase_price, estimated_gdv, estimate_done
  ) values (
    v_project, v_owner, 'P0-DB-1 Project', '1 Test St', 'SW1A 1AA', 'London', 'Flat',
    2, 1, 90, 250000, 400000, false
  ) on conflict (id) do update set user_id = excluded.user_id;

  -- feasibility study for share links (if table exists)
  if to_regclass('public.feasibility_studies') is not null then
    insert into public.feasibility_studies (id, project_id, user_id, status)
    values (v_study, v_project, v_owner, 'draft')
    on conflict (id) do nothing;
  end if;

  insert into public.share_links (
    id, token, study_id, owner_user_id, visibility, access_role, expires_at, revoked_at
  ) values
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'p0db1-public-valid-token',
      v_study,
      v_owner,
      'public',
      'investor',
      now() + interval '7 days',
      null
    ),
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      'p0db1-private-token',
      v_study,
      v_owner,
      'private',
      'investor',
      now() + interval '7 days',
      null
    ),
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      'p0db1-revoked-token',
      v_study,
      v_owner,
      'public',
      'investor',
      now() + interval '7 days',
      now() - interval '1 hour'
    ),
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
      'p0db1-expired-token',
      v_study,
      v_owner,
      'public',
      'investor',
      now() - interval '1 day',
      null
    )
  on conflict (id) do nothing;

  insert into public.trades_jobs (
    id, user_id, title, description, status, property_address, postcode,
    property_type, job_category, budget_min, budget_max
  ) values (
    v_job, v_owner, 'P0-DB-1 Job', 'desc', 'posted', '1 Test St', 'SW1A 1AA',
    'Flat', 'general', 1000, 2000
  ) on conflict (id) do nothing;

  insert into public.tradespeople (
    id, user_id, business_name, contact_name, postcode
  ) values (
    v_tradesperson, v_other, 'Other Trade Co', 'Other Trade', 'SW1A 1AA'
  ) on conflict (id) do nothing;

  insert into public.quote_requests (
    id, project_id, user_id, tradesperson_id, message, status
  ) values (
    v_qr, v_project, v_owner, v_tradesperson, 'hello', 'pending'
  ) on conflict (id) do nothing;
end $$;

-- ── trigger function security mode + grants ───────────────────────────────
select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='estimates_measured_header_integrity'),
  true,
  'estimates_measured_header_integrity remains SECURITY DEFINER'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='prevent_role_self_escalation'),
  true,
  'prevent_role_self_escalation remains SECURITY DEFINER'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='resolve_share_link'
     and pg_get_function_identity_arguments(p.oid)='p_token text'),
  false,
  'resolve_share_link is SECURITY INVOKER'
);

select ok(
  not has_function_privilege('anon', 'public.estimates_measured_header_integrity()', 'EXECUTE'),
  'anon cannot execute estimates_measured_header_integrity'
);
select ok(
  not has_function_privilege('authenticated', 'public.estimates_measured_header_integrity()', 'EXECUTE'),
  'authenticated cannot execute estimates_measured_header_integrity'
);
select ok(
  not has_function_privilege('anon', 'public.prevent_role_self_escalation()', 'EXECUTE'),
  'anon cannot execute prevent_role_self_escalation'
);
select ok(
  not has_function_privilege('authenticated', 'public.prevent_role_self_escalation()', 'EXECUTE'),
  'authenticated cannot execute prevent_role_self_escalation'
);

select ok(
  has_function_privilege('anon', 'public.resolve_share_link(text)', 'EXECUTE'),
  'anon can execute resolve_share_link'
);
select ok(
  has_function_privilege('authenticated', 'public.resolve_share_link(text)', 'EXECUTE'),
  'authenticated can execute resolve_share_link'
);

select ok(
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relname='estimates'
      and t.tgname='estimates_measured_header_integrity' and not t.tgisinternal
  ),
  'measured header integrity trigger remains attached'
);

select ok(
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relname='profiles'
      and t.tgname='trg_prevent_role_self_escalation' and not t.tgisinternal
  ),
  'role self-escalation trigger remains attached'
);

-- ── share link resolution ─────────────────────────────────────────────────
set local role anon;
select is(
  (select count(*)::int from public.resolve_share_link('p0db1-public-valid-token')),
  1,
  'anon resolves valid public share token'
);
select is(
  (select count(*)::int from public.resolve_share_link('p0db1-private-token')),
  0,
  'anon cannot resolve private share token'
);
select is(
  (select count(*)::int from public.resolve_share_link('p0db1-revoked-token')),
  0,
  'anon cannot resolve revoked share token'
);
select is(
  (select count(*)::int from public.resolve_share_link('p0db1-expired-token')),
  0,
  'anon cannot resolve expired share token'
);
select is(
  (select count(*)::int from public.resolve_share_link('p0db1-missing-token')),
  0,
  'anon invalid share token returns no rows'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (select count(*)::int from public.resolve_share_link('p0db1-public-valid-token')),
  1,
  'authenticated resolves valid public share token'
);
reset role;

-- ── policy cardinality (one per role/action for key tables) ───────────────
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='estimates' and cmd='SELECT' and 'authenticated'=any(roles)),
  1,
  'estimates: single authenticated SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='estimates' and cmd='INSERT' and 'authenticated'=any(roles)),
  1,
  'estimates: single authenticated INSERT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='estimate_items' and cmd='INSERT' and 'authenticated'=any(roles)),
  1,
  'estimate_items: single authenticated INSERT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='trade_messages' and cmd='INSERT' and 'authenticated'=any(roles)),
  1,
  'trade_messages: single authenticated INSERT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='trades_jobs' and cmd='SELECT' and 'anon'=any(roles)),
  1,
  'trades_jobs: single anon SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='tradespeople' and cmd='SELECT' and 'authenticated'=any(roles)),
  1,
  'tradespeople: single authenticated SELECT policy'
);

-- ── unwrapped auth.uid() absent in touched policies ───────────────────────
select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname='public'
      and tablename in (
        'estimates','estimate_rooms','estimate_items','trade_messages',
        'trades_job_interests','trades_jobs','tradespeople'
      )
      and (
        (coalesce(qual,'') ~ 'auth\.uid\(\)' and coalesce(qual,'') !~* '\(\s*select\s+auth\.uid\(\)')
        or (coalesce(with_check,'') ~ 'auth\.uid\(\)' and coalesce(with_check,'') !~* '\(\s*select\s+auth\.uid\(\)')
      )
  ),
  0,
  'touched policies have no bare auth.uid() outside select wrapper'
);

-- ── estimate draft write restrictions ─────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$
    insert into public.estimates (
      id, project_id, user_id, pricing_authority, pricing_policy_version, catalog_revision,
      region, condition_level, finish_level
    ) values (
      '99999999-9999-4999-8999-999999999901',
      '44444444-4444-4444-8444-444444444444',
      '11111111-1111-4111-8111-111111111111',
      'none', null, null,
      'London', 'Dated', 'Standard'
    )
  $$,
  'owner can insert draft estimate with authority none'
);

select throws_ok(
  $$
    insert into public.estimates (
      id, project_id, user_id, pricing_authority, pricing_policy_version, catalog_revision,
      region, condition_level, finish_level
    ) values (
      '99999999-9999-4999-8999-999999999902',
      '44444444-4444-4444-8444-444444444444',
      '11111111-1111-4111-8111-111111111111',
      'measured-boq-engine', 'v1', 'rev-1',
      'London', 'Dated', 'Standard'
    )
  $$,
  '42501',
  null,
  'owner cannot insert non-draft measured estimate via client RLS'
);

-- BEFORE trigger may fire first (P0001); RLS WITH CHECK also denies (42501).
select throws_ok(
  $$
    insert into public.estimate_items (
      id, estimate_id, user_id, name, quantity, unit_cost, category, unit,
      rate_source, rate_key, catalog_revision, base_unit_rate, regional_multiplier, resolved_unit_rate
    ) values (
      '99999999-9999-4999-8999-999999999903',
      '99999999-9999-4999-8999-999999999901',
      '11111111-1111-4111-8111-111111111111',
      'Item', 1, 10, 'Kitchen', 'nr',
      'library', 'rk', 'rev-1', 10, 1, 10
    )
  $$,
  'P0001',
  'PROVENANCE_FORBIDDEN_FOR_AUTHORITY',
  'client cannot inject measured provenance on estimate_items'
);
reset role;

-- ── trade message sender spoof prevention ─────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$
    insert into public.trade_messages (
      id, quote_request_id, sender_id, content
    ) values (
      '99999999-9999-4999-8999-999999999904',
      '88888888-8888-4888-8888-888888888888',
      '22222222-2222-4222-8222-222222222222',
      'spoof'
    )
  $$,
  '42501',
  null,
  'participant cannot insert trade_message with foreign sender_id'
);

select lives_ok(
  $$
    insert into public.trade_messages (
      id, quote_request_id, sender_id, content
    ) values (
      '99999999-9999-4999-8999-999999999905',
      '88888888-8888-4888-8888-888888888888',
      '11111111-1111-4111-8111-111111111111',
      'ok'
    )
  $$,
  'participant can insert trade_message as self'
);
reset role;

-- ── trades_jobs visibility ────────────────────────────────────────────────
set local role anon;
select ok(
  exists (select 1 from public.trades_jobs where id = '66666666-6666-4666-8666-666666666666'),
  'anon can select posted trades_jobs'
);
select throws_ok(
  $$
    insert into public.trades_jobs (id, user_id, title, description, status)
    values (
      '99999999-9999-4999-8999-999999999906',
      '11111111-1111-4111-8111-111111111111',
      'x', 'y', 'posted'
    )
  $$,
  '42501',
  null,
  'anon cannot insert trades_jobs'
);
reset role;

-- ── internal table deny ───────────────────────────────────────────────────
set local role anon;
select throws_ok(
  $$ select count(*) from public.estimate_authority_idempotency $$,
  '42501',
  null,
  'anon denied on estimate_authority_idempotency'
);
select throws_ok(
  $$ select count(*) from public.measured_boq_catalog_entries $$,
  '42501',
  null,
  'anon denied on measured_boq_catalog_entries'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$ select count(*) from public.measured_boq_catalog_packages $$,
  '42501',
  null,
  'authenticated denied on measured_boq_catalog_packages'
);
select throws_ok(
  $$ select count(*) from public.measured_boq_catalog_revisions $$,
  '42501',
  null,
  'authenticated denied on measured_boq_catalog_revisions'
);
select throws_ok(
  $$ select count(*) from public.measured_boq_catalog_events $$,
  '42501',
  null,
  'authenticated denied on measured_boq_catalog_events'
);
reset role;

-- service_role can read internal tables (bypass / grants)
set local role service_role;
select lives_ok(
  $$ select count(*) from public.estimate_authority_idempotency $$,
  'service_role can access estimate_authority_idempotency'
);
reset role;

-- ── indexes present ───────────────────────────────────────────────────────
select ok(
  exists (select 1 from pg_indexes where schemaname='public' and indexname='estimate_items_catalog_revision_rate_key_idx'),
  'index estimate_items_catalog_revision_rate_key_idx exists'
);
select ok(
  exists (select 1 from pg_indexes where schemaname='public' and indexname='estimates_catalog_revision_idx'),
  'index estimates_catalog_revision_idx exists'
);
select ok(
  exists (select 1 from pg_indexes where schemaname='public' and indexname='measured_boq_catalog_events_package_id_idx'),
  'index measured_boq_catalog_events_package_id_idx exists'
);
select ok(
  exists (select 1 from pg_indexes where schemaname='public' and indexname='measured_boq_catalog_events_prior_revision_id_idx'),
  'index measured_boq_catalog_events_prior_revision_id_idx exists'
);

-- ── prevent role escalation still works via trigger ───────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  null,
  'non-admin cannot escalate profiles.role'
);
reset role;

-- ── internal deny policy presence ─────────────────────────────────────────
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='estimate_authority_idempotency'),
  2,
  'estimate_authority_idempotency has deny policies for anon+authenticated'
);

select * from finish();
rollback;
