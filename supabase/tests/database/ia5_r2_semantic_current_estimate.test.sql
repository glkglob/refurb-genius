-- IA-5-R2 — semantic current Estimate for Export
BEGIN;
SELECT plan(12);

SELECT has_function(
  'public', 'ia5_is_authoritative_estimate_pricing', ARRAY['text'],
  'authoritative pricing helper exists'
);

SELECT has_function(
  'public', 'ia5_resolve_current_estimate_id', ARRAY['uuid', 'uuid', 'uuid'],
  'current estimate resolver exists'
);

SELECT ok(
  (SELECT prosrc FROM pg_proc WHERE oid = 'public.publish_project_export_snapshot(uuid,uuid,text)'::regprocedure)
    LIKE '%ia5_resolve_current_estimate_id%',
  'publish uses semantic current-estimate resolver'
);

SELECT ok(
  (SELECT prosrc FROM pg_proc WHERE oid = 'public.publish_project_export_snapshot(uuid,uuid,text)'::regprocedure)
    LIKE '%ia5_resolve_current_scope_id_for_project%',
  'publish resolves current Scope provenance'
);

SELECT ok(
  (SELECT prosrc FROM pg_proc WHERE oid = 'public.publish_project_export_snapshot(uuid,uuid,text)'::regprocedure)
    LIKE '%ia5_is_authoritative_estimate_pricing%',
  'publish re-checks authoritative pricing after lock'
);

SELECT ok(
  public.ia5_is_authoritative_estimate_pricing('category-engine'),
  'category-engine is authoritative'
);

SELECT ok(
  public.ia5_is_authoritative_estimate_pricing('measured-boq-engine'),
  'measured-boq-engine is authoritative'
);

SELECT ok(
  NOT public.ia5_is_authoritative_estimate_pricing('none'),
  'none is not authoritative'
);

SELECT ok(
  (SELECT prosrc FROM pg_proc WHERE oid = 'public.ia5_resolve_current_estimate_id(uuid,uuid,uuid)'::regprocedure)
    LIKE '%input_scope_id%',
  'current estimate requires input_scope_id'
);

SELECT ok(
  (SELECT prosrc FROM pg_proc WHERE oid = 'public.ia5_resolve_current_estimate_id(uuid,uuid,uuid)'::regprocedure)
    LIKE '%ia5_is_authoritative_estimate_pricing%',
  'current estimate requires authoritative pricing'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.publish_project_export_snapshot(uuid,uuid,text)'::regprocedure),
  'publish remains SECURITY DEFINER'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.publish_project_export_snapshot(uuid,uuid,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.publish_project_export_snapshot(uuid,uuid,text)', 'EXECUTE'),
  'publish EXECUTE: authenticated only'
);

SELECT * FROM finish();
ROLLBACK;
