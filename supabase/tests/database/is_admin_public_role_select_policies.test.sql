-- PUBLIC-BETA-OBS2-IS-ADMIN-SSR-RLS
-- Policy metadata + behaviour for residual PUBLIC-role is_admin SELECT repair.
create extension if not exists pgtap with schema extensions;

begin;
select plan(33);

-- ── fixtures ──────────────────────────────────────────────────────────────
do $$
declare
  v_owner uuid := 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
  v_other uuid := 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';
  v_admin uuid := 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3';
  v_project uuid := 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4';
  v_project_other uuid := 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5';
  v_photo uuid := 'f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6';
  v_gallery_public uuid := '17171717-1717-4171-8171-171717171717';
  v_gallery_private uuid := '18181818-1818-4181-8181-181818181818';
  v_analysis uuid := '19191919-1919-4191-8191-191919191919';
  v_study uuid := '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a';
  v_snapshot uuid := '1b1b1b1b-1b1b-41b1-81b1-1b1b1b1b1b1b';
  v_export uuid := '1c1c1c1c-1c1c-41c1-81c1-1c1c1c1c1c1c';
  v_lead uuid := '1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1d';
  v_has_created_by boolean;
  v_has_user_id boolean;
  v_has_is_published boolean;
  v_sql text;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'obs2-owner@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'obs2-other@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'obs2-admin@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now())
  on conflict (id) do nothing;

  -- Bypass role-escalation guard for fixture seed only (superuser test harness).
  alter table public.profiles disable trigger trg_prevent_role_self_escalation;

  insert into public.profiles (id, email, role)
  values
    (v_owner, 'obs2-owner@example.com', 'user'),
    (v_other, 'obs2-other@example.com', 'user'),
    (v_admin, 'obs2-admin@example.com', 'admin')
  on conflict (id) do update
    set email = excluded.email,
        role = excluded.role;

  alter table public.profiles enable trigger trg_prevent_role_self_escalation;

  insert into public.projects (
    id, user_id, name, address, postcode, region, property_type
  ) values
    (v_project, v_owner, 'OBS2 Owner Project', '1 Test St', 'SW1A 1AA', 'London', 'Flat'),
    (v_project_other, v_other, 'OBS2 Other Project', '2 Other St', 'E1 1AA', 'London', 'House')
  on conflict (id) do update set user_id = excluded.user_id;

  insert into public.photos (
    id, project_id, user_id, storage_path, url, name, size
  ) values (
    v_photo, v_project, v_owner, 'obs2/photo.jpg', 'https://example.com/obs2.jpg', 'obs2.jpg', 100
  ) on conflict (id) do nothing;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_gallery_projects'
      and column_name = 'created_by'
  ) into v_has_created_by;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_gallery_projects'
      and column_name = 'is_published'
  ) into v_has_is_published;

  -- Public + private gallery rows for the owner project / other project.
  if v_has_created_by and v_has_is_published then
    insert into public.public_gallery_projects (
      id, project_id, is_public, is_published, featured, title, created_by, view_count
    ) values
      (v_gallery_public, v_project, true, true, false, 'OBS2 Public Gallery', v_owner, 0),
      (v_gallery_private, v_project_other, false, false, false, 'OBS2 Private Gallery', v_other, 0)
    on conflict (id) do update
      set is_public = excluded.is_public,
          is_published = excluded.is_published,
          created_by = excluded.created_by;
  elsif v_has_created_by then
    insert into public.public_gallery_projects (
      id, project_id, is_public, featured, title, created_by, view_count
    ) values
      (v_gallery_public, v_project, true, false, 'OBS2 Public Gallery', v_owner, 0),
      (v_gallery_private, v_project_other, false, false, 'OBS2 Private Gallery', v_other, 0)
    on conflict (id) do update
      set is_public = excluded.is_public,
          created_by = excluded.created_by;
  else
    insert into public.public_gallery_projects (
      id, project_id, is_public, featured, title, view_count
    ) values
      (v_gallery_public, v_project, true, false, 'OBS2 Public Gallery', 0),
      (v_gallery_private, v_project_other, false, false, 'OBS2 Private Gallery', 0)
    on conflict (id) do update
      set is_public = excluded.is_public;
  end if;

  -- photo_analysis_results: live uses created_by; migration-chain uses user_id.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'photo_analysis_results'
      and column_name = 'created_by'
  ) into v_has_created_by;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'photo_analysis_results'
      and column_name = 'user_id'
  ) into v_has_user_id;

  if v_has_created_by then
    v_sql := format(
      'insert into public.photo_analysis_results (
         id, project_id, photo_id, created_by, condition_report, confidence_score
       ) values (%L, %L, %L, %L, %L, %s)
       on conflict (id) do nothing',
      v_analysis, v_project, v_photo, v_owner, 'obs2 condition', 0.9
    );
    execute v_sql;
  elsif v_has_user_id then
    insert into public.photo_analysis_results (
      id, project_id, photo_id, user_id, analysis_data, confidence
    ) values (
      v_analysis, v_project, v_photo, v_owner, '{}'::jsonb, 0.9
    ) on conflict (id) do nothing;
  end if;

  if to_regclass('public.feasibility_studies') is not null then
    insert into public.feasibility_studies (id, project_id, user_id, status, title)
    values (v_study, v_project, v_owner, 'draft', 'OBS2 Study')
    on conflict (id) do nothing;

    insert into public.study_snapshots (id, study_id, version, snapshot, created_by)
    values (v_snapshot, v_study, 1, '{"ok":true}'::jsonb, v_owner)
    on conflict (id) do nothing;

    insert into public.study_exports (id, study_id, user_id, export_type, status)
    values (v_export, v_study, v_owner, 'feasibility-study', 'queued')
    on conflict (id) do nothing;
  end if;

  insert into public.investor_leads (id, gallery_project_id, name, email, message)
  values (v_lead, v_gallery_public, 'Lead', 'lead@example.com', 'hello')
  on conflict (id) do nothing;
