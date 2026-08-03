-- Ticket 4C2E-B2C / B2C1 — Measured-BOQ catalogue persistence foundation
--
-- Adds:
--   - measured_boq_catalog_packages (1:1 with revision, raw artifacts + input checksum)
--   - measured_boq_catalog_events (append-only audit / request idempotency)
--   - additive revision provenance/lifecycle columns (nullable for legacy rows)
--   - B1 v2 package input-checksum SQL helper + package checksum enforcement
--   - rewritten revision immutability trigger (all rows; lifecycle via trusted owner + GUC)
--   - entry immutability (no application-role write; UPDATE/DELETE always blocked)
--   - package/event immutability triggers
--   - fail-closed grants: service_role SELECT only on all four catalogue tables;
--     no direct application-role INSERT/UPDATE/DELETE (RPC-only writes later)
--
-- Does NOT:
--   - create public persist/publish/retire/rollback RPCs or stubs
--   - seed catalogue data or fabricate legacy package provenance
--   - create an active-revision pointer
--   - change runtime readers or estimate integration
--   - grant JWT access to catalogue tables
--   - leave a legacy direct-write bypass for pre-package rows

-- ────────────────────────────────────────────────────────────────────
-- 0. Extensions (digest for B1 v2 preimage)
-- ────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ────────────────────────────────────────────────────────────────────
-- 1. Additive revision columns (legacy-compatible, nullable where needed)
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE public.measured_boq_catalog_revisions
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS licence_status text,
  ADD COLUMN IF NOT EXISTS production boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS input_checksum text,
  ADD COLUMN IF NOT EXISTS normaliser_version text,
  ADD COLUMN IF NOT EXISTS published_by_kind text,
  ADD COLUMN IF NOT EXISTS published_by_id uuid,
  ADD COLUMN IF NOT EXISTS retired_by_kind text,
  ADD COLUMN IF NOT EXISTS retired_by_id uuid,
  ADD COLUMN IF NOT EXISTS retirement_reason text;

ALTER TABLE public.measured_boq_catalog_revisions
  DROP CONSTRAINT IF EXISTS measured_boq_catalog_revisions_licence_status_check;

ALTER TABLE public.measured_boq_catalog_revisions
  ADD CONSTRAINT measured_boq_catalog_revisions_licence_status_check
  CHECK (
    licence_status IS NULL
    OR licence_status IN ('synthetic', 'rights_unverified', 'approved')
  );

ALTER TABLE public.measured_boq_catalog_revisions
  DROP CONSTRAINT IF EXISTS measured_boq_catalog_revisions_input_checksum_check;

ALTER TABLE public.measured_boq_catalog_revisions
  ADD CONSTRAINT measured_boq_catalog_revisions_input_checksum_check
  CHECK (
    input_checksum IS NULL
    OR input_checksum ~ '^[0-9a-f]{64}$'
  );

ALTER TABLE public.measured_boq_catalog_revisions
  DROP CONSTRAINT IF EXISTS measured_boq_catalog_revisions_source_id_check;

ALTER TABLE public.measured_boq_catalog_revisions
  ADD CONSTRAINT measured_boq_catalog_revisions_source_id_check
  CHECK (
    source_id IS NULL
    OR (
      length(btrim(source_id)) > 0
      AND length(source_id) <= 128
    )
  );

ALTER TABLE public.measured_boq_catalog_revisions
  DROP CONSTRAINT IF EXISTS measured_boq_catalog_revisions_normaliser_version_check;

ALTER TABLE public.measured_boq_catalog_revisions
  ADD CONSTRAINT measured_boq_catalog_revisions_normaliser_version_check
  CHECK (
    normaliser_version IS NULL
    OR (
      length(btrim(normaliser_version)) > 0
      AND length(normaliser_version) <= 64
    )
  );

ALTER TABLE public.measured_boq_catalog_revisions
  DROP CONSTRAINT IF EXISTS measured_boq_catalog_revisions_published_by_kind_check;

ALTER TABLE public.measured_boq_catalog_revisions
  ADD CONSTRAINT measured_boq_catalog_revisions_published_by_kind_check
  CHECK (
    published_by_kind IS NULL
    OR published_by_kind IN ('service_role', 'admin', 'system')
  );

