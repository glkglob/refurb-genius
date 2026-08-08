-- IA-5-R1 — Scope / Estimate bind / Export publication authority
BEGIN;
SELECT plan(21);

SELECT has_function(
  'public',
  'save_project_scope_analysis',
  ARRAY['uuid', 'numeric', 'text', 'text', 'text', 'jsonb'],
  'save_project_scope_analysis exists'
);

SELECT has_function(
  'public',
  'publish_project_export_snapshot',
  ARRAY['uuid', 'uuid', 'text'],
  'publish_project_export_snapshot exists'
);

SELECT has_function(
  'public',
  'bind_estimate_input_scope',
  ARRAY['uuid', 'uuid'],
  'bind_estimate_input_scope exists'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.save_project_scope_analysis(uuid,numeric,text,text,text,jsonb)'::regprocedure),
  'save_project_scope_analysis is SECURITY DEFINER'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.publish_project_export_snapshot(uuid,uuid,text)'::regprocedure),
  'publish_project_export_snapshot is SECURITY DEFINER'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.bind_estimate_input_scope(uuid,uuid)'::regprocedure),
  'bind_estimate_input_scope is SECURITY DEFINER'
);

SELECT ok(
  (SELECT proconfig::text LIKE '%search_path=public%'
   FROM pg_proc WHERE oid = 'public.save_project_scope_analysis(uuid,numeric,text,text,text,jsonb)'::regprocedure),
  'save_project_scope_analysis has fixed search_path'
);

SELECT ok(
  (SELECT proconfig::text LIKE '%search_path=public%'
   FROM pg_proc WHERE oid = 'public.publish_project_export_snapshot(uuid,uuid,text)'::regprocedure),
  'publish_project_export_snapshot has fixed search_path'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.save_project_scope_analysis(uuid,numeric,text,text,text,jsonb)', 'EXECUTE'),
  'authenticated can EXECUTE save_project_scope_analysis'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.save_project_scope_analysis(uuid,numeric,text,text,text,jsonb)', 'EXECUTE'),
  'anon cannot EXECUTE save_project_scope_analysis'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.publish_project_export_snapshot(uuid,uuid,text)', 'EXECUTE'),
  'authenticated can EXECUTE publish_project_export_snapshot'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.publish_project_export_snapshot(uuid,uuid,text)', 'EXECUTE'),
  'anon cannot EXECUTE publish_project_export_snapshot'
);

-- Direct INSERT revoked from authenticated on export snapshots
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.project_export_snapshots', 'INSERT'),
  'authenticated cannot INSERT project_export_snapshots directly'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.scope_analyses', 'INSERT'),
  'authenticated cannot INSERT scope_analyses directly'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.scope_analyses', 'SELECT'),
  'authenticated retains SELECT on scope_analyses'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.project_export_snapshots', 'SELECT'),
  'authenticated retains SELECT on project_export_snapshots'
);

-- Function body requires currentness checks
SELECT ok(
  (SELECT prosrc FROM pg_proc WHERE oid = 'public.bind_estimate_input_scope(uuid,uuid)'::regprocedure)
    LIKE '%stale_scope%',
  'bind_estimate_input_scope rejects stale_scope'
);

SELECT ok(
  (SELECT prosrc FROM pg_proc WHERE oid = 'public.bind_estimate_input_scope(uuid,uuid)'::regprocedure)
    LIKE '%ia5_derive_current_analysis_identity%',
  'bind_estimate_input_scope re-derives analysis identity'
);

SELECT ok(
  (SELECT prosrc FROM pg_proc WHERE oid = 'public.publish_project_export_snapshot(uuid,uuid,text)'::regprocedure)
    LIKE '%stale_estimate%',
  'publish_project_export_snapshot rejects stale_estimate'
);

SELECT ok(
  (SELECT prosrc FROM pg_proc WHERE oid = 'public.publish_project_export_snapshot(uuid,uuid,text)'::regprocedure)
    LIKE '%estimate_project_mismatch%',
  'publish_project_export_snapshot rejects estimate_project_mismatch'
);

SELECT ok(
  (SELECT prosrc FROM pg_proc WHERE oid = 'public.save_project_scope_analysis(uuid,numeric,text,text,text,jsonb)'::regprocedure)
    LIKE '%ia5_derive_current_analysis_identity%',
  'save_project_scope_analysis derives analysis identity server-side'
);

SELECT * FROM finish();
ROLLBACK;
