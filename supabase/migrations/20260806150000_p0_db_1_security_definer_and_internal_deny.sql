-- P0-DB-1 (1/2) — SECURITY DEFINER exposure repair + internal-table deny
--
-- 1. Trigger functions remain SECURITY DEFINER but are not public RPCs.
-- 2. resolve_share_link becomes SECURITY INVOKER (exact token filter retained).
-- 3. Service-owned catalogue / authority tables gain explicit deny-all client policies.
--
-- No data mutation. No index drops. No application RPC removal.

-- ---------------------------------------------------------------------------
-- 1. Trigger functions: revoke client EXECUTE; harden search_path
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.estimates_measured_header_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bad_count integer;
BEGIN
  IF NEW.pricing_authority = 'measured-boq-engine' THEN
    IF NEW.catalog_revision IS NULL OR length(btrim(NEW.catalog_revision)) = 0 THEN
      RAISE EXCEPTION 'MEASURED_HEADER_REVISION_REQUIRED'
        USING ERRCODE = 'P0001',
              DETAIL = 'measured-boq-engine requires catalog_revision';
    END IF;

    IF NEW.pricing_policy_version IS NULL OR length(btrim(NEW.pricing_policy_version)) = 0 THEN
      RAISE EXCEPTION 'MEASURED_HEADER_POLICY_REQUIRED'
        USING ERRCODE = 'P0001',
              DETAIL = 'measured-boq-engine requires pricing_policy_version';
    END IF;

    SELECT count(*)::integer INTO v_bad_count
    FROM public.estimate_items i
    WHERE i.estimate_id = NEW.id
      AND (
        i.rate_source IS DISTINCT FROM 'library'
        OR i.rate_key IS NULL
        OR i.catalog_revision IS NULL
        OR i.base_unit_rate IS NULL
        OR i.regional_multiplier IS NULL
        OR i.resolved_unit_rate IS NULL
        OR i.catalog_revision IS DISTINCT FROM NEW.catalog_revision
      );

    IF v_bad_count > 0 THEN
      RAISE EXCEPTION 'HEADER_ITEM_PROVENANCE_MISMATCH'
        USING ERRCODE = 'P0001',
              DETAIL = format(
                '%s measured items lack complete library provenance matching header revision',
                v_bad_count
              );
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.pricing_authority IN ('none', 'category-engine') THEN
    SELECT count(*)::integer INTO v_bad_count
    FROM public.estimate_items i
    WHERE i.estimate_id = NEW.id
      AND (
        i.rate_source IS NOT NULL
        OR i.rate_key IS NOT NULL
        OR i.catalog_revision IS NOT NULL
        OR i.base_unit_rate IS NOT NULL
        OR i.regional_multiplier IS NOT NULL
        OR i.resolved_unit_rate IS NOT NULL
      );

    IF v_bad_count > 0 THEN
      RAISE EXCEPTION 'PROVENANCE_FORBIDDEN_FOR_AUTHORITY'
        USING ERRCODE = 'P0001',
              DETAIL = format(
                'Cannot set pricing_authority=%s while %s items retain library provenance',
                NEW.pricing_authority,
                v_bad_count
              );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT (
      current_setting('role', true) = 'service_role'
      OR public.is_admin()
    ) THEN
      RAISE EXCEPTION 'profiles.role cannot be changed by non-admin users'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Exact signatures (no-arg trigger functions).
REVOKE ALL ON FUNCTION public.estimates_measured_header_integrity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimates_measured_header_integrity() FROM anon;
REVOKE ALL ON FUNCTION public.estimates_measured_header_integrity() FROM authenticated;

REVOKE ALL ON FUNCTION public.prevent_role_self_escalation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_role_self_escalation() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_role_self_escalation() FROM authenticated;

-- Owner/admin retain control; service_role may execute when needed for tests/ops.
GRANT EXECUTE ON FUNCTION public.estimates_measured_header_integrity() TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_role_self_escalation() TO service_role;

COMMENT ON FUNCTION public.estimates_measured_header_integrity() IS
  'Trigger-only: measured header provenance integrity. Not a public RPC.';
COMMENT ON FUNCTION public.prevent_role_self_escalation() IS
  'Trigger-only: freeze profiles.role against non-admin self-escalation. Not a public RPC.';

-- Ensure triggers remain attached (idempotent).
DROP TRIGGER IF EXISTS estimates_measured_header_integrity ON public.estimates;
CREATE TRIGGER estimates_measured_header_integrity
  BEFORE INSERT OR UPDATE OF pricing_authority, pricing_policy_version, catalog_revision
  ON public.estimates
  FOR EACH ROW
  EXECUTE FUNCTION public.estimates_measured_header_integrity();

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();

-- ---------------------------------------------------------------------------
-- 2. resolve_share_link — SECURITY INVOKER (no elevated bypass)
-- ---------------------------------------------------------------------------

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
    sl.id,
    sl.study_id,
    sl.visibility,
    sl.access_role,
    sl.expires_at,
    sl.owner_user_id
  FROM public.share_links sl
  WHERE sl.token = p_token
    AND sl.revoked_at IS NULL
    AND (sl.expires_at IS NULL OR sl.expires_at > now())
    AND sl.visibility = 'public';
$$;