ALTER TABLE public.measured_boq_catalog_revisions
  DROP CONSTRAINT IF EXISTS measured_boq_catalog_revisions_retired_by_kind_check;

ALTER TABLE public.measured_boq_catalog_revisions
  ADD CONSTRAINT measured_boq_catalog_revisions_retired_by_kind_check
  CHECK (
    retired_by_kind IS NULL
    OR retired_by_kind IN ('service_role', 'admin', 'system')
  );

ALTER TABLE public.measured_boq_catalog_revisions
  DROP CONSTRAINT IF EXISTS measured_boq_catalog_revisions_retirement_reason_check;

ALTER TABLE public.measured_boq_catalog_revisions
  ADD CONSTRAINT measured_boq_catalog_revisions_retirement_reason_check
  CHECK (
    retirement_reason IS NULL
    OR (
      length(btrim(retirement_reason)) > 0
      AND length(retirement_reason) <= 2000
    )
  );

CREATE INDEX IF NOT EXISTS measured_boq_catalog_revisions_input_checksum_idx
  ON public.measured_boq_catalog_revisions (input_checksum)
  WHERE input_checksum IS NOT NULL;

COMMENT ON COLUMN public.measured_boq_catalog_revisions.input_checksum IS
  'Denormalised B1 package input checksum (non-unique). Authoritative unique value lives on packages.';
COMMENT ON COLUMN public.measured_boq_catalog_revisions.licence_status IS
  'Package licence class (synthetic | rights_unverified | approved). Nullable for legacy rows.';
COMMENT ON COLUMN public.measured_boq_catalog_revisions.production IS
  'Package production flag. Default false; production:true not creatable via current B1.';

-- ────────────────────────────────────────────────────────────────────
-- 2. Packages table
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.measured_boq_catalog_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL,
  catalog_revision text NOT NULL,
  input_checksum text NOT NULL,
  content_checksum text NOT NULL,
  source_id text NOT NULL,
  licence_status text NOT NULL,
  production boolean NOT NULL DEFAULT false,
  manifest_version integer NOT NULL,
  normaliser_version text NOT NULL,
  manifest_text text NOT NULL,
  snapshot_text text NOT NULL,
  validation_report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT measured_boq_catalog_packages_revision_id_unique
    UNIQUE (revision_id),
  CONSTRAINT measured_boq_catalog_packages_input_checksum_unique
    UNIQUE (input_checksum),
  CONSTRAINT measured_boq_catalog_packages_revision_id_fkey
    FOREIGN KEY (revision_id)
    REFERENCES public.measured_boq_catalog_revisions (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT measured_boq_catalog_packages_catalog_revision_fkey
    FOREIGN KEY (catalog_revision)
    REFERENCES public.measured_boq_catalog_revisions (catalog_revision)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT measured_boq_catalog_packages_input_checksum_check
    CHECK (input_checksum ~ '^[0-9a-f]{64}$'),
  CONSTRAINT measured_boq_catalog_packages_content_checksum_check
    CHECK (content_checksum ~ '^[0-9a-f]{64}$'),
  CONSTRAINT measured_boq_catalog_packages_source_id_check
    CHECK (
      length(btrim(source_id)) > 0
      AND length(source_id) <= 128
    ),
  CONSTRAINT measured_boq_catalog_packages_licence_status_check
    CHECK (licence_status IN ('synthetic', 'rights_unverified', 'approved')),
  CONSTRAINT measured_boq_catalog_packages_manifest_version_check
    CHECK (manifest_version >= 1 AND manifest_version <= 9999),
  CONSTRAINT measured_boq_catalog_packages_normaliser_version_check
    CHECK (
      length(btrim(normaliser_version)) > 0
      AND length(normaliser_version) <= 64
    ),
  CONSTRAINT measured_boq_catalog_packages_manifest_size_check
    CHECK (pg_catalog.octet_length(manifest_text) <= 1048576),
  CONSTRAINT measured_boq_catalog_packages_snapshot_size_check
    CHECK (pg_catalog.octet_length(snapshot_text) <= 8388608),
  CONSTRAINT measured_boq_catalog_packages_report_size_check
    CHECK (pg_catalog.octet_length(validation_report::text) <= 2097152)
);

