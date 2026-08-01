-- Ticket 4C2C-B — Immutable measured-BOQ catalogue foundation + min library provenance
--
-- Adds:
--   - measured_boq_catalog_revisions / measured_boq_catalog_entries (private, immutable when published/retired)
--   - estimate_items library provenance columns (nullable for legacy/draft/category)
--   - header/item/catalogue integrity triggers
--   - browser draft RLS that forbids provenance injection
--
-- Does NOT:
--   - seed production catalogue rates
--   - create measured-BOQ persistence RPC
--   - change category-engine RPC / 4C2B markers
--   - update projects.estimated_gdv
--   - grant authenticated access to catalogue tables

-- ────────────────────────────────────────────────────────────────────
-- 1. Catalogue revisions
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.measured_boq_catalog_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_revision text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  schema_version text NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  vat_basis text NOT NULL DEFAULT 'exclusive',
  regional_basis text NOT NULL DEFAULT 'uk-region-multipliers-v1',
  source_description text NOT NULL,
  entry_count integer NOT NULL DEFAULT 0,
  content_checksum text NOT NULL,
  effective_from date NOT NULL,
  published_at timestamptz NULL,
  retired_at timestamptz NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  release_notes text NULL,
  CONSTRAINT measured_boq_catalog_revisions_catalog_revision_unique
    UNIQUE (catalog_revision),
  CONSTRAINT measured_boq_catalog_revisions_revision_grammar_check
    CHECK (
      length(catalog_revision) >= 15
      AND length(catalog_revision) <= 64
      AND catalog_revision ~ '^mboq-[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]+)?$'
    ),
  CONSTRAINT measured_boq_catalog_revisions_status_check
    CHECK (status IN ('draft', 'published', 'retired')),
  CONSTRAINT measured_boq_catalog_revisions_status_timestamps_check
    CHECK (
      (status = 'draft' AND published_at IS NULL AND retired_at IS NULL)
      OR (status = 'published' AND published_at IS NOT NULL AND retired_at IS NULL)
      OR (status = 'retired' AND published_at IS NOT NULL AND retired_at IS NOT NULL)
    ),
  CONSTRAINT measured_boq_catalog_revisions_currency_check
    CHECK (currency = 'GBP'),
  CONSTRAINT measured_boq_catalog_revisions_vat_basis_check
    CHECK (vat_basis = 'exclusive'),
  CONSTRAINT measured_boq_catalog_revisions_regional_basis_check
    CHECK (regional_basis = 'uk-region-multipliers-v1'),
  CONSTRAINT measured_boq_catalog_revisions_schema_version_check
    CHECK (
      length(btrim(schema_version)) > 0
      AND length(schema_version) <= 64
    ),
  CONSTRAINT measured_boq_catalog_revisions_source_description_check
    CHECK (
      length(btrim(source_description)) > 0
      AND length(source_description) <= 1000
    ),
  CONSTRAINT measured_boq_catalog_revisions_entry_count_check
    CHECK (entry_count >= 0),
  CONSTRAINT measured_boq_catalog_revisions_checksum_check
    CHECK (content_checksum ~ '^[0-9a-f]{64}$'),
  CONSTRAINT measured_boq_catalog_revisions_created_by_check
    CHECK (
      length(btrim(created_by)) > 0
      AND length(created_by) <= 200
    ),
  CONSTRAINT measured_boq_catalog_revisions_release_notes_check
    CHECK (release_notes IS NULL OR length(release_notes) <= 4000)
);

CREATE INDEX IF NOT EXISTS measured_boq_catalog_revisions_status_idx
  ON public.measured_boq_catalog_revisions (status, effective_from DESC);

COMMENT ON TABLE public.measured_boq_catalog_revisions IS
  'Immutable measured-BOQ catalogue revisions. Natural key: catalog_revision. Private; service_role only.';
COMMENT ON COLUMN public.measured_boq_catalog_revisions.catalog_revision IS
  'Natural revision identifier (mboq-YYYY.MM.DD[.N]). Never use UUID as revision identity.';
COMMENT ON COLUMN public.measured_boq_catalog_revisions.content_checksum IS
  'SHA-256 lowercase hex of canonical snapshot serialisation.';

DROP TRIGGER IF EXISTS measured_boq_catalog_revisions_set_updated_at
  ON public.measured_boq_catalog_revisions;
CREATE TRIGGER measured_boq_catalog_revisions_set_updated_at
  BEFORE UPDATE ON public.measured_boq_catalog_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────
