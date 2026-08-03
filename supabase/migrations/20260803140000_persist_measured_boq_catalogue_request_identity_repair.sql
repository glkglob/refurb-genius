-- Ticket 4C2E-B2D2R — Draft persistence request-identity serialization repair
--
-- Fixes:
--   1. Transaction-scoped request-identity advisory lock
--      (command_scope + request_id) acquired AFTER validation and BEFORE
--      package-identity advisory lock, event lookup, or row work.
--   2. Unique-violation on the durable event key re-reads the committed
--      request event and returns idempotent_replay | request_conflict
--      instead of database_failure for recognised request collisions.
--
-- Does NOT:
--   change the public signature or result fields
--   reopen table DML for service_role / JWT roles
--   add tables, columns, event types, public helpers, or lifecycle RPCs
--   remove or reorder package-identity advisory locking relative to
--   request-identity locking (request always precedes package)
--
-- Lock order (valid path):
--   argument / byte / checksum / B1 policy validation
--   → request-identity advisory lock (hashtextextended namespace)
--   → package-identity advisory lock (input_checksum key pair)
--   → existing request-event lookup
--   → package / revision lookups and inserts
--   → accepted event
--   → return

CREATE OR REPLACE FUNCTION public.persist_measured_boq_catalog_draft(
  p_manifest_text text,
  p_snapshot_text text,
  p_catalog_revision text,
  p_source_id text,
  p_manifest_version integer,
  p_normaliser_version text,
  p_input_checksum text,
  p_content_checksum text,
  p_normalized_entries jsonb,
  p_validation_report jsonb,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cmd_scope constant text := 'persist_draft';
  v_lock_k1 integer;
  v_lock_k2 integer;
  v_recomputed_input text;
  v_existing_event public.measured_boq_catalog_events%ROWTYPE;
  v_existing_pkg public.measured_boq_catalog_packages%ROWTYPE;
  v_existing_rev public.measured_boq_catalog_revisions%ROWTYPE;
  v_event_payload jsonb;
  v_event_rev uuid;
  v_event_pkg uuid;
  v_event_checksum text;
  v_event_content text;
  v_event_label text;
  v_licence text;
  v_production boolean;
  v_schema_version text;
  v_effective_from date;
  v_source_description text;
  v_created_by text;
  v_entry_count integer;
  v_revision_id uuid;
  v_package_id uuid;
  v_entry jsonb;
  v_i integer;
  v_rate_key text;
BEGIN
  -- ── Hard argument gates ──────────────────────────────────────────
  IF p_request_id IS NULL THEN
    RETURN jsonb_build_object(
      'outcome', 'invalid_persistence_command',
      'package_id', null,
      'revision_id', null,
      'input_checksum', p_input_checksum,
      'content_checksum', p_content_checksum,
      'request_id', null,
      'idempotent_replay', false
    );
  END IF;

  IF p_manifest_text IS NULL OR p_snapshot_text IS NULL THEN
    RETURN jsonb_build_object(
      'outcome', 'invalid_persistence_command',
      'package_id', null,
      'revision_id', null,
      'input_checksum', p_input_checksum,
      'content_checksum', p_content_checksum,
      'request_id', p_request_id,
      'idempotent_replay', false
    );
  END IF;

  IF pg_catalog.octet_length(p_manifest_text) > 1048576
     OR pg_catalog.octet_length(p_snapshot_text) > 8388608
     OR (
       p_validation_report IS NOT NULL
       AND pg_catalog.octet_length(p_validation_report::text) > 2097152
     )
  THEN
    RETURN jsonb_build_object(
      'outcome', 'payload_too_large',
      'package_id', null,
      'revision_id', null,
      'input_checksum', p_input_checksum,
      'content_checksum', p_content_checksum,
      'request_id', p_request_id,
      'idempotent_replay', false
    );
  END IF;

  IF p_catalog_revision IS NULL
     OR p_source_id IS NULL
     OR p_manifest_version IS NULL
     OR p_normaliser_version IS NULL
     OR p_input_checksum IS NULL
     OR p_content_checksum IS NULL
     OR p_normalized_entries IS NULL
     OR p_validation_report IS NULL
     OR jsonb_typeof(p_normalized_entries) <> 'array'
     OR jsonb_typeof(p_validation_report) <> 'object'
     OR p_input_checksum !~ '^[0-9a-f]{64}$'
     OR p_content_checksum !~ '^[0-9a-f]{64}$'
  THEN
    RETURN jsonb_build_object(
      'outcome', 'invalid_persistence_command',
      'package_id', null,
      'revision_id', null,
      'input_checksum', p_input_checksum,
      'content_checksum', p_content_checksum,
      'request_id', p_request_id,
      'idempotent_replay', false
    );
  END IF;

  v_entry_count := jsonb_array_length(p_normalized_entries);
  IF v_entry_count IS NULL OR v_entry_count < 1 OR v_entry_count > 50000 THEN
    RETURN jsonb_build_object(
      'outcome', CASE
        WHEN v_entry_count > 50000 THEN 'payload_too_large'
        ELSE 'invalid_persistence_command'
      END,
      'package_id', null,
      'revision_id', null,
      'input_checksum', p_input_checksum,
      'content_checksum', p_content_checksum,
      'request_id', p_request_id,
      'idempotent_replay', false
    );
  END IF;

  -- Byte-integrity: recompute package input checksum from raw artifacts.
  v_recomputed_input := public.measured_boq_package_input_checksum(
    p_manifest_text,
    p_snapshot_text
  );
  IF v_recomputed_input IS DISTINCT FROM p_input_checksum THEN
    RETURN jsonb_build_object(
      'outcome', 'invalid_persistence_command',
      'package_id', null,
      'revision_id', null,
      'input_checksum', p_input_checksum,
      'content_checksum', p_content_checksum,
      'request_id', p_request_id,
      'idempotent_replay', false
    );
  END IF;

  -- Server-owned policy fields embedded in validation_report (never trusted from free-form RPC args).
  v_licence := p_validation_report ->> 'licenceStatus';
  v_production := COALESCE((p_validation_report ->> 'production')::boolean, true);
  v_schema_version := p_validation_report ->> 'schemaVersion';
  v_source_description := p_validation_report ->> 'sourceDescription';
  v_created_by := COALESCE(p_validation_report ->> 'createdBy', 'persist_measured_boq_catalog_draft');
  BEGIN
    v_effective_from := (p_validation_report ->> 'effectiveFrom')::date;
  EXCEPTION WHEN others THEN
    v_effective_from := NULL;
  END;

  IF v_production IS TRUE THEN
    RETURN jsonb_build_object(
      'outcome', 'production_blocked',
      'package_id', null,
      'revision_id', null,
      'input_checksum', p_input_checksum,
      'content_checksum', p_content_checksum,
      'request_id', p_request_id,
      'idempotent_replay', false
    );
  END IF;

  IF v_licence IS NULL
     OR v_licence NOT IN ('synthetic', 'rights_unverified')
     OR v_schema_version IS NULL
     OR length(btrim(v_schema_version)) = 0
     OR v_source_description IS NULL
     OR length(btrim(v_source_description)) = 0
     OR v_effective_from IS NULL
  THEN
    RETURN jsonb_build_object(
      'outcome', 'invalid_persistence_command',
      'package_id', null,
      'revision_id', null,
      'input_checksum', p_input_checksum,
      'content_checksum', p_content_checksum,
      'request_id', p_request_id,
      'idempotent_replay', false
    );
  END IF;

  -- ── Request-identity serialization (before package lock / row work) ─
  -- Same command_scope + request_id contend on one transaction-scoped key.
  -- Namespace is distinct from lifecycle request locks and package locks.
  -- Hash collisions only add extra serialization; durable event comparison
  -- remains authoritative for replay vs conflict classification.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'measured-boq-persist-request:'
        || v_cmd_scope
        || ':'
        || p_request_id::text,
      0
    )
  );

  -- ── Package-identity advisory lock (input checksum key pair) ──────
  -- Deterministic pair derived from the 64-hex input checksum (first 16 hex chars).
  v_lock_k1 := (('x' || substr(p_input_checksum, 1, 8))::bit(32))::integer;
  v_lock_k2 := (('x' || substr(p_input_checksum, 9, 8))::bit(32))::integer;
  PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_k1, v_lock_k2);

  -- ── Exact request replay / conflict (after both locks) ────────────
  SELECT *
    INTO v_existing_event
  FROM public.measured_boq_catalog_events e
  WHERE e.command_scope = v_cmd_scope
    AND e.request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    v_event_payload := v_existing_event.payload_json;
    v_event_rev := v_existing_event.revision_id;
    v_event_pkg := v_existing_event.package_id;
    v_event_checksum := v_existing_event.input_checksum;
    v_event_content := v_existing_event.content_checksum;
    v_event_label := v_existing_event.catalog_revision;

    IF v_event_checksum IS NOT DISTINCT FROM p_input_checksum
       AND v_event_content IS NOT DISTINCT FROM p_content_checksum
       AND v_event_label IS NOT DISTINCT FROM p_catalog_revision
       AND COALESCE(v_event_payload ->> 'source_id', '') IS NOT DISTINCT FROM p_source_id
    THEN
      RETURN jsonb_build_object(
        'outcome', 'idempotent_replay',
        'package_id', v_event_pkg,
        'revision_id', v_event_rev,
        'input_checksum', p_input_checksum,
        'content_checksum', p_content_checksum,
        'request_id', p_request_id,
        'idempotent_replay', true
      );
    END IF;

    RETURN jsonb_build_object(
      'outcome', 'request_conflict',
      'package_id', null,
      'revision_id', null,
      'input_checksum', p_input_checksum,
      'content_checksum', p_content_checksum,
      'request_id', p_request_id,
      'idempotent_replay', false
    );
  END IF;

  -- ── Package identity (global input_checksum) ─────────────────────
  SELECT *
    INTO v_existing_pkg
  FROM public.measured_boq_catalog_packages p
  WHERE p.input_checksum = p_input_checksum
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_pkg.catalog_revision IS DISTINCT FROM p_catalog_revision
       OR v_existing_pkg.content_checksum IS DISTINCT FROM p_content_checksum
       OR v_existing_pkg.source_id IS DISTINCT FROM p_source_id
    THEN
      RETURN jsonb_build_object(
        'outcome', 'package_conflict',
        'package_id', null,
        'revision_id', null,
        'input_checksum', p_input_checksum,
        'content_checksum', p_content_checksum,
        'request_id', p_request_id,
        'idempotent_replay', false
      );
    END IF;

    -- Exact package replay with a new request_id → audit event only.
    INSERT INTO public.measured_boq_catalog_events (
      event_type,
      command_scope,
      request_id,
      catalog_revision,
      revision_id,
      package_id,
      input_checksum,
      content_checksum,
      actor_kind,
      actor_user_id,
      result,
      payload_json
    ) VALUES (
      'ingestion_replayed',
      v_cmd_scope,
      p_request_id,
      v_existing_pkg.catalog_revision,
      v_existing_pkg.revision_id,
      v_existing_pkg.id,
      p_input_checksum,
      p_content_checksum,
      'service_role',
      NULL,
      'idempotent_replay',
      jsonb_build_object(
        'source_id', p_source_id,
        'replay', true
      )
    );

    RETURN jsonb_build_object(
      'outcome', 'idempotent_replay',
      'package_id', v_existing_pkg.id,
      'revision_id', v_existing_pkg.revision_id,
      'input_checksum', p_input_checksum,
      'content_checksum', p_content_checksum,
      'request_id', p_request_id,
      'idempotent_replay', true
    );
  END IF;

  -- ── Revision label uniqueness ────────────────────────────────────
  SELECT *
    INTO v_existing_rev
  FROM public.measured_boq_catalog_revisions r
  WHERE r.catalog_revision = p_catalog_revision
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'outcome', 'revision_conflict',
      'package_id', null,
      'revision_id', null,
      'input_checksum', p_input_checksum,
      'content_checksum', p_content_checksum,
      'request_id', p_request_id,
      'idempotent_replay', false
    );
  END IF;

  -- ── Create draft revision ────────────────────────────────────────
  INSERT INTO public.measured_boq_catalog_revisions (
    catalog_revision,
    status,
    schema_version,
    currency,
    vat_basis,
    regional_basis,
    source_description,
    entry_count,
    content_checksum,
    effective_from,
    created_by,
    source_id,
    licence_status,
    production,
    input_checksum,
    normaliser_version
  ) VALUES (
    p_catalog_revision,
    'draft',
    v_schema_version,
    'GBP',
    'exclusive',
    'uk-region-multipliers-v1',
    v_source_description,
    v_entry_count,
    p_content_checksum,
    v_effective_from,
    v_created_by,
    p_source_id,
    v_licence,
    false,
    p_input_checksum,
    p_normaliser_version
  )
  RETURNING id INTO v_revision_id;

  -- ── Package ──────────────────────────────────────────────────────
  INSERT INTO public.measured_boq_catalog_packages (
    revision_id,
    catalog_revision,
    input_checksum,
    content_checksum,
    source_id,
    licence_status,
    production,
    manifest_version,
    normaliser_version,
    manifest_text,
    snapshot_text,
    validation_report
  ) VALUES (
    v_revision_id,
    p_catalog_revision,
    p_input_checksum,
    p_content_checksum,
    p_source_id,
    v_licence,
    false,
    p_manifest_version,
    p_normaliser_version,
    p_manifest_text,
    p_snapshot_text,
    p_validation_report
  )
  RETURNING id INTO v_package_id;

  -- ── Entries ──────────────────────────────────────────────────────
  FOR v_i IN 0 .. (v_entry_count - 1) LOOP
    v_entry := p_normalized_entries -> v_i;
    v_rate_key := v_entry ->> 'rate_key';

    INSERT INTO public.measured_boq_catalog_entries (
      catalog_revision,
      rate_key,
      display_name,
      description,
      trade_or_domain,
      unit,
      cost_type,
      base_unit_rate,
      currency,
      vat_basis,
      source_reference,
      status,
      replacement_rate_key
    ) VALUES (
      p_catalog_revision,
      v_rate_key,
      v_entry ->> 'display_name',
      NULLIF(v_entry ->> 'description', ''),
      v_entry ->> 'trade_or_domain',
      v_entry ->> 'unit',
      v_entry ->> 'cost_type',
      (v_entry ->> 'base_unit_rate')::numeric,
      COALESCE(v_entry ->> 'currency', 'GBP'),
      COALESCE(v_entry ->> 'vat_basis', 'exclusive'),
      NULLIF(v_entry ->> 'source_reference', ''),
      COALESCE(v_entry ->> 'status', 'active'),
      NULLIF(v_entry ->> 'replacement_rate_key', '')
    );
  END LOOP;

  -- ── Accepted event ───────────────────────────────────────────────
  INSERT INTO public.measured_boq_catalog_events (
    event_type,
    command_scope,
    request_id,
    catalog_revision,
    revision_id,
    package_id,
    input_checksum,
    content_checksum,
    actor_kind,
    actor_user_id,
    result,
    payload_json
  ) VALUES (
    'ingestion_accepted',
    v_cmd_scope,
    p_request_id,
    p_catalog_revision,
    v_revision_id,
    v_package_id,
    p_input_checksum,
    p_content_checksum,
    'service_role',
    NULL,
    'created',
    jsonb_build_object(
      'source_id', p_source_id,
      'entry_count', v_entry_count,
      'licence_status', v_licence
    )
  );

  RETURN jsonb_build_object(
    'outcome', 'created',
    'package_id', v_package_id,
    'revision_id', v_revision_id,
    'input_checksum', p_input_checksum,
    'content_checksum', p_content_checksum,
    'request_id', p_request_id,
    'idempotent_replay', false
  );