CREATE INDEX IF NOT EXISTS measured_boq_catalog_packages_catalog_revision_idx
  ON public.measured_boq_catalog_packages (catalog_revision);

COMMENT ON TABLE public.measured_boq_catalog_packages IS
  'Immutable package artifacts for measured-BOQ catalogue revisions. 1:1 with revision_id. No reverse package_id on revisions.';
COMMENT ON COLUMN public.measured_boq_catalog_packages.input_checksum IS
  'B1 mboq-package-v2 SHA-256 hex of raw manifest+snapshot artifact pair. Globally unique.';
COMMENT ON COLUMN public.measured_boq_catalog_packages.manifest_text IS
  'Exact raw MANIFEST bytes (text). Checksum preimage. Max 1 MiB.';
COMMENT ON COLUMN public.measured_boq_catalog_packages.snapshot_text IS
  'Exact raw snapshot bytes (text). Checksum preimage. Max 8 MiB.';

-- ────────────────────────────────────────────────────────────────────
-- 3. Events table (append-only)
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.measured_boq_catalog_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  command_scope text NOT NULL,
  request_id uuid NOT NULL,
  catalog_revision text NOT NULL,
  revision_id uuid NOT NULL,
  package_id uuid NULL,
  prior_revision_id uuid NULL,
  input_checksum text NULL,
  content_checksum text NULL,
  actor_kind text NOT NULL,
  actor_user_id uuid NULL,
  reason text NULL,
  result text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT measured_boq_catalog_events_request_unique
    UNIQUE (command_scope, request_id),
  CONSTRAINT measured_boq_catalog_events_revision_id_fkey
    FOREIGN KEY (revision_id)
    REFERENCES public.measured_boq_catalog_revisions (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT measured_boq_catalog_events_package_id_fkey
    FOREIGN KEY (package_id)
    REFERENCES public.measured_boq_catalog_packages (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT measured_boq_catalog_events_prior_revision_id_fkey
    FOREIGN KEY (prior_revision_id)
    REFERENCES public.measured_boq_catalog_revisions (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT measured_boq_catalog_events_event_type_check
    CHECK (
      event_type IN (
        'ingestion_accepted',
        'ingestion_replayed',
        'publication',
        'publication_replay',
        'retirement',
        'rollback_recorded',
        'rejected_transition'
      )
    ),
  CONSTRAINT measured_boq_catalog_events_command_scope_check
    CHECK (
      command_scope IN (
        'persist_draft',
        'publish',
        'retire',
        'rollback_retire'
      )
    ),
  CONSTRAINT measured_boq_catalog_events_actor_kind_check
    CHECK (actor_kind IN ('service_role', 'admin', 'system')),
  CONSTRAINT measured_boq_catalog_events_result_check
    CHECK (
      length(btrim(result)) > 0
      AND length(result) <= 64
    ),
  CONSTRAINT measured_boq_catalog_events_input_checksum_check
    CHECK (
      input_checksum IS NULL
      OR input_checksum ~ '^[0-9a-f]{64}$'
    ),
  CONSTRAINT measured_boq_catalog_events_content_checksum_check
    CHECK (
      content_checksum IS NULL
      OR content_checksum ~ '^[0-9a-f]{64}$'
    ),
  CONSTRAINT measured_boq_catalog_events_reason_check
    CHECK (
      reason IS NULL
      OR (
        length(btrim(reason)) > 0
        AND length(reason) <= 2000
      )
    ),
  CONSTRAINT measured_boq_catalog_events_payload_size_check
    CHECK (pg_catalog.octet_length(payload_json::text) <= 2097152)
);

CREATE INDEX IF NOT EXISTS measured_boq_catalog_events_revision_id_idx
  ON public.measured_boq_catalog_events (revision_id, created_at DESC);

CREATE INDEX IF NOT EXISTS measured_boq_catalog_events_catalog_revision_idx
  ON public.measured_boq_catalog_events (catalog_revision, created_at DESC);

COMMENT ON TABLE public.measured_boq_catalog_events IS
  'Append-only catalogue ops audit. UNIQUE(command_scope, request_id) for request idempotency.';

-- ────────────────────────────────────────────────────────────────────
-- 4. B1 v2 package input-checksum helper (byte integrity only)
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.measured_boq_package_input_checksum(
  p_manifest_text text,
  p_snapshot_text text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_manifest_digest text;
  v_snapshot_digest text;
  v_payload text;
BEGIN
  IF p_manifest_text IS NULL OR p_snapshot_text IS NULL THEN
    RAISE EXCEPTION 'CATALOG_PACKAGE_CHECKSUM_INVALID'
      USING ERRCODE = '22023',
            DETAIL = 'manifest_text and snapshot_text are required';
  END IF;

  v_manifest_digest := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_manifest_text, 'UTF8'), 'sha256'),
    'hex'
  );
  v_snapshot_digest := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_snapshot_text, 'UTF8'), 'sha256'),
    'hex'
  );

  v_payload :=
    'mboq-package-v2' || chr(10)
    || 'manifest:' || v_manifest_digest || chr(10)
    || 'snapshot:' || v_snapshot_digest || chr(10);

  RETURN pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(v_payload, 'UTF8'), 'sha256'),
    'hex'
  );