-- 2. Catalogue entries
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.measured_boq_catalog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_revision text NOT NULL
    REFERENCES public.measured_boq_catalog_revisions (catalog_revision)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  rate_key text NOT NULL,
  display_name text NOT NULL,
  description text NULL,
  trade_or_domain text NOT NULL,
  unit text NOT NULL,
  cost_type text NOT NULL,
  base_unit_rate numeric(14, 4) NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  vat_basis text NOT NULL DEFAULT 'exclusive',
  source_reference text NULL,
  status text NOT NULL DEFAULT 'active',
  replacement_rate_key text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT measured_boq_catalog_entries_identity_unique
    UNIQUE (catalog_revision, rate_key),
  CONSTRAINT measured_boq_catalog_entries_rate_key_check
    CHECK (
      length(rate_key) >= 5
      AND length(rate_key) <= 160
      AND rate_key ~ '^[a-z0-9_]+(\.[a-z0-9_]+){2,}$'
    ),
  CONSTRAINT measured_boq_catalog_entries_display_name_check
    CHECK (
      length(btrim(display_name)) > 0
      AND length(display_name) <= 200
    ),
  CONSTRAINT measured_boq_catalog_entries_description_check
    CHECK (description IS NULL OR length(description) <= 2000),
  CONSTRAINT measured_boq_catalog_entries_trade_check
    CHECK (
      length(btrim(trade_or_domain)) > 0
      AND length(trade_or_domain) <= 100
    ),
  CONSTRAINT measured_boq_catalog_entries_unit_check
    CHECK (unit IN ('m2', 'm', 'item', 'hr', 'day')),
  CONSTRAINT measured_boq_catalog_entries_cost_type_check
    CHECK (cost_type IN ('labour', 'materials', 'combined')),
  CONSTRAINT measured_boq_catalog_entries_base_unit_rate_check
    CHECK (base_unit_rate > 0),
  CONSTRAINT measured_boq_catalog_entries_currency_check
    CHECK (currency = 'GBP'),
  CONSTRAINT measured_boq_catalog_entries_vat_basis_check
    CHECK (vat_basis = 'exclusive'),
  CONSTRAINT measured_boq_catalog_entries_status_check
    CHECK (status IN ('active', 'deprecated')),
  CONSTRAINT measured_boq_catalog_entries_source_reference_check
    CHECK (
      source_reference IS NULL
      OR (
        length(btrim(source_reference)) > 0
        AND length(source_reference) <= 500
      )
    ),
  CONSTRAINT measured_boq_catalog_entries_replacement_key_check
    CHECK (
      replacement_rate_key IS NULL
      OR (
        length(replacement_rate_key) >= 5
        AND length(replacement_rate_key) <= 160
        AND replacement_rate_key ~ '^[a-z0-9_]+(\.[a-z0-9_]+){2,}$'
        AND replacement_rate_key <> rate_key
      )
    )
);

CREATE INDEX IF NOT EXISTS measured_boq_catalog_entries_revision_idx
  ON public.measured_boq_catalog_entries (catalog_revision);

COMMENT ON TABLE public.measured_boq_catalog_entries IS
  'Measured-BOQ catalogue entries. Identity: (catalog_revision, rate_key). Private; service_role only.';

DROP TRIGGER IF EXISTS measured_boq_catalog_entries_set_updated_at
  ON public.measured_boq_catalog_entries;
CREATE TRIGGER measured_boq_catalog_entries_set_updated_at
  BEFORE UPDATE ON public.measured_boq_catalog_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────
