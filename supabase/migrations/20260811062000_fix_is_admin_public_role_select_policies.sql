-- PUBLIC-BETA-OBS2-IS-ADMIN-SSR-RLS
-- Bounded RLS policy-role repair for residual PUBLIC-role SELECT policies
-- that evaluate public.is_admin().
--
-- Defect: anon/SSR PostgREST (role anon) evaluates PUBLIC-role policies whose
-- USING expression calls is_admin(). EXECUTE on is_admin() is correctly
-- revoked from anon/public, so the call hard-fails with:
--   permission denied for function is_admin
-- instead of soft-denying the row.
--
-- Repair:
--   1) Six private tables: narrow live SELECT policies from PUBLIC → authenticated
--      (predicate preserved via ALTER POLICY ... TO authenticated).
--   2) public_gallery_projects: split into anon (public visibility only) and
--      authenticated (full existing semantics including is_admin).
--
-- Hard prohibitions (intentionally absent from this file):
--   * GRANT/REVOKE on public.is_admin()
--   * GRANT is_admin EXECUTE to anon/public
--   * USING (true) expansion
--   * RLS disable / SECURITY DEFINER / service_role bypass
--   * Non-SELECT policy mutation
--
-- Local migration chains may still carry residual feature-foundation
-- *_select_admin PUBLIC policies; those are narrowed when present so local
-- and production converge on the same security property.

-- ---------------------------------------------------------------------------
-- 1) Six private tables — live production policy names (predicate preserved)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feasibility_studies'
      AND policyname = 'feasibility_studies_select_public'
  ) THEN
    EXECUTE 'ALTER POLICY "feasibility_studies_select_public" ON public.feasibility_studies TO authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'investor_leads'
      AND policyname = 'investor_leads_select_public'
  ) THEN
    EXECUTE 'ALTER POLICY "investor_leads_select_public" ON public.investor_leads TO authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'photo_analysis_results'
      AND policyname = 'photo_analysis_results_select_public'
  ) THEN
    EXECUTE 'ALTER POLICY "photo_analysis_results_select_public" ON public.photo_analysis_results TO authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles_select_public'
  ) THEN
    EXECUTE 'ALTER POLICY "profiles_select_public" ON public.profiles TO authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'study_exports'
      AND policyname = 'study_exports_select_public'
  ) THEN
    EXECUTE 'ALTER POLICY "study_exports_select_public" ON public.study_exports TO authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'study_snapshots'
      AND policyname = 'study_snapshots_select_public'
  ) THEN
    EXECUTE 'ALTER POLICY "study_snapshots_select_public" ON public.study_snapshots TO authenticated';
  END IF;
END
$$;

-- Residual migration-chain / any remaining PUBLIC-role SELECT policies that
-- still evaluate is_admin(). Same defect class as the live seven.
-- public_gallery_projects is handled by the explicit split below (not ALTER).
-- No-ops when none remain (production live path after the six ALTERs above).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'SELECT'
      AND 'public' = any (roles)
      AND coalesce(qual, '') ilike '%is_admin%'
      AND tablename <> 'public_gallery_projects'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON public.%I TO authenticated',
      r.policyname,
      r.tablename
    );
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 2) public_gallery_projects — split required
-- ---------------------------------------------------------------------------
-- Remove the defective combined PUBLIC SELECT policy (live name) and any
-- residual SELECT policies that would leave is_admin() reachable by anon.
DROP POLICY IF EXISTS "public_gallery_projects_select_public" ON public.public_gallery_projects;
DROP POLICY IF EXISTS "public_gallery_projects_select_admin" ON public.public_gallery_projects;
DROP POLICY IF EXISTS "public_gallery_projects_public_read" ON public.public_gallery_projects;
DROP POLICY IF EXISTS "public_gallery_projects_select_anon" ON public.public_gallery_projects;
DROP POLICY IF EXISTS "public_gallery_projects_select_authenticated" ON public.public_gallery_projects;

DO $$
DECLARE
  v_has_is_published boolean;
  v_has_created_by boolean;
  v_anon_using text;
  v_auth_using text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_gallery_projects'
      AND column_name = 'is_published'
  ) INTO v_has_is_published;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_gallery_projects'
      AND column_name = 'created_by'
  ) INTO v_has_created_by;

  -- Anon: intentional public visibility only. NEVER is_admin / ownership.
  IF v_has_is_published THEN
    v_anon_using := '(is_public = true OR is_published = true)';
  ELSE
    v_anon_using := '(is_public = true)';
  END IF;

  -- Authenticated: preserve live full semantics (admin + public + ownership).
  v_auth_using := 'public.is_admin()';
  IF v_has_is_published THEN
    v_auth_using := v_auth_using || ' OR (is_public = true) OR (is_published = true)';
  ELSE
    v_auth_using := v_auth_using || ' OR (is_public = true)';
  END IF;
  IF v_has_created_by THEN
    v_auth_using := v_auth_using
      || ' OR (created_by = (SELECT auth.uid()))';
  END IF;
  v_auth_using := v_auth_using
    || ' OR ((SELECT p.user_id FROM public.projects p'
    || ' WHERE p.id = public_gallery_projects.project_id) = (SELECT auth.uid()))';

  EXECUTE format(
    'CREATE POLICY "public_gallery_projects_select_anon"
       ON public.public_gallery_projects
       FOR SELECT
       TO anon
       USING (%s)',
    v_anon_using
  );

  EXECUTE format(
    'CREATE POLICY "public_gallery_projects_select_authenticated"
       ON public.public_gallery_projects
       FOR SELECT
       TO authenticated
       USING (%s)',
    v_auth_using
  );
END
$$;
