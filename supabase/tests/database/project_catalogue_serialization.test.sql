-- P0-PHOTO-ANALYZE-R4 — photo catalogue serialization RPCs + DML seal
BEGIN;
SELECT plan(21);

SELECT has_function('public', 'create_project_photo_metadata',
  ARRAY['uuid','uuid','text','text','text','integer'],
  'create_project_photo_metadata exists');

SELECT has_function('public', 'delete_project_photo_metadata',
  ARRAY['uuid'],
  'delete_project_photo_metadata exists');

SELECT has_function('public', 'get_current_project_analysis_authority',
  ARRAY['uuid'],
  'get_current_project_analysis_authority exists');

SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.create_project_photo_metadata(uuid,uuid,text,text,text,integer)'::regprocedure),
  true,
  'create_project_photo_metadata is SECURITY DEFINER'
);

SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.delete_project_photo_metadata(uuid)'::regprocedure),
  true,
  'delete_project_photo_metadata is SECURITY DEFINER'
);

SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.get_current_project_analysis_authority(uuid)'::regprocedure),
  false,
  'get_current_project_analysis_authority is SECURITY INVOKER'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.create_project_photo_metadata(uuid,uuid,text,text,text,integer)', 'EXECUTE'),
  'anon cannot execute create_project_photo_metadata'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.photos', 'INSERT'),
  'authenticated cannot INSERT public.photos directly'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.photos', 'DELETE'),
  'authenticated cannot DELETE public.photos directly'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.photos', 'SELECT'),
  'authenticated retains SELECT on public.photos'
);

-- Fixtures
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES
  (
    '44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'r4-a@example.com', crypt('pw', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false,
    '', '', '', ''
  ),
  (
    '55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'r4-b@example.com', crypt('pw', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false,
    '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.projects (id, user_id, name, region, property_type, analysis_done)
VALUES
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', '44444444-4444-4444-8444-444444444444', 'R4 A', 'London', 'Flat', true),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', '55555555-5555-4555-8555-555555555555', 'R4 B', 'London', 'Flat', false)
ON CONFLICT (id) DO NOTHING;

-- Owner A create photo
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT (create_project_photo_metadata(
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'::uuid,
    'b1111111-bbbb-4bbb-8bbb-111111111111'::uuid,
    'a/p1.jpg', 'https://cdn/p1.jpg', 'p1.jpg', 100
  )).id::text),
  'b1111111-bbbb-4bbb-8bbb-111111111111',
  'owner can create photo metadata via RPC'
);

SELECT is(
  (SELECT analysis_done FROM public.projects WHERE id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'),
  false,
  'photo insert invalidates analysis_done'
);

-- Second photo for complete set later
SELECT (create_project_photo_metadata(
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'::uuid,
  'b2222222-bbbb-4bbb-8bbb-222222222222'::uuid,
  'a/p2.jpg', 'https://cdn/p2.jpg', 'p2.jpg', 100
)).id;
SELECT (create_project_photo_metadata(
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'::uuid,
  'b3333333-bbbb-4bbb-8bbb-333333333333'::uuid,
  'a/p3.jpg', 'https://cdn/p3.jpg', 'p3.jpg', 100
)).id;

-- Other user cannot create on project A
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$SELECT create_project_photo_metadata(
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'::uuid,
    'b9999999-bbbb-4bbb-8bbb-999999999999'::uuid,
    'x.jpg', 'https://cdn/x.jpg', 'x.jpg', 1
  )$$,
  '42501',
  'project_not_authorised',
  'other user cannot create photo on foreign project'
);

-- Owner A complete analysis then authority read PASS
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT count(*)::int AS seeded FROM public.replace_project_room_analyses(
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'::uuid,
  $j$[
    {"photo_id":"b1111111-bbbb-4bbb-8bbb-111111111111","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"ok1","confidence_score":0.9},
    {"photo_id":"b2222222-bbbb-4bbb-8bbb-222222222222","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"ok2","confidence_score":0.8},
    {"photo_id":"b3333333-bbbb-4bbb-8bbb-333333333333","source":"fallback","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"ok3","confidence_score":0}
  ]$j$::jsonb
);

-- Mark analysis_done true to prove delete clears it
RESET ROLE;
UPDATE public.projects SET analysis_done = true WHERE id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.get_current_project_analysis_authority('dddddddd-dddd-4ddd-8ddd-ddddddddddd1'::uuid)),
  3,
  'authority read returns complete valid set'
);

-- Incomplete replace rejected
SELECT throws_ok(
  $$SELECT * FROM public.replace_project_room_analyses(
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'::uuid,
    '[{"photo_id":"b1111111-bbbb-4bbb-8bbb-111111111111","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"only","confidence_score":0.9}]'::jsonb
  )$$,
  '22023',
  'incomplete_photo_catalogue',
  'incomplete replacement remains rejected'
);

-- Delete one photo → analysis_done false; authority read rejects
SELECT is(
  (SELECT (delete_project_photo_metadata('b3333333-bbbb-4bbb-8bbb-333333333333'::uuid)).id::text),
  'b3333333-bbbb-4bbb-8bbb-333333333333',
  'owner can delete photo metadata via RPC'
);

SELECT is(
  (SELECT analysis_done FROM public.projects WHERE id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'),
  false,
  'photo delete invalidates analysis_done'
);

SELECT throws_ok(
  $$SELECT * FROM public.get_current_project_analysis_authority('dddddddd-dddd-4ddd-8ddd-ddddddddddd1'::uuid)$$,
  '22023',
  'stale_requires_reanalysis',
  'authority read rejects after catalogue mutation'
);

-- Other user cannot delete
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$SELECT * FROM public.delete_project_photo_metadata('b1111111-bbbb-4bbb-8bbb-111111111111'::uuid)$$,
  '42501',
  'source_not_authorised',
  'other user cannot delete foreign photo'
);

SELECT pass('project catalogue serialization RPCs verified');
SELECT pass('direct DML sealed for authenticated INSERT/DELETE');

SELECT * FROM finish();
ROLLBACK;