-- 3. Immutability triggers (authoritative even for service_role)
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.measured_boq_catalog_revision_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('published', 'retired') THEN
      RAISE EXCEPTION 'CATALOG_REVISION_IMMUTABLE'
        USING ERRCODE = 'P0001',
              DETAIL = 'Published and retired catalogue revisions cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- draft → draft (full edit) or draft → published
    IF OLD.status = 'draft' THEN
      IF NEW.status = 'draft' THEN
        RETURN NEW;
      END IF;
      IF NEW.status = 'published' THEN
        IF NEW.published_at IS NULL THEN
          RAISE EXCEPTION 'CATALOG_PUBLISH_REQUIRES_PUBLISHED_AT'
            USING ERRCODE = '22023';
        END IF;
        IF NEW.retired_at IS NOT NULL THEN
          RAISE EXCEPTION 'CATALOG_PUBLISH_INVALID_RETIRED_AT'
            USING ERRCODE = '22023';
        END IF;
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'CATALOG_INVALID_STATUS_TRANSITION'
        USING ERRCODE = 'P0001',
              DETAIL = format('Cannot transition draft revision to %s', NEW.status);
    END IF;

    -- published → retired only (limited columns)
    IF OLD.status = 'published' THEN
      IF NEW.status = 'retired' THEN
        IF NEW.retired_at IS NULL THEN
          RAISE EXCEPTION 'CATALOG_RETIRE_REQUIRES_RETIRED_AT'
            USING ERRCODE = '22023';
        END IF;
        IF NEW.catalog_revision IS DISTINCT FROM OLD.catalog_revision
          OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
          OR NEW.currency IS DISTINCT FROM OLD.currency
          OR NEW.vat_basis IS DISTINCT FROM OLD.vat_basis
          OR NEW.regional_basis IS DISTINCT FROM OLD.regional_basis
          OR NEW.source_description IS DISTINCT FROM OLD.source_description
          OR NEW.entry_count IS DISTINCT FROM OLD.entry_count
          OR NEW.content_checksum IS DISTINCT FROM OLD.content_checksum
          OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
          OR NEW.published_at IS DISTINCT FROM OLD.published_at
          OR NEW.created_by IS DISTINCT FROM OLD.created_by
          OR NEW.release_notes IS DISTINCT FROM OLD.release_notes
          OR NEW.created_at IS DISTINCT FROM OLD.created_at
          OR NEW.id IS DISTINCT FROM OLD.id
        THEN
          RAISE EXCEPTION 'CATALOG_REVISION_IMMUTABLE'
            USING ERRCODE = 'P0001',
                  DETAIL = 'Only status, retired_at, and updated_at may change on retire';
        END IF;
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'CATALOG_REVISION_IMMUTABLE'
        USING ERRCODE = 'P0001',
              DETAIL = 'Published revisions may only transition to retired';
    END IF;

    -- retired is fully immutable (updated_at may still fire — block any content change)
    IF OLD.status = 'retired' THEN
      RAISE EXCEPTION 'CATALOG_REVISION_IMMUTABLE'
        USING ERRCODE = 'P0001',
              DETAIL = 'Retired catalogue revisions cannot be modified';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS measured_boq_catalog_revisions_immutable
  ON public.measured_boq_catalog_revisions;
CREATE TRIGGER measured_boq_catalog_revisions_immutable
  BEFORE UPDATE OR DELETE ON public.measured_boq_catalog_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.measured_boq_catalog_revision_immutable();