END;
$$;

COMMENT ON FUNCTION public.measured_boq_package_input_checksum(text, text) IS
  'B1 mboq-package-v2 package input checksum (byte integrity). Not semantic catalogue validation.';

REVOKE ALL ON FUNCTION public.measured_boq_package_input_checksum(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.measured_boq_package_input_checksum(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.measured_boq_package_input_checksum(text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.measured_boq_package_input_checksum(text, text) FROM service_role;
-- No application-role EXECUTE. Future SECURITY DEFINER RPCs invoke via function ownership.

-- ────────────────────────────────────────────────────────────────────
-- 5. Trusted-owner helper for lifecycle GUC enforcement
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.measured_boq_catalog_is_trusted_lifecycle_owner()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_owner name;
  v_user name := CURRENT_USER;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(c.relowner)
  INTO v_owner
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'measured_boq_catalog_revisions'
    AND c.relkind = 'r';

  IF v_owner IS NULL THEN
    RETURN false;
  END IF;

  -- SECURITY DEFINER lifecycle RPCs run as table/function owner (postgres / supabase_admin).
  -- service_role is never trusted for direct lifecycle DML even with a spoofed GUC.
  -- Use CURRENT_USER keyword (not pg_catalog.current_user — that parses as a relation).
  RETURN v_user IS NOT DISTINCT FROM v_owner
    OR v_user IN ('postgres', 'supabase_admin');
END;
$$;

REVOKE ALL ON FUNCTION public.measured_boq_catalog_is_trusted_lifecycle_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.measured_boq_catalog_is_trusted_lifecycle_owner() FROM anon;
REVOKE ALL ON FUNCTION public.measured_boq_catalog_is_trusted_lifecycle_owner() FROM authenticated;
REVOKE ALL ON FUNCTION public.measured_boq_catalog_is_trusted_lifecycle_owner() FROM service_role;
-- Internal helper only; invoked by triggers under function ownership.

-- ────────────────────────────────────────────────────────────────────
-- 6. Package checksum enforcement + immutability
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.measured_boq_catalog_package_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_expected text;
  v_rev_label text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CATALOG_PACKAGE_IMMUTABLE'
      USING ERRCODE = 'P0001',
            DETAIL = 'Package rows cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'CATALOG_PACKAGE_IMMUTABLE'
      USING ERRCODE = 'P0001',
            DETAIL = 'Package rows cannot be updated';
  END IF;

  -- INSERT: enforce checksum preimage + revision label consistency
  v_expected := public.measured_boq_package_input_checksum(NEW.manifest_text, NEW.snapshot_text);
  IF NEW.input_checksum IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'CATALOG_PACKAGE_CHECKSUM_MISMATCH'
      USING ERRCODE = 'P0001',
            DETAIL = 'input_checksum does not match B1 mboq-package-v2 preimage of stored artifact text';
  END IF;

  SELECT r.catalog_revision
  INTO v_rev_label
  FROM public.measured_boq_catalog_revisions r
  WHERE r.id = NEW.revision_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CATALOG_REVISION_NOT_FOUND'
      USING ERRCODE = 'P0002',
            DETAIL = 'Package revision_id not found';
  END IF;

  IF NEW.catalog_revision IS DISTINCT FROM v_rev_label THEN
    RAISE EXCEPTION 'CATALOG_PACKAGE_REVISION_MISMATCH'
      USING ERRCODE = 'P0001',
            DETAIL = 'catalog_revision must match the referenced revision label';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS measured_boq_catalog_packages_immutable
  ON public.measured_boq_catalog_packages;
CREATE TRIGGER measured_boq_catalog_packages_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.measured_boq_catalog_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.measured_boq_catalog_package_immutable();

-- ────────────────────────────────────────────────────────────────────
-- 7. Event append-only enforcement
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.measured_boq_catalog_event_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'CATALOG_EVENT_APPEND_ONLY'
      USING ERRCODE = 'P0001',
            DETAIL = 'Catalogue events cannot be updated';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CATALOG_EVENT_APPEND_ONLY'
      USING ERRCODE = 'P0001',
            DETAIL = 'Catalogue events cannot be deleted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS measured_boq_catalog_events_append_only
  ON public.measured_boq_catalog_events;
CREATE TRIGGER measured_boq_catalog_events_append_only
  BEFORE UPDATE OR DELETE ON public.measured_boq_catalog_events
  FOR EACH ROW
  EXECUTE FUNCTION public.measured_boq_catalog_event_append_only();

-- ────────────────────────────────────────────────────────────────────
-- 8. Revision immutability rewrite (same migration TX as additive columns)
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.measured_boq_catalog_revision_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_cmd text;
  v_trusted boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('published', 'retired') THEN
      RAISE EXCEPTION 'CATALOG_REVISION_IMMUTABLE'
        USING ERRCODE = 'P0001',
              DETAIL = 'Published and retired catalogue revisions cannot be deleted';
    END IF;
    -- Package-backed drafts cannot be hard-deleted in B2 (ON DELETE RESTRICT + explicit block).
    IF EXISTS (
      SELECT 1
      FROM public.measured_boq_catalog_packages p
      WHERE p.revision_id = OLD.id
    ) THEN
      RAISE EXCEPTION 'CATALOG_REVISION_IMMUTABLE'
        USING ERRCODE = 'P0001',
              DETAIL = 'Package-backed revisions cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  v_trusted := public.measured_boq_catalog_is_trusted_lifecycle_owner();
  BEGIN
    v_cmd := pg_catalog.current_setting('app.measured_boq_catalog_lifecycle_command', true);
  EXCEPTION
    WHEN OTHERS THEN
      v_cmd := NULL;
  END;
  IF v_cmd IS NOT NULL AND length(btrim(v_cmd)) = 0 THEN
    v_cmd := NULL;
  END IF;

  -- Identity columns never change (every row, legacy and package-backed).
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.catalog_revision IS DISTINCT FROM OLD.catalog_revision
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'CATALOG_REVISION_IMMUTABLE'
      USING ERRCODE = 'P0001',
            DETAIL = 'Revision identity columns cannot change';
  END IF;

  -- Content / provenance always immutable after insert (no legacy content-edit bypass).
  IF NEW.schema_version IS DISTINCT FROM OLD.schema_version
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.vat_basis IS DISTINCT FROM OLD.vat_basis
    OR NEW.regional_basis IS DISTINCT FROM OLD.regional_basis
    OR NEW.source_description IS DISTINCT FROM OLD.source_description
    OR NEW.entry_count IS DISTINCT FROM OLD.entry_count
    OR NEW.content_checksum IS DISTINCT FROM OLD.content_checksum
    OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
    OR NEW.release_notes IS DISTINCT FROM OLD.release_notes
    OR NEW.source_id IS DISTINCT FROM OLD.source_id
    OR NEW.licence_status IS DISTINCT FROM OLD.licence_status
    OR NEW.production IS DISTINCT FROM OLD.production
    OR NEW.input_checksum IS DISTINCT FROM OLD.input_checksum
    OR NEW.normaliser_version IS DISTINCT FROM OLD.normaliser_version
  THEN
    RAISE EXCEPTION 'CATALOG_REVISION_IMMUTABLE'
      USING ERRCODE = 'P0001',
            DETAIL = 'Revision content and provenance cannot change after insert';
  END IF;

  IF OLD.status = 'retired' THEN
    RAISE EXCEPTION 'CATALOG_REVISION_IMMUTABLE'
      USING ERRCODE = 'P0001',
            DETAIL = 'Retired catalogue revisions cannot be modified';
  END IF;

  IF OLD.status = 'draft' THEN
    IF NEW.status = 'draft' THEN
      -- Only no-op / updated_at-only updates allowed; no content or lifecycle change.
      IF NEW.status IS DISTINCT FROM OLD.status
        OR NEW.published_at IS DISTINCT FROM OLD.published_at
        OR NEW.published_by_kind IS DISTINCT FROM OLD.published_by_kind
        OR NEW.published_by_id IS DISTINCT FROM OLD.published_by_id
        OR NEW.retired_at IS DISTINCT FROM OLD.retired_at
        OR NEW.retired_by_kind IS DISTINCT FROM OLD.retired_by_kind
        OR NEW.retired_by_id IS DISTINCT FROM OLD.retired_by_id
        OR NEW.retirement_reason IS DISTINCT FROM OLD.retirement_reason
      THEN
        RAISE EXCEPTION 'CATALOG_REVISION_IMMUTABLE'
          USING ERRCODE = 'P0001',
                DETAIL = 'Draft lifecycle metadata cannot change without a trusted lifecycle command';
      END IF;
      RETURN NEW;
    END IF;

    IF NEW.status = 'published' THEN
      IF NEW.published_at IS NULL THEN
        RAISE EXCEPTION 'CATALOG_PUBLISH_REQUIRES_PUBLISHED_AT'
          USING ERRCODE = '22023';
      END IF;
      IF NEW.retired_at IS NOT NULL
        OR NEW.retired_by_kind IS DISTINCT FROM OLD.retired_by_kind
        OR NEW.retired_by_id IS DISTINCT FROM OLD.retired_by_id
        OR NEW.retirement_reason IS DISTINCT FROM OLD.retirement_reason
      THEN
        RAISE EXCEPTION 'CATALOG_PUBLISH_INVALID_RETIRED_AT'
          USING ERRCODE = '22023',
                DETAIL = 'Retirement fields cannot change on publish';
      END IF;

      -- All rows (legacy and package-backed): trusted owner + exact GUC required.
      IF NOT v_trusted OR v_cmd IS DISTINCT FROM 'publish' THEN
        RAISE EXCEPTION 'CATALOG_LIFECYCLE_FORBIDDEN'
          USING ERRCODE = 'P0001',
                DETAIL = 'Publish requires trusted lifecycle owner and command=publish';
      END IF;

      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'CATALOG_INVALID_STATUS_TRANSITION'
      USING ERRCODE = 'P0001',
            DETAIL = format('Cannot transition draft revision to %s', NEW.status);
  END IF;

  IF OLD.status = 'published' THEN
    IF NEW.status = 'retired' THEN
      IF NEW.retired_at IS NULL THEN
        RAISE EXCEPTION 'CATALOG_RETIRE_REQUIRES_RETIRED_AT'
          USING ERRCODE = '22023';
      END IF;

      IF NOT v_trusted
        OR (
          v_cmd IS DISTINCT FROM 'retire'
          AND v_cmd IS DISTINCT FROM 'rollback-retire'
        )
      THEN
        RAISE EXCEPTION 'CATALOG_LIFECYCLE_FORBIDDEN'
          USING ERRCODE = 'P0001',
                DETAIL = 'Retire requires trusted lifecycle owner and command=retire|rollback-retire';
      END IF;

      -- Publication attribution and published_at frozen on retire.
      IF NEW.published_at IS DISTINCT FROM OLD.published_at
        OR NEW.published_by_kind IS DISTINCT FROM OLD.published_by_kind
        OR NEW.published_by_id IS DISTINCT FROM OLD.published_by_id
      THEN
        RAISE EXCEPTION 'CATALOG_REVISION_IMMUTABLE'
          USING ERRCODE = 'P0001',
                DETAIL = 'Only retirement lifecycle columns may change on retire';
      END IF;

      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'CATALOG_REVISION_IMMUTABLE'
      USING ERRCODE = 'P0001',
            DETAIL = 'Published revisions may only transition to retired';
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger binding (function replaced in place above)
DROP TRIGGER IF EXISTS measured_boq_catalog_revisions_immutable
  ON public.measured_boq_catalog_revisions;
CREATE TRIGGER measured_boq_catalog_revisions_immutable
  BEFORE UPDATE OR DELETE ON public.measured_boq_catalog_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.measured_boq_catalog_revision_immutable();

-- ────────────────────────────────────────────────────────────────────
-- 9. Entry immutability (all rows; no application-role write path)
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.measured_boq_catalog_entry_parent_draft_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- UPDATE and DELETE are always forbidden after B2C1 (no legacy draft mutation path).
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'CATALOG_ENTRY_IMMUTABLE'
      USING ERRCODE = 'P0001',
            DETAIL = 'Catalogue entries cannot be updated';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CATALOG_ENTRY_IMMUTABLE'
      USING ERRCODE = 'P0001',
            DETAIL = 'Catalogue entries cannot be deleted';
  END IF;

  -- INSERT: parent must be draft; only trusted function owner (future DEFINER / test owner).
  PERFORM public.measured_boq_catalog_assert_parent_draft(NEW.catalog_revision);

  IF NOT public.measured_boq_catalog_is_trusted_lifecycle_owner() THEN
    RAISE EXCEPTION 'CATALOG_ENTRY_IMMUTABLE'
      USING ERRCODE = 'P0001',
            DETAIL = 'Catalogue entry insert requires trusted ingest owner';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists; function body replaced in place.

-- ────────────────────────────────────────────────────────────────────
-- 10. Privileges and RLS (RPC-only writes; service_role SELECT only)
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE public.measured_boq_catalog_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measured_boq_catalog_events ENABLE ROW LEVEL SECURITY;

-- All four catalogue tables: no JWT access; service_role SELECT only; no direct DML.
-- Future B2D/B2E SECURITY DEFINER RPCs provide narrow write authority.

REVOKE ALL ON TABLE public.measured_boq_catalog_packages FROM PUBLIC;
REVOKE ALL ON TABLE public.measured_boq_catalog_packages FROM anon;
REVOKE ALL ON TABLE public.measured_boq_catalog_packages FROM authenticated;
REVOKE ALL ON TABLE public.measured_boq_catalog_packages FROM service_role;
GRANT SELECT ON TABLE public.measured_boq_catalog_packages TO service_role;

REVOKE ALL ON TABLE public.measured_boq_catalog_events FROM PUBLIC;
REVOKE ALL ON TABLE public.measured_boq_catalog_events FROM anon;
REVOKE ALL ON TABLE public.measured_boq_catalog_events FROM authenticated;
REVOKE ALL ON TABLE public.measured_boq_catalog_events FROM service_role;
GRANT SELECT ON TABLE public.measured_boq_catalog_events TO service_role;

REVOKE ALL ON TABLE public.measured_boq_catalog_revisions FROM PUBLIC;
REVOKE ALL ON TABLE public.measured_boq_catalog_revisions FROM anon;
REVOKE ALL ON TABLE public.measured_boq_catalog_revisions FROM authenticated;
REVOKE ALL ON TABLE public.measured_boq_catalog_revisions FROM service_role;
GRANT SELECT ON TABLE public.measured_boq_catalog_revisions TO service_role;

REVOKE ALL ON TABLE public.measured_boq_catalog_entries FROM PUBLIC;
REVOKE ALL ON TABLE public.measured_boq_catalog_entries FROM anon;
REVOKE ALL ON TABLE public.measured_boq_catalog_entries FROM authenticated;
REVOKE ALL ON TABLE public.measured_boq_catalog_entries FROM service_role;
GRANT SELECT ON TABLE public.measured_boq_catalog_entries TO service_role;

-- No authenticated/anon policies on catalogue tables (service_role bypasses RLS for SELECT).
