-- P0-DB-1R — Share-link exact-token design, trade_messages append-only, single deny policy
--
-- Corrects unpublished P0-DB-1 gaps without rewriting history on main:
-- 1. Public resolve_share_link stays SECURITY INVOKER and delegates to a
--    private SECURITY DEFINER helper (exact token only). No enumerable
--    share_links table SELECT for public rows.
-- 2. trade_messages is append-only for client roles (SELECT + INSERT only).
-- 3. Internal service-owned tables use exactly one deny policy for
--    anon+authenticated (FOR ALL USING false / WITH CHECK false).
--
-- No data mutation. No index drops. No package changes.

-- ===========================================================================
-- 1. Private exact-token share-link helper + public INVOKER wrapper
-- ===========================================================================

CREATE SCHEMA IF NOT EXISTS private;

COMMENT ON SCHEMA private IS
  'Non-API schema for privileged helpers. Not exposed via PostgREST Data API.';

-- Restrict schema usage: only roles that must call the helper (via public wrapper)
-- need USAGE. Private schema is not listed in Data API exposed schemas.
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.resolve_share_link_exact(p_token text)
RETURNS TABLE (
  id uuid,
  study_id uuid,
  visibility text,
  access_role text,
  expires_at timestamptz,
  owner_user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    sl.id,
    sl.study_id,
    sl.visibility,
    sl.access_role,
    sl.expires_at,
    sl.owner_user_id
  FROM public.share_links sl
  WHERE p_token IS NOT NULL
    AND length(btrim(p_token)) > 0
    AND sl.token = p_token
    AND sl.revoked_at IS NULL
    AND (sl.expires_at IS NULL OR sl.expires_at > now())
    AND sl.visibility = 'public';
$$;

REVOKE ALL ON FUNCTION private.resolve_share_link_exact(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.resolve_share_link_exact(text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION private.resolve_share_link_exact(text) IS
  'Exact-token public share resolution (SECURITY DEFINER). Not a Data API RPC.';

-- Public wrapper: same signature/columns as before; INVOKER; no table scan path.
CREATE OR REPLACE FUNCTION public.resolve_share_link(p_token text)
RETURNS TABLE (
  id uuid,
  study_id uuid,
  visibility text,
  access_role text,
  expires_at timestamptz,
  owner_user_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    h.id,
    h.study_id,
    h.visibility,
    h.access_role,
    h.expires_at,
    h.owner_user_id
  FROM private.resolve_share_link_exact(p_token) h;
$$;

REVOKE ALL ON FUNCTION public.resolve_share_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_share_link(text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.resolve_share_link(text) IS
  'Public exact-token share resolve (SECURITY INVOKER wrapper; private helper performs lookup).';

-- Remove enumerable public-link table SELECT policies introduced by P0-DB-1.
DROP POLICY IF EXISTS "share_links_select_anon_public" ON public.share_links;
DROP POLICY IF EXISTS "share_links_select_authenticated" ON public.share_links;

-- Authenticated may see only own links (or admin). No public-row enumeration.
CREATE POLICY "share_links_select_authenticated"
  ON public.share_links
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR owner_user_id = (select auth.uid())
  );

-- Anon: no SELECT policy on share_links (exact-token only via RPC).

-- ===========================================================================
-- 2. trade_messages — append-only for client roles
-- ===========================================================================

DROP POLICY IF EXISTS "trade_messages_update_party" ON public.trade_messages;
DROP POLICY IF EXISTS "trade_messages_delete_party" ON public.trade_messages;
DROP POLICY IF EXISTS "trade_messages_update_consolidated" ON public.trade_messages;
DROP POLICY IF EXISTS "trade_messages_delete_consolidated" ON public.trade_messages;

-- Strip client privileges beyond authenticated SELECT/INSERT (append-only).
REVOKE ALL ON TABLE public.trade_messages FROM PUBLIC;
REVOKE ALL ON TABLE public.trade_messages FROM anon;
REVOKE ALL ON TABLE public.trade_messages FROM authenticated;

-- Authenticated participants only (row filter via SELECT/INSERT policies).
GRANT SELECT, INSERT ON TABLE public.trade_messages TO authenticated;

-- service_role retains full access for service paths/tests.
GRANT ALL ON TABLE public.trade_messages TO service_role;

-- ===========================================================================
-- 3. Internal tables — exactly one deny policy for anon+authenticated
-- ===========================================================================

-- estimate_authority_idempotency
DROP POLICY IF EXISTS "estimate_authority_idempotency_deny_anon"
  ON public.estimate_authority_idempotency;
DROP POLICY IF EXISTS "estimate_authority_idempotency_deny_authenticated"
  ON public.estimate_authority_idempotency;
DROP POLICY IF EXISTS "estimate_authority_idempotency_deny_clients"
  ON public.estimate_authority_idempotency;
CREATE POLICY "estimate_authority_idempotency_deny_clients"
  ON public.estimate_authority_idempotency
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- measured_boq_catalog_entries
DROP POLICY IF EXISTS "measured_boq_catalog_entries_deny_anon"
  ON public.measured_boq_catalog_entries;
DROP POLICY IF EXISTS "measured_boq_catalog_entries_deny_authenticated"
  ON public.measured_boq_catalog_entries;
DROP POLICY IF EXISTS "measured_boq_catalog_entries_deny_clients"
  ON public.measured_boq_catalog_entries;
CREATE POLICY "measured_boq_catalog_entries_deny_clients"
  ON public.measured_boq_catalog_entries
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- measured_boq_catalog_events
DROP POLICY IF EXISTS "measured_boq_catalog_events_deny_anon"
  ON public.measured_boq_catalog_events;
DROP POLICY IF EXISTS "measured_boq_catalog_events_deny_authenticated"
  ON public.measured_boq_catalog_events;
DROP POLICY IF EXISTS "measured_boq_catalog_events_deny_clients"
  ON public.measured_boq_catalog_events;
CREATE POLICY "measured_boq_catalog_events_deny_clients"
  ON public.measured_boq_catalog_events
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- measured_boq_catalog_packages
DROP POLICY IF EXISTS "measured_boq_catalog_packages_deny_anon"
  ON public.measured_boq_catalog_packages;
DROP POLICY IF EXISTS "measured_boq_catalog_packages_deny_authenticated"
  ON public.measured_boq_catalog_packages;
DROP POLICY IF EXISTS "measured_boq_catalog_packages_deny_clients"
  ON public.measured_boq_catalog_packages;
CREATE POLICY "measured_boq_catalog_packages_deny_clients"
  ON public.measured_boq_catalog_packages
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- measured_boq_catalog_revisions
DROP POLICY IF EXISTS "measured_boq_catalog_revisions_deny_anon"
  ON public.measured_boq_catalog_revisions;
DROP POLICY IF EXISTS "measured_boq_catalog_revisions_deny_authenticated"
  ON public.measured_boq_catalog_revisions;
DROP POLICY IF EXISTS "measured_boq_catalog_revisions_deny_clients"
  ON public.measured_boq_catalog_revisions;
CREATE POLICY "measured_boq_catalog_revisions_deny_clients"
  ON public.measured_boq_catalog_revisions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