-- Ensures every affected parent revision is draft under a held row lock so
-- concurrent publication (UPDATE status) waits for the entry mutation to finish.
-- FOR SHARE is the least exclusive lock that still blocks status UPDATE.
CREATE OR REPLACE FUNCTION public.measured_boq_catalog_assert_parent_draft(
  p_revision text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_revision IS NULL OR length(btrim(p_revision)) = 0 THEN
    RAISE EXCEPTION 'CATALOG_REVISION_NOT_FOUND'
      USING ERRCODE = 'P0002',
            DETAIL = 'Parent catalogue revision is required';
  END IF;

  SELECT r.status INTO v_status
  FROM public.measured_boq_catalog_revisions r
  WHERE r.catalog_revision = p_revision
  FOR SHARE;

  IF NOT FOUND OR v_status IS NULL THEN
    RAISE EXCEPTION 'CATALOG_REVISION_NOT_FOUND'
      USING ERRCODE = 'P0002',
            DETAIL = format('Parent catalogue revision %s not found', p_revision);
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'CATALOG_ENTRY_IMMUTABLE'
      USING ERRCODE = 'P0001',
            DETAIL = format(
              'Catalogue entries may only be mutated while parent revision is draft (status=%s)',
              v_status
            );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.measured_boq_catalog_entry_parent_draft_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_old text;
  v_new text;
  v_first text;
  v_second text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.measured_boq_catalog_assert_parent_draft(NEW.catalog_revision);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.measured_boq_catalog_assert_parent_draft(OLD.catalog_revision);
    RETURN OLD;
  END IF;

  -- UPDATE: lock and validate OLD and NEW parents (deterministic order when different)
  v_old := OLD.catalog_revision;
  v_new := NEW.catalog_revision;

  IF v_old IS NOT DISTINCT FROM v_new THEN
    PERFORM public.measured_boq_catalog_assert_parent_draft(v_new);
  ELSE
    IF v_old < v_new THEN
      v_first := v_old;
      v_second := v_new;
    ELSE
      v_first := v_new;
      v_second := v_old;
    END IF;
    PERFORM public.measured_boq_catalog_assert_parent_draft(v_first);
    PERFORM public.measured_boq_catalog_assert_parent_draft(v_second);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS measured_boq_catalog_entries_draft_only
  ON public.measured_boq_catalog_entries;
CREATE TRIGGER measured_boq_catalog_entries_draft_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.measured_boq_catalog_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.measured_boq_catalog_entry_parent_draft_only();

-- ────────────────────────────────────────────────────────────────────
-- 4. Catalogue privileges and RLS
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE public.measured_boq_catalog_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measured_boq_catalog_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.measured_boq_catalog_revisions FROM PUBLIC;
REVOKE ALL ON TABLE public.measured_boq_catalog_revisions FROM anon;
REVOKE ALL ON TABLE public.measured_boq_catalog_revisions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.measured_boq_catalog_revisions TO service_role;

REVOKE ALL ON TABLE public.measured_boq_catalog_entries FROM PUBLIC;
REVOKE ALL ON TABLE public.measured_boq_catalog_entries FROM anon;
REVOKE ALL ON TABLE public.measured_boq_catalog_entries FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.measured_boq_catalog_entries TO service_role;

-- No authenticated/anon policies (service_role bypasses RLS).

-- ────────────────────────────────────────────────────────────────────
-- 5. estimate_items provenance columns
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE public.estimate_items
  ADD COLUMN IF NOT EXISTS rate_source text NULL,
  ADD COLUMN IF NOT EXISTS rate_key text NULL,
  ADD COLUMN IF NOT EXISTS catalog_revision text NULL,
  ADD COLUMN IF NOT EXISTS base_unit_rate numeric(14, 4) NULL,
  ADD COLUMN IF NOT EXISTS regional_multiplier numeric(8, 4) NULL,
  ADD COLUMN IF NOT EXISTS resolved_unit_rate numeric(14, 4) NULL;

ALTER TABLE public.estimate_items
  DROP CONSTRAINT IF EXISTS estimate_items_library_provenance_set_check;

ALTER TABLE public.estimate_items
  ADD CONSTRAINT estimate_items_library_provenance_set_check
  CHECK (
    (
      rate_source IS NULL
      AND rate_key IS NULL
      AND catalog_revision IS NULL
      AND base_unit_rate IS NULL
      AND regional_multiplier IS NULL
      AND resolved_unit_rate IS NULL
    )
    OR (
      rate_source = 'library'
      AND rate_key IS NOT NULL
      AND length(btrim(rate_key)) > 0
      AND length(rate_key) <= 160
      AND catalog_revision IS NOT NULL
      AND length(btrim(catalog_revision)) > 0
      AND length(catalog_revision) <= 64
      AND base_unit_rate IS NOT NULL
      AND base_unit_rate > 0
      AND regional_multiplier IS NOT NULL
      AND regional_multiplier > 0
      AND resolved_unit_rate IS NOT NULL
      AND resolved_unit_rate > 0
    )
  );

-- Composite FK: nulls allowed for draft/category; partial sets blocked by CHECK above.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'estimate_items_catalog_entry_fkey'
  ) THEN
    ALTER TABLE public.estimate_items
      ADD CONSTRAINT estimate_items_catalog_entry_fkey
      FOREIGN KEY (catalog_revision, rate_key)
      REFERENCES public.measured_boq_catalog_entries (catalog_revision, rate_key)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.estimate_items
  VALIDATE CONSTRAINT estimate_items_catalog_entry_fkey;

-- Header catalog_revision must reference a real catalogue revision when set.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'estimates_catalog_revision_fkey'
  ) THEN
    ALTER TABLE public.estimates
      ADD CONSTRAINT estimates_catalog_revision_fkey
      FOREIGN KEY (catalog_revision)
      REFERENCES public.measured_boq_catalog_revisions (catalog_revision)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.estimates
  VALIDATE CONSTRAINT estimates_catalog_revision_fkey;

COMMENT ON COLUMN public.estimate_items.rate_source IS
  'Library provenance source; null for draft/category. Only library authorised in 4C2C-B.';
COMMENT ON COLUMN public.estimate_items.rate_key IS
  'Stable catalogue rate key for library lines; null when no library provenance.';
COMMENT ON COLUMN public.estimate_items.catalog_revision IS
  'Pinned catalogue revision for library lines; must equal estimates.catalog_revision for measured-boq-engine.';