end $$;

-- ── Function privilege contract (must remain unchanged) ───────────────────
select is(
  has_function_privilege('anon', 'public.is_admin()', 'EXECUTE'),
  false,
  'anon cannot EXECUTE is_admin()'
);

select is(
  has_function_privilege('public', 'public.is_admin()', 'EXECUTE'),
  false,
  'public role cannot EXECUTE is_admin()'
);

select is(
  has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE'),
  true,
  'authenticated can EXECUTE is_admin()'
);

-- ── Policy metadata: zero PUBLIC-role SELECT policies calling is_admin ────
select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and 'public' = any (roles)
      and coalesce(qual, '') ilike '%is_admin%'
  ),
  0,
  'zero SELECT policies remain with role public and is_admin() in USING'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and 'anon' = any (roles)
      and coalesce(qual, '') ilike '%is_admin%'
  ),
  0,
  'zero SELECT policies remain with role anon and is_admin() in USING'
);

-- Six private live/residual policies target authenticated when present
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in (
        'feasibility_studies',
        'investor_leads',
        'photo_analysis_results',
        'profiles',
        'study_exports',
        'study_snapshots'
      )
      and policyname in (
        'feasibility_studies_select_public',
        'investor_leads_select_public',
        'photo_analysis_results_select_public',
        'profiles_select_public',
        'study_exports_select_public',
        'study_snapshots_select_public',
        'feasibility_studies_select_admin',
        'investor_leads_select_admin',
        'photo_analysis_results_select_admin',
        'profiles_select_admin',
        'study_exports_select_admin',
        'study_snapshots_select_admin'
      )
      and (
        'public' = any (roles)
        or 'anon' = any (roles)
      )
  ),
  'six private residual is_admin SELECT policies are not public/anon-scoped'
);

-- Gallery split
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'public_gallery_projects'
      and policyname = 'public_gallery_projects_select_anon'
      and cmd = 'SELECT'
      and roles = array['anon']::name[]
  ),
  'public_gallery_projects has distinct anon SELECT policy'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'public_gallery_projects'
      and policyname = 'public_gallery_projects_select_authenticated'
      and cmd = 'SELECT'
      and roles = array['authenticated']::name[]
  ),
  'public_gallery_projects has distinct authenticated SELECT policy'
);

select ok(
  (
    select coalesce(qual, '') not ilike '%is_admin%'
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_gallery_projects'
      and policyname = 'public_gallery_projects_select_anon'
  ),
  'anon gallery predicate contains no is_admin()'
);

