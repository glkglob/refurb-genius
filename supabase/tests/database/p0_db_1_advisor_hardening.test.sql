-- P0-DB-1 / P0-DB-1R — Security DEFINER grants, exact-token share link,
-- append-only trade messages, RLS matrix, indexes
create extension if not exists pgtap with schema extensions;

begin;
select plan(64);

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
  'public.resolve_share_link is SECURITY INVOKER'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='private' and p.proname='resolve_share_link_exact'
     and pg_get_function_identity_arguments(p.oid)='p_token text'),
  true,
  'private.resolve_share_link_exact is SECURITY DEFINER'
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
  'anon can execute public.resolve_share_link'
);
select ok(
  has_function_privilege('authenticated', 'public.resolve_share_link(text)', 'EXECUTE'),
  'authenticated can execute public.resolve_share_link'
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

-- Private helper is not in public namespace (Data API RPC surface).
select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'resolve_share_link_exact'
  ),
  'private helper is not exposed as public.resolve_share_link_exact'
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
select is(
  (select count(*)::int from public.resolve_share_link('')),
  0,
  'anon empty share token returns no rows'
);
-- Direct table access: no enumerable public SELECT for anon
select is(
  (select count(*)::int from public.share_links),
  0,
  'anon direct share_links SELECT returns no rows'
);
-- Wrapper returns only limited columns (no token column in result type).
select is(
  (
    select count(*)::int
    from (
      select id, study_id, visibility, access_role, expires_at, owner_user_id
      from public.resolve_share_link('p0db1-public-valid-token')
    ) r
  ),
  1,
  'public wrapper returns only limited columns (no token)'
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
-- Non-owner authenticated cannot enumerate owner public links via table SELECT
select is(
  (select count(*)::int from public.share_links
   where token = 'p0db1-public-valid-token'),
  0,
  'authenticated non-owner cannot enumerate public share_links by table SELECT'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select ok(
  exists (
    select 1 from public.share_links
    where token = 'p0db1-public-valid-token'
      and owner_user_id = '11111111-1111-4111-8111-111111111111'
  ),
  'owner can SELECT own share_links rows'
);
reset role;

-- ── policy cardinality ────────────────────────────────────────────────────
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
   where schemaname='public' and tablename='trade_messages' and cmd='SELECT' and 'authenticated'=any(roles)),
  1,
  'trade_messages: single authenticated SELECT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='trade_messages' and cmd='INSERT' and 'authenticated'=any(roles)),
  1,
  'trade_messages: single authenticated INSERT policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='trade_messages' and cmd='UPDATE'),
  0,
  'trade_messages: zero UPDATE policies'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='trade_messages' and cmd='DELETE'),
  0,
  'trade_messages: zero DELETE policies'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='trades_jobs' and cmd='SELECT' and 'anon'=any(roles)),
  0,
  'trades_jobs: zero anon SELECT policies (public projection via RPC only)'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='tradespeople' and cmd='SELECT' and 'authenticated'=any(roles)),
  1,
  'tradespeople: single authenticated SELECT policy'
);

-- ── trade_messages privileges (append-only) ───────────────────────────────
select ok(
  not has_table_privilege('authenticated', 'public.trade_messages', 'UPDATE'),
  'authenticated has no UPDATE on trade_messages'
);
select ok(
  not has_table_privilege('authenticated', 'public.trade_messages', 'DELETE'),
  'authenticated has no DELETE on trade_messages'
);
select ok(
  not has_table_privilege('anon', 'public.trade_messages', 'SELECT'),
  'anon has no SELECT on trade_messages'
);

-- ── unwrapped auth.uid() absent in touched policies ───────────────────────
select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname='public'
      and tablename in (
        'estimates','estimate_rooms','estimate_items','trade_messages',
        'trades_job_interests','trades_jobs','tradespeople','share_links'
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

-- ── trade message sender spoof + append-only ──────────────────────────────
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

select throws_ok(
  $$
    update public.trade_messages
    set content = 'edited'
    where id = '99999999-9999-4999-8999-999999999905'
  $$,
  '42501',
  null,
  'authenticated cannot UPDATE trade_messages (append-only)'
);

select throws_ok(
  $$
    delete from public.trade_messages
    where id = '99999999-9999-4999-8999-999999999905'
  $$,
  '42501',
  null,
  'authenticated cannot DELETE trade_messages (append-only)'
);
reset role;

-- ── trades_jobs visibility (TRADES-PRIVACY-R1B: base denied; public RPC OK) ─
set local role anon;
select throws_ok(
  $$ select 1 from public.trades_jobs where id = '66666666-6666-4666-8666-666666666666' $$,
  '42501',
  null,
  'anon cannot select posted trades_jobs base rows'
);
select ok(
  exists (
    select 1 from public.list_public_posted_trades_jobs(null, null)
    where id = '66666666-6666-4666-8666-666666666666'
  ),
  'anon can list posted trades_jobs via public RPC'
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

-- ── prevent role escalation ───────────────────────────────────────────────
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

-- ── internal deny: exactly one policy per table ───────────────────────────
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='estimate_authority_idempotency'),
  1,
  'estimate_authority_idempotency has exactly one deny policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='measured_boq_catalog_entries'),
  1,
  'measured_boq_catalog_entries has exactly one deny policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='measured_boq_catalog_events'),
  1,
  'measured_boq_catalog_events has exactly one deny policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='measured_boq_catalog_packages'),
  1,
  'measured_boq_catalog_packages has exactly one deny policy'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='measured_boq_catalog_revisions'),
  1,
  'measured_boq_catalog_revisions has exactly one deny policy'
);

select is(
  (
    select count(*)::int from pg_policies
    where schemaname='public'
      and tablename='estimate_authority_idempotency'
      and policyname='estimate_authority_idempotency_deny_clients'
      and 'anon'=any(roles)
      and 'authenticated'=any(roles)
      and cmd='ALL'
  ),
  1,
  'estimate_authority_idempotency deny targets anon+authenticated FOR ALL'
);

select * from finish();
rollback;
