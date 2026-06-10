-- Storage RLS policies for floorplan-models / pitch-decks / gallery-assets call
-- public.is_project_owner(private.safe_uuid(...)). Those functions were only
-- executable by postgres/service_role, so ANY storage write by an
-- authenticated user failed with "permission denied for function
-- is_project_owner" — Postgres evaluates all permissive policies on
-- storage.objects, including these, even for other buckets (e.g.
-- project-photos uploads).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'private') THEN
    GRANT USAGE ON SCHEMA private TO authenticated;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'safe_uuid'
  ) THEN
    GRANT EXECUTE ON FUNCTION private.safe_uuid(text) TO authenticated;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_project_owner'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid) TO authenticated;
  END IF;
END
$$;