select ok(
  (
    select coalesce(qual, '') ilike '%is_admin%'
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_gallery_projects'
      and policyname = 'public_gallery_projects_select_authenticated'
  ),
  'authenticated gallery predicate retains is_admin()'
);

-- ── Anon behaviour ────────────────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select lives_ok(
  $$select count(*) from public.public_gallery_projects$$,
  'anon SELECT public_gallery_projects does not raise is_admin permission error'
);

select ok(
  exists (
    select 1 from public.public_gallery_projects
    where id = '17171717-1717-4171-8171-171717171717'
  ),
  'anon can read public gallery row'
);

select ok(
  not exists (
    select 1 from public.public_gallery_projects
    where id = '18181818-1818-4181-8181-181818181818'
  ),
  'anon cannot read private gallery row'
);

select lives_ok(
  $$select count(*) from public.photo_analysis_results$$,
  'anon SELECT photo_analysis_results does not raise is_admin permission error'
);

select is(
  (select count(*)::int from public.photo_analysis_results
   where id = '19191919-1919-4191-8191-191919191919'),
  0,
  'anon cannot read private photo_analysis_results row'
);

select lives_ok(
  $$select count(*) from public.profiles$$,
  'anon SELECT profiles does not raise is_admin permission error'
);

select is(
  (select count(*)::int from public.profiles
   where id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'),
  0,
  'anon cannot read private profile rows'
);

select lives_ok(
  $$select count(*) from public.investor_leads$$,
  'anon SELECT investor_leads does not raise is_admin permission error'
);

select is(
  (select count(*)::int from public.investor_leads
   where id = '1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1d'),
  0,
  'anon cannot read investor_leads rows'
);

select lives_ok(
  $$select count(*) from public.feasibility_studies$$,
  'anon SELECT feasibility_studies does not raise is_admin permission error'
);

select is(
  (select count(*)::int from public.feasibility_studies
   where id = '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a'),
  0,
  'anon cannot read feasibility_studies private rows'
);

select lives_ok(
  $$select count(*) from public.study_exports$$,
  'anon SELECT study_exports does not raise is_admin permission error'
);

select lives_ok(
  $$select count(*) from public.study_snapshots$$,
  'anon SELECT study_snapshots does not raise is_admin permission error'
);

reset role;

-- ── Authenticated owner behaviour ─────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  exists (
    select 1 from public.profiles
    where id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
  ),
  'owner can SELECT own profile'
);

select ok(
  exists (
    select 1 from public.public_gallery_projects
    where id = '17171717-1717-4171-8171-171717171717'
  ),
  'owner can SELECT own public_gallery_projects row'
);

select ok(
  exists (
    select 1 from public.photo_analysis_results
    where id = '19191919-1919-4191-8191-191919191919'
  ),
  'owner can SELECT own photo_analysis_results row'
);

-- ── Cross-user denial ─────────────────────────────────────────────────────
select ok(
  not exists (
    select 1 from public.profiles
    where id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'
  ),
  'owner cannot SELECT other user profile'
);

select ok(
  not exists (
    select 1 from public.public_gallery_projects
    where id = '18181818-1818-4181-8181-181818181818'
  ),
  'owner cannot SELECT other private gallery row'
);

select ok(
  not exists (
    select 1 from public.photo_analysis_results par
    join public.projects p on p.id = par.project_id
    where p.user_id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'
  ),
  'owner cannot SELECT other-user photo_analysis_results'
);

reset role;

-- ── Authenticated admin SELECT remains valid ──────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  public.is_admin(),
  'admin fixture is_admin() returns true'
);

select ok(
  exists (
    select 1 from public.profiles
    where id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
  ),
  'authenticated admin can SELECT other profiles via admin path'
);

select ok(
  exists (
    select 1 from public.photo_analysis_results
    where id = '19191919-1919-4191-8191-191919191919'
  ),
  'authenticated admin can SELECT photo_analysis_results via admin path'
);

select ok(
  exists (
    select 1 from public.public_gallery_projects
    where id = '18181818-1818-4181-8181-181818181818'
  ),
  'authenticated admin can SELECT private gallery via admin path'
);

reset role;

select * from finish();
rollback;