COMMENT ON COLUMN public.estimate_items.base_unit_rate IS
  'Trusted catalogue base unit rate at save time (GBP exclusive).';
COMMENT ON COLUMN public.estimate_items.regional_multiplier IS
  'Regional multiplier applied at save time.';
COMMENT ON COLUMN public.estimate_items.resolved_unit_rate IS
  'Resolved unit rate after regional adjustment at save time.';

-- ────────────────────────────────────────────────────────────────────
-- 6. Header / item / arithmetic integrity trigger
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.estimate_items_library_provenance_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_authority text;
  v_header_revision text;
  v_expected_resolved numeric(14, 4);
  v_expected_total numeric(14, 4);
BEGIN
  -- Lock header so concurrent header authority/revision changes wait for item write.
  -- SECURITY DEFINER: integrity must observe measured headers even when the
  -- invoker lacks UPDATE policy on non-draft estimates (SELECT FOR UPDATE + RLS).
  SELECT e.pricing_authority, e.catalog_revision
  INTO v_authority, v_header_revision
  FROM public.estimates e
  WHERE e.id = NEW.estimate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ESTIMATE_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  -- All-null provenance is required for none and category-engine
  IF v_authority IN ('none', 'category-engine') THEN
    IF NEW.rate_source IS NOT NULL
      OR NEW.rate_key IS NOT NULL
      OR NEW.catalog_revision IS NOT NULL
      OR NEW.base_unit_rate IS NOT NULL
      OR NEW.regional_multiplier IS NOT NULL
      OR NEW.resolved_unit_rate IS NOT NULL
    THEN
      RAISE EXCEPTION 'PROVENANCE_FORBIDDEN_FOR_AUTHORITY'
        USING ERRCODE = 'P0001',
              DETAIL = format(
                'Library provenance columns must be null when pricing_authority=%s',
                v_authority
              );
    END IF;
    RETURN NEW;
  END IF;

  IF v_authority = 'measured-boq-engine' THEN
    IF v_header_revision IS NULL OR length(btrim(v_header_revision)) = 0 THEN
      RAISE EXCEPTION 'MEASURED_HEADER_REVISION_REQUIRED'
        USING ERRCODE = 'P0001';
    END IF;

    IF NEW.rate_source IS DISTINCT FROM 'library'
      OR NEW.rate_key IS NULL
      OR NEW.catalog_revision IS NULL
      OR NEW.base_unit_rate IS NULL
      OR NEW.regional_multiplier IS NULL
      OR NEW.resolved_unit_rate IS NULL
    THEN
      RAISE EXCEPTION 'MEASURED_LIBRARY_PROVENANCE_REQUIRED'
        USING ERRCODE = 'P0001',
              DETAIL = 'measured-boq-engine items require complete library provenance';
    END IF;

    IF NEW.catalog_revision IS DISTINCT FROM v_header_revision THEN
      RAISE EXCEPTION 'ITEM_HEADER_REVISION_MISMATCH'
        USING ERRCODE = 'P0001',
              DETAIL = 'estimate_items.catalog_revision must equal estimates.catalog_revision';
    END IF;

    IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
      RAISE EXCEPTION 'MEASURED_QUANTITY_INVALID'
        USING ERRCODE = '22023',
              DETAIL = 'measured library items require positive quantity';
    END IF;

    v_expected_resolved := round(NEW.base_unit_rate * NEW.regional_multiplier, 2);
    IF abs(NEW.resolved_unit_rate - v_expected_resolved) > 0.01 THEN
      RAISE EXCEPTION 'RESOLVED_UNIT_RATE_ARITHMETIC'
        USING ERRCODE = 'P0001',
              DETAIL = format(
                'resolved_unit_rate %s != round(base*mult,2)=%s',
                NEW.resolved_unit_rate,
                v_expected_resolved
              );
    END IF;

    v_expected_total := round(NEW.quantity * NEW.resolved_unit_rate, 2);
    IF abs(NEW.total_cost - v_expected_total) > 0.01 THEN
      RAISE EXCEPTION 'LINE_TOTAL_ARITHMETIC'
        USING ERRCODE = 'P0001',
              DETAIL = format(
                'total_cost %s != round(qty*resolved,2)=%s',
                NEW.total_cost,
                v_expected_total
              );
    END IF;

    RETURN NEW;
  END IF;

  -- Unknown authority values should already be blocked on estimates CHECK
  RAISE EXCEPTION 'UNKNOWN_PRICING_AUTHORITY'
    USING ERRCODE = 'P0001',
          DETAIL = format('Unsupported pricing_authority=%s', v_authority);
