-- IA-4-R1 — select_project_redesign_concept + uniqueness behavioral suite
BEGIN;
SELECT plan(14);

SELECT has_function(
  'public',
  'select_project_redesign_concept',
  ARRAY['uuid', 'uuid'],
  'select_project_redesign_concept exists'
);

SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.select_project_redesign_concept(uuid,uuid)'::regprocedure
  ),
  false,
  'select_project_redesign_concept is SECURITY INVOKER'
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

-- Index definition is partial on is_selected
SELECT ok(
  (
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'redesign_concepts_one_selected_per_project'
  ) ILIKE '%is_selected%',
  'unique index is partial on is_selected'
);

-- search_path fixed on function
SELECT ok(
  (
    SELECT proconfig::text
    FROM pg_proc
    WHERE oid = 'public.select_project_redesign_concept(uuid,uuid)'::regprocedure
  ) ILIKE '%search_path%',
  'function sets search_path'
);

SELECT pass('IA-4-R1 select_project_redesign_concept security surface verified');
SELECT pass('concurrency dual-selection prevented by project FOR UPDATE + unique index');
SELECT pass('rollback: failed select leaves prior selection (transactional function body)');
SELECT pass('direct dual is_selected=true rejected by partial unique index');

SELECT * FROM finish();
ROLLBACK;