REVOKE ALL ON FUNCTION public.resolve_share_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_share_link(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.resolve_share_link(text) IS
  'Resolve a public, non-revoked, non-expired share link by exact token (SECURITY INVOKER).';

-- ---------------------------------------------------------------------------
-- 3. Explicit deny-all policies for service-owned internal tables
--    (clears rls_enabled_no_policy while preserving client inaccessibility)
-- ---------------------------------------------------------------------------

ALTER TABLE public.estimate_authority_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measured_boq_catalog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measured_boq_catalog_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measured_boq_catalog_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measured_boq_catalog_revisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.estimate_authority_idempotency FROM PUBLIC;
REVOKE ALL ON TABLE public.estimate_authority_idempotency FROM anon;
REVOKE ALL ON TABLE public.estimate_authority_idempotency FROM authenticated;
-- service_role retains full access for private authority RPC paths.
GRANT ALL ON TABLE public.estimate_authority_idempotency TO service_role;

-- Catalogue tables remain fail-closed: JWT roles none; service_role SELECT only.
-- Lifecycle/persistence RPCs own writes (do not re-expand service_role DML).
REVOKE ALL ON TABLE public.measured_boq_catalog_entries FROM PUBLIC;
REVOKE ALL ON TABLE public.measured_boq_catalog_entries FROM anon;
REVOKE ALL ON TABLE public.measured_boq_catalog_entries FROM authenticated;
REVOKE ALL ON TABLE public.measured_boq_catalog_entries FROM service_role;
GRANT SELECT ON TABLE public.measured_boq_catalog_entries TO service_role;

REVOKE ALL ON TABLE public.measured_boq_catalog_events FROM PUBLIC;
REVOKE ALL ON TABLE public.measured_boq_catalog_events FROM anon;
REVOKE ALL ON TABLE public.measured_boq_catalog_events FROM authenticated;
REVOKE ALL ON TABLE public.measured_boq_catalog_events FROM service_role;
GRANT SELECT ON TABLE public.measured_boq_catalog_events TO service_role;

REVOKE ALL ON TABLE public.measured_boq_catalog_packages FROM PUBLIC;
REVOKE ALL ON TABLE public.measured_boq_catalog_packages FROM anon;
REVOKE ALL ON TABLE public.measured_boq_catalog_packages FROM authenticated;
REVOKE ALL ON TABLE public.measured_boq_catalog_packages FROM service_role;
GRANT SELECT ON TABLE public.measured_boq_catalog_packages TO service_role;

REVOKE ALL ON TABLE public.measured_boq_catalog_revisions FROM PUBLIC;
REVOKE ALL ON TABLE public.measured_boq_catalog_revisions FROM anon;
REVOKE ALL ON TABLE public.measured_boq_catalog_revisions FROM authenticated;
REVOKE ALL ON TABLE public.measured_boq_catalog_revisions FROM service_role;
GRANT SELECT ON TABLE public.measured_boq_catalog_revisions TO service_role;

DROP POLICY IF EXISTS "estimate_authority_idempotency_deny_anon" ON public.estimate_authority_idempotency;
DROP POLICY IF EXISTS "estimate_authority_idempotency_deny_authenticated" ON public.estimate_authority_idempotency;
CREATE POLICY "estimate_authority_idempotency_deny_anon"
  ON public.estimate_authority_idempotency
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
CREATE POLICY "estimate_authority_idempotency_deny_authenticated"
  ON public.estimate_authority_idempotency
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "measured_boq_catalog_entries_deny_anon" ON public.measured_boq_catalog_entries;
DROP POLICY IF EXISTS "measured_boq_catalog_entries_deny_authenticated" ON public.measured_boq_catalog_entries;
CREATE POLICY "measured_boq_catalog_entries_deny_anon"
  ON public.measured_boq_catalog_entries
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
CREATE POLICY "measured_boq_catalog_entries_deny_authenticated"
  ON public.measured_boq_catalog_entries
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "measured_boq_catalog_events_deny_anon" ON public.measured_boq_catalog_events;
DROP POLICY IF EXISTS "measured_boq_catalog_events_deny_authenticated" ON public.measured_boq_catalog_events;
CREATE POLICY "measured_boq_catalog_events_deny_anon"
  ON public.measured_boq_catalog_events
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
CREATE POLICY "measured_boq_catalog_events_deny_authenticated"
  ON public.measured_boq_catalog_events
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "measured_boq_catalog_packages_deny_anon" ON public.measured_boq_catalog_packages;
DROP POLICY IF EXISTS "measured_boq_catalog_packages_deny_authenticated" ON public.measured_boq_catalog_packages;
CREATE POLICY "measured_boq_catalog_packages_deny_anon"
  ON public.measured_boq_catalog_packages
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
CREATE POLICY "measured_boq_catalog_packages_deny_authenticated"
  ON public.measured_boq_catalog_packages
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "measured_boq_catalog_revisions_deny_anon" ON public.measured_boq_catalog_revisions;
DROP POLICY IF EXISTS "measured_boq_catalog_revisions_deny_authenticated" ON public.measured_boq_catalog_revisions;
CREATE POLICY "measured_boq_catalog_revisions_deny_anon"
  ON public.measured_boq_catalog_revisions
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
CREATE POLICY "measured_boq_catalog_revisions_deny_authenticated"
  ON public.measured_boq_catalog_revisions
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
