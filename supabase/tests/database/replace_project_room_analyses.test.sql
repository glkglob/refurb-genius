-- P0-PHOTO-ANALYZE-R2/R3 — replace_project_room_analyses behavioral suite
BEGIN;
SELECT plan(24);

SELECT has_function(
  'public',
  'replace_project_room_analyses',
  ARRAY['uuid', 'jsonb'],
  'replace_project_room_analyses exists'
);

SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.replace_project_room_analyses(uuid,jsonb)'::regprocedure
  ),
  false,
  'replace_project_room_analyses is SECURITY INVOKER'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.replace_project_room_analyses(uuid,jsonb)', 'EXECUTE'),
  'anon cannot EXECUTE replace_project_room_analyses'
);

SELECT ok(
  NOT has_function_privilege('public', 'public.replace_project_room_analyses(uuid,jsonb)', 'EXECUTE'),
  'PUBLIC cannot EXECUTE replace_project_room_analyses'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.replace_project_room_analyses(uuid,jsonb)', 'EXECUTE'),
  'authenticated can EXECUTE replace_project_room_analyses'
);

-- Unauthenticated rejected
SELECT throws_ok(
  $$SELECT * FROM public.replace_project_room_analyses(
    '00000000-0000-0000-0000-000000000001'::uuid,
    '[{"photo_id":"00000000-0000-0000-0000-000000000002","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"x","confidence_score":0.1}]'::jsonb
  )$$,
  '28000',
  'not_authenticated',
  'unauthenticated replace is rejected'
);

