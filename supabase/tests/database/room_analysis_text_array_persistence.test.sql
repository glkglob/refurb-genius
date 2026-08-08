-- AP-R1 — room_analyses visible_issues/recommended_works are text[] and match RPC.
BEGIN;
SELECT plan(8);

SELECT is(
  (
    SELECT c.udt_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'room_analyses'
      AND c.column_name = 'visible_issues'
  ),
  '_text',
  'visible_issues is text[]'
);

SELECT is(
  (
    SELECT c.udt_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'room_analyses'
      AND c.column_name = 'recommended_works'
  ),
  '_text',
  'recommended_works is text[]'
);

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
  'replace_project_room_analyses remains SECURITY INVOKER'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.replace_project_room_analyses(uuid,jsonb)', 'EXECUTE'),
  'anon cannot EXECUTE replace_project_room_analyses'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.replace_project_room_analyses(uuid,jsonb)', 'EXECUTE'),
  'authenticated can EXECUTE replace_project_room_analyses'
);

-- Defaults are text[] empty arrays
SELECT is(
  (
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'room_analyses'
      AND column_name = 'visible_issues'
  ),
  'ARRAY[]::text[]',
  'visible_issues default is ARRAY[]::text[]'
);

SELECT is(
  (
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'room_analyses'
      AND column_name = 'recommended_works'
  ),
  'ARRAY[]::text[]',
  'recommended_works default is ARRAY[]::text[]'
);

SELECT * FROM finish();
ROLLBACK;
