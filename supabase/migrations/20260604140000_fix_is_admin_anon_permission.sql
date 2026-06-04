-- Fix: guard all is_admin() RLS SELECT policies with auth.uid() IS NOT NULL.
--
-- When a user's JWT has expired or is mid-refresh, the Supabase client can fire
-- a request under the `anon` role. The `anon` role has EXECUTE revoked on
-- is_admin(), so any RLS policy that calls is_admin() unconditionally returns
-- "permission denied for function is_admin" (HTTP 403).
--
-- Adding `auth.uid() IS NOT NULL AND` before each is_admin() call short-circuits
-- evaluation for anon requests (PostgreSQL AND is short-circuit), so is_admin()
-- is never invoked — and never permission-checked — when there is no authenticated
-- user. The policy simply evaluates to false for anon, which is the correct result.

-- profiles
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_admin());

-- projects
DROP POLICY IF EXISTS "projects_select_admin" ON public.projects;
CREATE POLICY "projects_select_admin"
  ON public.projects FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_admin());

-- photos
DROP POLICY IF EXISTS "photos_select_admin" ON public.photos;
CREATE POLICY "photos_select_admin"
  ON public.photos FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_admin());

-- redesign_concepts
DROP POLICY IF EXISTS "redesign_select_admin" ON public.redesign_concepts;
CREATE POLICY "redesign_select_admin"
  ON public.redesign_concepts FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_admin());

-- estimates
DROP POLICY IF EXISTS "estimates_select_admin" ON public.estimates;
CREATE POLICY "estimates_select_admin"
  ON public.estimates FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_admin());

-- estimate_items
DROP POLICY IF EXISTS "estimate_items_select_admin" ON public.estimate_items;
CREATE POLICY "estimate_items_select_admin"
  ON public.estimate_items FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_admin());