EXCEPTION
  WHEN unique_violation THEN
    -- PL/pgSQL rolls back all mutations in this function block before the
    -- handler runs. Re-read the durable winner event; never map a recognised
    -- request-identity collision to database_failure. Do not return identifiers
    -- from rolled-back loser rows.
    SELECT *
      INTO v_existing_event
    FROM public.measured_boq_catalog_events e
    WHERE e.command_scope = v_cmd_scope
      AND e.request_id = p_request_id;

    IF FOUND THEN
      v_event_payload := v_existing_event.payload_json;
      v_event_rev := v_existing_event.revision_id;
      v_event_pkg := v_existing_event.package_id;
      v_event_checksum := v_existing_event.input_checksum;
      v_event_content := v_existing_event.content_checksum;
      v_event_label := v_existing_event.catalog_revision;

      IF v_event_checksum IS NOT DISTINCT FROM p_input_checksum
         AND v_event_content IS NOT DISTINCT FROM p_content_checksum
         AND v_event_label IS NOT DISTINCT FROM p_catalog_revision
         AND COALESCE(v_event_payload ->> 'source_id', '') IS NOT DISTINCT FROM p_source_id
      THEN
        RETURN jsonb_build_object(
          'outcome', 'idempotent_replay',
          'package_id', v_event_pkg,
          'revision_id', v_event_rev,
          'input_checksum', p_input_checksum,
          'content_checksum', p_content_checksum,
          'request_id', p_request_id,
          'idempotent_replay', true
        );
      END IF;

      RETURN jsonb_build_object(
        'outcome', 'request_conflict',
        'package_id', null,
        'revision_id', null,
        'input_checksum', p_input_checksum,
        'content_checksum', p_content_checksum,
        'request_id', p_request_id,
        'idempotent_replay', false
      );
    END IF;

    RETURN jsonb_build_object(
      'outcome', 'database_failure',
      'package_id', null,
      'revision_id', null,
      'input_checksum', p_input_checksum,
      'content_checksum', p_content_checksum,
      'request_id', p_request_id,
      'idempotent_replay', false
    );
  WHEN others THEN
    RETURN jsonb_build_object(
      'outcome', 'database_failure',
      'package_id', null,
      'revision_id', null,
      'input_checksum', p_input_checksum,
      'content_checksum', p_content_checksum,
      'request_id', p_request_id,
      'idempotent_replay', false
    );
END;
$$;

COMMENT ON FUNCTION public.persist_measured_boq_catalog_draft(
  text, text, text, text, integer, text, text, text, jsonb, jsonb, uuid
) IS
  'B2D/B2D2R atomic draft catalogue package persistence. Request-identity locked before package lock; service_role EXECUTE only; table DML remains revoked.';

REVOKE ALL ON FUNCTION public.persist_measured_boq_catalog_draft(
  text, text, text, text, integer, text, text, text, jsonb, jsonb, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.persist_measured_boq_catalog_draft(
  text, text, text, text, integer, text, text, text, jsonb, jsonb, uuid
) FROM anon;
REVOKE ALL ON FUNCTION public.persist_measured_boq_catalog_draft(
  text, text, text, text, integer, text, text, text, jsonb, jsonb, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.persist_measured_boq_catalog_draft(
  text, text, text, text, integer, text, text, text, jsonb, jsonb, uuid
) TO service_role;

ALTER FUNCTION public.persist_measured_boq_catalog_draft(
  text, text, text, text, integer, text, text, text, jsonb, jsonb, uuid
) OWNER TO postgres;