END;
$$;

DROP TRIGGER IF EXISTS estimate_items_library_provenance_integrity
  ON public.estimate_items;
CREATE TRIGGER estimate_items_library_provenance_integrity
  BEFORE INSERT OR UPDATE ON public.estimate_items
  FOR EACH ROW
  EXECUTE FUNCTION public.estimate_items_library_provenance_integrity();

-- ────────────────────────────────────────────────────────────────────
-- 6b. Header-side measured provenance / revision enforcement
-- ────────────────────────────────────────────────────────────────────

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

DROP TRIGGER IF EXISTS estimates_measured_header_integrity
  ON public.estimates;
CREATE TRIGGER estimates_measured_header_integrity
  BEFORE INSERT OR UPDATE OF pricing_authority, pricing_policy_version, catalog_revision
  ON public.estimates
  FOR EACH ROW
  EXECUTE FUNCTION public.estimates_measured_header_integrity();

-- ────────────────────────────────────────────────────────────────────
-- 7. Harden browser draft RLS — forbid provenance injection
-- ────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimate_items'
      AND policyname = 'estimate_items_insert_draft_own'
  ) THEN
    ALTER POLICY "estimate_items_insert_draft_own" ON public.estimate_items
      WITH CHECK (
        auth.uid() = user_id
        AND rate_source IS NULL
        AND rate_key IS NULL
        AND catalog_revision IS NULL
        AND base_unit_rate IS NULL
        AND regional_multiplier IS NULL
        AND resolved_unit_rate IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.estimates e
          JOIN public.projects p ON p.id = e.project_id
          WHERE e.id = estimate_items.estimate_id
            AND e.user_id = auth.uid()
            AND p.user_id = auth.uid()
            AND e.pricing_authority = 'none'
        )
      );
  ELSE
    CREATE POLICY "estimate_items_insert_draft_own"
      ON public.estimate_items
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() = user_id
        AND rate_source IS NULL
        AND rate_key IS NULL
        AND catalog_revision IS NULL
        AND base_unit_rate IS NULL
        AND regional_multiplier IS NULL
        AND resolved_unit_rate IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.estimates e
          JOIN public.projects p ON p.id = e.project_id
          WHERE e.id = estimate_items.estimate_id
            AND e.user_id = auth.uid()
            AND p.user_id = auth.uid()
            AND e.pricing_authority = 'none'
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimate_items'
      AND policyname = 'estimate_items_update_draft_own'
  ) THEN
    ALTER POLICY "estimate_items_update_draft_own" ON public.estimate_items
      USING (
        EXISTS (
          SELECT 1
          FROM public.estimates e
          JOIN public.projects p ON p.id = e.project_id
          WHERE e.id = estimate_items.estimate_id
            AND e.user_id = auth.uid()
            AND p.user_id = auth.uid()
            AND e.pricing_authority = 'none'
        )
      )
      WITH CHECK (
        auth.uid() = user_id
        AND rate_source IS NULL
        AND rate_key IS NULL
        AND catalog_revision IS NULL
        AND base_unit_rate IS NULL
        AND regional_multiplier IS NULL
        AND resolved_unit_rate IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.estimates e
          JOIN public.projects p ON p.id = e.project_id
          WHERE e.id = estimate_items.estimate_id
            AND e.user_id = auth.uid()
            AND p.user_id = auth.uid()
            AND e.pricing_authority = 'none'
        )
      );
  ELSE
    CREATE POLICY "estimate_items_update_draft_own"
      ON public.estimate_items
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.estimates e
          JOIN public.projects p ON p.id = e.project_id
          WHERE e.id = estimate_items.estimate_id
            AND e.user_id = auth.uid()
            AND p.user_id = auth.uid()
            AND e.pricing_authority = 'none'
        )
      )
      WITH CHECK (
        auth.uid() = user_id
        AND rate_source IS NULL
        AND rate_key IS NULL
        AND catalog_revision IS NULL
        AND base_unit_rate IS NULL
        AND regional_multiplier IS NULL
        AND resolved_unit_rate IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.estimates e
          JOIN public.projects p ON p.id = e.project_id
          WHERE e.id = estimate_items.estimate_id
            AND e.user_id = auth.uid()
            AND p.user_id = auth.uid()
            AND e.pricing_authority = 'none'
        )
      );
  END IF;
END
$$;
