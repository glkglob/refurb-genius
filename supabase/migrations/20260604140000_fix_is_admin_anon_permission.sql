-- Fix: scope admin SELECT policies to the 'authenticated' role only.
--
-- Previously, the admin policies (e.g. "profiles_select_admin") were created
-- without an explicit "TO authenticated" clause.
--
-- While the is_admin() function safely returns FALSE for unauthenticated
-- (anon) users (because auth.uid() IS NULL), it is still best practice to
-- explicitly scope these privileged policies to the authenticated role.
--
-- This prevents the policies from being considered for the anon role at all,
-- reduces attack surface, and makes the intent clear.
--
-- We also re-assert the function execution permissions.

-- Re-assert is_admin() can only be executed by authenticated users
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Recreate each admin policy with explicit "TO authenticated".
-- We DROP IF EXISTS + CREATE because the original policy definitions did not
-- have the role restriction.

DO $$
BEGIN
  -- profiles
  DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
  CREATE POLICY "profiles_select_admin"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.is_admin());
END
$$;

DO $$
BEGIN
  -- projects
  DROP POLICY IF EXISTS "projects_select_admin" ON public.projects;
  CREATE POLICY "projects_select_admin"
    ON public.projects FOR SELECT
    TO authenticated
    USING (public.is_admin());
END
$$;

DO $$
BEGIN
  -- photos
  DROP POLICY IF EXISTS "photos_select_admin" ON public.photos;
  CREATE POLICY "photos_select_admin"
    ON public.photos FOR SELECT
    TO authenticated
    USING (public.is_admin());
END
$$;

DO $$
BEGIN
  -- redesign_concepts
  DROP POLICY IF EXISTS "redesign_select_admin" ON public.redesign_concepts;
  CREATE POLICY "redesign_select_admin"
    ON public.redesign_concepts FOR SELECT
    TO authenticated
    USING (public.is_admin());
END
$$;

DO $$
BEGIN
  -- estimates
  DROP POLICY IF EXISTS "estimates_select_admin" ON public.estimates;
  CREATE POLICY "estimates_select_admin"
    ON public.estimates FOR SELECT
    TO authenticated
    USING (public.is_admin());
END
$$;

DO $$
BEGIN
  -- estimate_items
  DROP POLICY IF EXISTS "estimate_items_select_admin" ON public.estimate_items;
  CREATE POLICY "estimate_items_select_admin"
    ON public.estimate_items FOR SELECT
    TO authenticated
    USING (public.is_admin());
END
$$;

DO $$
BEGIN
  -- deal_opportunities (added in later migration)
  DROP POLICY IF EXISTS "deal_opps_select_admin" ON public.deal_opportunities;
  CREATE POLICY "deal_opps_select_admin"
    ON public.deal_opportunities FOR SELECT
    TO authenticated
    USING (public.is_admin());
END
$$;

DO $$
BEGIN
  -- estimate_rooms (added in evolve_estimates_schema)
  DROP POLICY IF EXISTS "estimate_rooms_select_admin" ON public.estimate_rooms;
  CREATE POLICY "estimate_rooms_select_admin"
    ON public.estimate_rooms FOR SELECT
    TO authenticated
    USING (public.is_admin());
END
$$;
