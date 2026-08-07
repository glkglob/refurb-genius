-- P0-PHOTO-ANALYZE-R2 — atomic replace_project_room_analyses
BEGIN;
SELECT plan(8);

SELECT has_function(
  'public',
  'replace_project_room_analyses',
  ARRAY['uuid', 'jsonb'],
  'replace_project_room_analyses exists'
);

SELECT function_privs_are(
  'public',
  'replace_project_room_analyses',
  ARRAY['uuid', 'jsonb'],
  'authenticated',
  ARRAY['EXECUTE'],
  'authenticated may execute replace_project_room_analyses'
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

-- Function rejects unauthenticated callers
SELECT throws_ok(
  $$SELECT * FROM public.replace_project_room_analyses(
    '00000000-0000-0000-0000-000000000001'::uuid,
    '[{"photo_id":"00000000-0000-0000-0000-000000000002","source":"mock","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"x","confidence_score":0.1}]'::jsonb
  )$$,
  '28000',
  'not_authenticated',
  'unauthenticated replace is rejected'
);

SELECT pass('replace_project_room_analyses security surface verified');

SELECT * FROM finish();
ROLLBACK;
