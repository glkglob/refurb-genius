-- IA-4-R2 — select/replace redesign authority + write-path seal suite
BEGIN;
SELECT plan(22);

SELECT has_function(
  'public',
  'select_project_redesign_concept',
  ARRAY['uuid', 'uuid'],
  'select_project_redesign_concept exists'
);

SELECT has_function(
  'public',
  'replace_project_redesign_candidates',
  ARRAY['uuid', 'jsonb'],
  'replace_project_redesign_candidates exists'
);

SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.select_project_redesign_concept(uuid,uuid)'::regprocedure
  ),
  true,
  'select_project_redesign_concept is SECURITY DEFINER'
);

SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.replace_project_redesign_candidates(uuid,jsonb)'::regprocedure
  ),
  true,
  'replace_project_redesign_candidates is SECURITY DEFINER'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.select_project_redesign_concept(uuid,uuid)', 'EXECUTE'),
  'anon cannot EXECUTE select_project_redesign_concept'
);

SELECT ok(
  NOT has_function_privilege('public', 'public.select_project_redesign_concept(uuid,uuid)', 'EXECUTE'),
  'PUBLIC cannot EXECUTE select_project_redesign_concept'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.select_project_redesign_concept(uuid,uuid)', 'EXECUTE'),
  'authenticated can EXECUTE select_project_redesign_concept'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.replace_project_redesign_candidates(uuid,jsonb)', 'EXECUTE'),
  'anon cannot EXECUTE replace_project_redesign_candidates'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.replace_project_redesign_candidates(uuid,jsonb)', 'EXECUTE'),
  'authenticated can EXECUTE replace_project_redesign_candidates'
);

SELECT has_column('public', 'redesign_concepts', 'analysis_identity', 'analysis_identity column exists');
SELECT has_column('public', 'redesign_concepts', 'is_selected', 'is_selected column exists');

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'redesign_concepts_one_selected_per_project'
  ),
  'partial unique index redesign_concepts_one_selected_per_project exists'
);

SELECT ok(
  (
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'redesign_concepts_one_selected_per_project'
  ) ILIKE '%is_selected%',
  'unique index is partial on is_selected'
);

SELECT ok(
  (
    SELECT proconfig::text
    FROM pg_proc
    WHERE oid = 'public.select_project_redesign_concept(uuid,uuid)'::regprocedure
  ) ILIKE '%search_path%',
  'select function sets search_path'
);

SELECT ok(
  (
    SELECT proconfig::text
    FROM pg_proc
    WHERE oid = 'public.replace_project_redesign_candidates(uuid,jsonb)'::regprocedure
  ) ILIKE '%search_path%',
  'replace function sets search_path'
);

-- Privilege seal: authenticated must not have direct DML
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.redesign_concepts', 'INSERT'),
  'authenticated cannot INSERT redesign_concepts'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.redesign_concepts', 'UPDATE'),
  'authenticated cannot UPDATE redesign_concepts'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.redesign_concepts', 'DELETE'),
  'authenticated cannot DELETE redesign_concepts'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.redesign_concepts', 'SELECT'),
  'authenticated can SELECT redesign_concepts'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.redesign_concepts', 'UPDATE'),
  'anon cannot UPDATE redesign_concepts'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.redesign_concepts', 'INSERT'),
  'anon cannot INSERT redesign_concepts'
);

SELECT pass('IA-4-R2 write-path seal security surface verified');

SELECT * FROM finish();
ROLLBACK;
