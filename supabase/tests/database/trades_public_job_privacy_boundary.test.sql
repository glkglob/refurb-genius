-- TRADES-PRIVACY-R1B — public job data boundary
create extension if not exists pgtap with schema extensions;

begin;
select plan(26);

-- ── fixtures ──────────────────────────────────────────────────────────────
do $$
declare
  v_owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_other uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'privacy-owner@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'privacy-other@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now())
  on conflict (id) do nothing;

  insert into public.trades_jobs (
    id, user_id, title, description, status,
    property_address, postcode, property_type, job_category,
    budget_min, budget_max
  ) values
    (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      v_owner,
      'Posted privacy fixture',
      'Public description',
      'posted',
      '12 High Street',
      'W14 8AB',
      'Flat',
      'electrical',
      100, 250
    ),
    (
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      v_owner,
      'Draft privacy fixture',
      'Draft body',
      'draft',
      '99 Secret Road',
      'SW6 2XX',
      'Terraced',
      'plumbing',
      null, null
    ),
    (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      v_owner,
      'Closed privacy fixture',
      'Closed body',
      'closed',
      '1 Closed Lane',
      'LS1 4AB',
      'Detached',
      'decorating',
      null, null
    )
  on conflict (id) do nothing;
end $$;

-- ── Function security ─────────────────────────────────────────────────────
select is(
  (select prosecdef::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'list_public_posted_trades_jobs'),
  1,
  'list_public_posted_trades_jobs is SECURITY DEFINER'
);

select is(
  (select prosecdef::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_public_posted_trades_job'),
  1,
  'get_public_posted_trades_job is SECURITY DEFINER'
);

select is(
  (
    select unnest(p.proconfig)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_public_posted_trades_jobs'
    limit 1
  ),
  'search_path=""',
  'list_public_posted_trades_jobs search_path is empty string'
);

select is(
  (
    select unnest(p.proconfig)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_public_posted_trades_job'
    limit 1
  ),
  'search_path=""',
  'get_public_posted_trades_job search_path is empty string'
);

select ok(
  (select r.rolname not in ('anon', 'authenticated')
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   join pg_roles r on r.oid = p.proowner
   where n.nspname = 'public' and p.proname = 'list_public_posted_trades_jobs'),
  'list_public_posted_trades_jobs not owned by customer roles'
);

select ok(
  has_function_privilege('anon', 'public.list_public_posted_trades_jobs(text, uuid[])', 'EXECUTE'),
  'anon can EXECUTE list_public_posted_trades_jobs'
);

select ok(
  has_function_privilege('authenticated', 'public.get_public_posted_trades_job(uuid)', 'EXECUTE'),
  'authenticated can EXECUTE get_public_posted_trades_job'
);

-- ── Grants ────────────────────────────────────────────────────────────────
select ok(
  not has_table_privilege('anon', 'public.trades_jobs', 'SELECT'),
  'anon has no SELECT on trades_jobs'
);

select ok(
  has_table_privilege('authenticated', 'public.trades_jobs', 'SELECT'),
  'authenticated retains SELECT on trades_jobs (RLS owner-only)'
);

select ok(
  not has_table_privilege('authenticated', 'public.trades_jobs', 'TRUNCATE'),
  'authenticated has no TRUNCATE on trades_jobs'
);

select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='trades_jobs' and cmd='SELECT' and 'anon'=any(roles)),
  0,
  'trades_jobs: zero anon SELECT policies'
);

-- ── Outward postcode helper ───────────────────────────────────────────────
select is(public.trades_job_outward_postcode('W14 8AB'), 'W14', 'outward spaced W14');
select is(public.trades_job_outward_postcode('sw6 2xx'), 'SW6', 'outward lowercase SW6');
select is(public.trades_job_outward_postcode('W148AB'), 'W14', 'outward compact W14');
select is(public.trades_job_outward_postcode(null), null, 'outward null');
select is(public.trades_job_outward_postcode('!!!'), null, 'outward malformed null');

-- ── Anon base denied / public RPC works ───────────────────────────────────
set local role anon;
select throws_ok(
  $$ select 1 from public.trades_jobs where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' $$,
  '42501',
  null,
  'anon base SELECT denied on trades_jobs'
);

select is(
  (select count(*)::int from public.list_public_posted_trades_jobs(null, null)
   where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  1,
  'anon public list sees posted job'
);

select is(
  (select outward_postcode from public.list_public_posted_trades_jobs(null, null)
   where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  'W14',
  'anon public list returns outward only'
);

select is(
  (select count(*)::int from public.list_public_posted_trades_jobs(null, null)
   where id in (
     'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
     'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
   )),
  0,
  'anon public list hides draft and closed'
);

select is(
  (select count(*)::int from public.get_public_posted_trades_job('cccccccc-cccc-4ccc-8ccc-cccccccccccc')),
  1,
  'anon public detail returns posted job'
);

select is(
  (select count(*)::int from public.get_public_posted_trades_job('dddddddd-dddd-4ddd-8ddd-dddddddddddd')),
  0,
  'anon public detail hides draft'
);
reset role;

-- ── Authenticated non-owner base denied; public works ─────────────────────
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::int from public.trades_jobs where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  0,
  'non-owner base SELECT cannot read others posted job'
);

select is(
  (select count(*)::int from public.list_public_posted_trades_jobs(null, array['cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid])),
  1,
  'non-owner public list by ids works'
);
reset role;

-- ── Owner full private access ─────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select property_address from public.trades_jobs where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  '12 High Street',
  'owner base SELECT retains full address'
);

select is(
  (select postcode from public.trades_jobs where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  'W14 8AB',
  'owner base SELECT retains full postcode'
);
reset role;

select * from finish();
rollback;