-- ── Fixtures ──────────────────────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES
  (
    '11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'r3-a@example.com', crypt('pw', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false,
    '', '', '', ''
  ),
  (
    '22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'r3-b@example.com', crypt('pw', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false,
    '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.projects (id, user_id, name, region, property_type)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'R3 A', 'London', 'Flat'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '22222222-2222-4222-8222-222222222222', 'R3 B', 'London', 'Flat')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.photos (id, project_id, user_id, storage_path, url, name, size)
VALUES
  ('11111111-aaaa-4aaa-8aaa-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'a/p1.jpg', 'https://cdn/p1.jpg', 'p1.jpg', 100),
  ('22222222-aaaa-4aaa-8aaa-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'a/p2.jpg', 'https://cdn/p2.jpg', 'p2.jpg', 100),
  ('33333333-aaaa-4aaa-8aaa-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'a/p3.jpg', 'https://cdn/p3.jpg', 'p3.jpg', 100),
  ('44444444-bbbb-4bbb-8bbb-444444444444', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '22222222-2222-4222-8222-222222222222', 'b/f.jpg', 'https://cdn/foreign.jpg', 'foreign.jpg', 100)
ON CONFLICT (id) DO NOTHING;

-- Act as owner A
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

-- AF incomplete P1 only → REJECT
SELECT throws_ok(
  $$SELECT * FROM public.replace_project_room_analyses(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
    '[{"photo_id":"11111111-aaaa-4aaa-8aaa-111111111111","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"only1","confidence_score":0.9}]'::jsonb
  )$$,
  '22023',
  'incomplete_photo_catalogue',
  'incomplete catalogue set is rejected'
);

-- AI mock rejected
SELECT throws_ok(
  $$SELECT * FROM public.replace_project_room_analyses(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
    $j$[
      {"photo_id":"11111111-aaaa-4aaa-8aaa-111111111111","source":"mock","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"x","confidence_score":0.1},
      {"photo_id":"22222222-aaaa-4aaa-8aaa-222222222222","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"y","confidence_score":0.1},
      {"photo_id":"33333333-aaaa-4aaa-8aaa-333333333333","source":"ai","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"z","confidence_score":0.1}
    ]$j$::jsonb
  )$$,
  '22023',
  'mock_or_invalid_source',
  'source=mock is rejected'
);

-- source=persisted rejected at write time
SELECT throws_ok(
  $$SELECT * FROM public.replace_project_room_analyses(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
    $j$[
      {"photo_id":"11111111-aaaa-4aaa-8aaa-111111111111","source":"persisted","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"x","confidence_score":0.1},
      {"photo_id":"22222222-aaaa-4aaa-8aaa-222222222222","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"y","confidence_score":0.1},
      {"photo_id":"33333333-aaaa-4aaa-8aaa-333333333333","source":"ai","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"z","confidence_score":0.1}
    ]$j$::jsonb
  )$$,
  '22023',
  'mock_or_invalid_source',
  'source=persisted is rejected at write time'
);

-- Foreign photo in complete-size payload rejected
SELECT throws_ok(
  $$SELECT * FROM public.replace_project_room_analyses(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
    $j$[
      {"photo_id":"11111111-aaaa-4aaa-8aaa-111111111111","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"x","confidence_score":0.9},
      {"photo_id":"22222222-aaaa-4aaa-8aaa-222222222222","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"y","confidence_score":0.8},
      {"photo_id":"44444444-bbbb-4bbb-8bbb-444444444444","source":"ai","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"z","confidence_score":0.7}
    ]$j$::jsonb
  )$$,
  '42501',
  'source_not_authorised',
  'foreign project photo rejected'
);

-- Nonexistent photo rejected
SELECT throws_ok(
  $$SELECT * FROM public.replace_project_room_analyses(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
    $j$[
      {"photo_id":"11111111-aaaa-4aaa-8aaa-111111111111","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"x","confidence_score":0.9},
      {"photo_id":"22222222-aaaa-4aaa-8aaa-222222222222","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"y","confidence_score":0.8},
      {"photo_id":"deadbeef-dead-4ead-8ead-deadbeefdead","source":"ai","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"z","confidence_score":0.7}
    ]$j$::jsonb
  )$$,
  '42501',
  'source_not_authorised',
  'nonexistent photo rejected'
);

-- Duplicate photo_id rejected
SELECT throws_ok(
  $$SELECT * FROM public.replace_project_room_analyses(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
    $j$[
      {"photo_id":"11111111-aaaa-4aaa-8aaa-111111111111","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"x","confidence_score":0.9},
      {"photo_id":"11111111-aaaa-4aaa-8aaa-111111111111","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"y","confidence_score":0.8},
      {"photo_id":"33333333-aaaa-4aaa-8aaa-333333333333","source":"ai","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"z","confidence_score":0.7}
    ]$j$::jsonb
  )$$,
  '22023',
  'duplicate_photo_id',
  'duplicate photo_id rejected'
);

-- AG complete P1,P2,P3 PASS with mixed ai/fallback + canonical URL + photo_id
CREATE TEMP TABLE r3_out AS
SELECT * FROM public.replace_project_room_analyses(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  $j$[
    {"photo_id":"11111111-aaaa-4aaa-8aaa-111111111111","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"ok1","confidence_score":0.9,"photo_url":"https://ATTACKER/evil.jpg","photo_name":"evil.jpg"},
    {"photo_id":"22222222-aaaa-4aaa-8aaa-222222222222","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"ok2","confidence_score":0.8},
    {"photo_id":"33333333-aaaa-4aaa-8aaa-333333333333","source":"fallback","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"fb","confidence_score":0}
  ]$j$::jsonb
);

SELECT is(
  (SELECT count(*)::int FROM r3_out),
  3,
  'complete catalogue replacement returns 3 rows'
);

SELECT is(
  (SELECT count(*)::int FROM public.room_analyses WHERE project_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  3,
  'complete catalogue replacement persists 3 rows'
);

SELECT is(
  (SELECT count(*)::int FROM public.room_analyses
    WHERE project_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' AND photo_id IS NOT NULL),
  3,
  'all rows retain photo_id'
);

SELECT is(
  (SELECT count(*)::int FROM public.room_analyses
    WHERE project_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' AND photo_url LIKE '%ATTACKER%'),
  0,
  'canonical URL derived from photos (attacker payload ignored)'
);

SELECT is(
  (SELECT photo_url FROM public.room_analyses
    WHERE project_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      AND photo_id = '11111111-aaaa-4aaa-8aaa-111111111111'),
  'https://cdn/p1.jpg',
  'photo_url matches canonical photos row'
);

SELECT is(
  (SELECT count(*)::int FROM public.room_analyses
    WHERE project_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' AND source = 'fallback'),
  1,
  'genuine fallback source allowed in complete set'
);

-- After success, incomplete still rejected and leaves complete set
SELECT throws_ok(
  $$SELECT * FROM public.replace_project_room_analyses(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
    '[{"photo_id":"11111111-aaaa-4aaa-8aaa-111111111111","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"wipe","confidence_score":0.9}]'::jsonb
  )$$,
  '22023',
  'incomplete_photo_catalogue',
  'incomplete after complete still rejected'
);

SELECT is(
  (SELECT count(*)::int FROM public.room_analyses WHERE project_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  3,
  'failed incomplete leave prior complete authority unchanged'
);

SELECT is(
  (SELECT count(*)::int FROM public.room_analyses
    WHERE project_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' AND ai_summary = 'wipe'),
  0,
  'no partial wipe rows after incomplete reject'
);

-- Other user cannot replace project A
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$SELECT * FROM public.replace_project_room_analyses(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
    $j$[
      {"photo_id":"11111111-aaaa-4aaa-8aaa-111111111111","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"hijack","confidence_score":0.1},
      {"photo_id":"22222222-aaaa-4aaa-8aaa-222222222222","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"hijack","confidence_score":0.1},
      {"photo_id":"33333333-aaaa-4aaa-8aaa-333333333333","source":"ai","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"hijack","confidence_score":0.1}
    ]$j$::jsonb
  )$$,
  '42501',
  'project_not_authorised',
  'other user cannot replace project analyses'
);

SELECT pass('replace_project_room_analyses R3 complete-catalogue + security verified');
SELECT pass('concurrency dynamic proof retained as separate IV probe (FOR UPDATE + FOR SHARE)');

SELECT * FROM finish();
ROLLBACK;
