-- Ticket 4C2E-B2E1 — Lifecycle request-identity, provenance order and lock-order repair
--
-- Replaces bodies of the three B2E lifecycle RPCs while preserving signatures and grants.
--
-- Fixes:
--   1. Transaction-scoped request-identity advisory lock (scope + request_id)
--      acquired before any revision-row lock or event lookup.
--   2. Provenance and policy run before already_published / already_retired branches.
--   3. Unique-violation on event key re-reads event → idempotent_replay | request_conflict.
--
-- Does NOT:
--   change public signatures or result fields
--   reopen table DML
--   add public helpers / tables / event types
--   introduce an active pointer

-- ────────────────────────────────────────────────────────────────────
-- 1. publish_measured_boq_catalog_revision (repaired body)
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.publish_measured_boq_catalog_revision(
  p_revision_id uuid,
  p_expected_status text,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cmd_scope constant text := 'publish';
  v_rev public.measured_boq_catalog_revisions%ROWTYPE;
  v_pkg public.measured_boq_catalog_packages%ROWTYPE;
  v_existing_event public.measured_boq_catalog_events%ROWTYPE;
  v_event_id uuid;
  v_prev_status text;
BEGIN
  IF p_revision_id IS NULL OR p_request_id IS NULL THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'database_failure', NULL, NULL, NULL, NULL, p_request_id, false
    );
  END IF;

  -- Request-identity serialization: same scope+request_id contend before any row work.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'measured-boq-lifecycle-request:' || v_cmd_scope || ':' || p_request_id::text,
      0
    )
  );

  SELECT *
    INTO v_rev
  FROM public.measured_boq_catalog_revisions r
  WHERE r.id = p_revision_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'revision_not_found', p_revision_id, NULL, NULL, NULL, p_request_id, false
    );
  END IF;

  v_prev_status := v_rev.status;

  SELECT *
    INTO v_existing_event
  FROM public.measured_boq_catalog_events e
  WHERE e.command_scope = v_cmd_scope
    AND e.request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_event.revision_id IS NOT DISTINCT FROM p_revision_id
       AND COALESCE(v_existing_event.payload_json ->> 'expected_status', '')
           IS NOT DISTINCT FROM COALESCE(p_expected_status, '')
       AND v_existing_event.event_type IN ('publication', 'publication_replay')
       AND v_existing_event.result IN ('published', 'already_published', 'idempotent_replay')
    THEN
      RETURN public.measured_boq_catalog_lifecycle_result(
        'idempotent_replay',
        v_existing_event.revision_id,
        COALESCE(v_existing_event.payload_json ->> 'previous_status', v_prev_status),
        COALESCE(v_existing_event.payload_json ->> 'new_status', 'published'),
        v_existing_event.id,
        p_request_id,
        true
      );
    END IF;

    RETURN public.measured_boq_catalog_lifecycle_result(
      'request_conflict', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  -- Provenance before already-state / status branches.
  SELECT *
    INTO v_pkg
  FROM public.measured_boq_catalog_packages p
  WHERE p.revision_id = v_rev.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'provenance_required', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  IF v_pkg.catalog_revision IS DISTINCT FROM v_rev.catalog_revision
     OR v_pkg.input_checksum IS DISTINCT FROM v_rev.input_checksum
     OR v_pkg.content_checksum IS DISTINCT FROM v_rev.content_checksum
     OR v_pkg.licence_status IS DISTINCT FROM v_rev.licence_status
     OR v_pkg.production IS DISTINCT FROM v_rev.production
  THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'database_failure', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  -- Policy before already_published.
  IF v_rev.production IS TRUE OR v_pkg.production IS TRUE THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'production_policy_rejected', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  IF v_rev.licence_status IS DISTINCT FROM 'synthetic'
     OR v_pkg.licence_status IS DISTINCT FROM 'synthetic'
  THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'rights_not_publishable', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  IF p_expected_status IS DISTINCT FROM 'draft' THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'stale_status', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  -- Package-backed already published + expected draft + synthetic/non-prod.
  IF v_rev.status = 'published' THEN
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
      'publication_replay',
      v_cmd_scope,
      p_request_id,
      v_rev.catalog_revision,
      v_rev.id,
      v_pkg.id,
      v_rev.input_checksum,
      v_rev.content_checksum,
      'service_role',
      NULL,
      'already_published',
      jsonb_build_object(
        'expected_status', p_expected_status,
        'previous_status', v_prev_status,
        'new_status', 'published',
        'replay', true
      )
    )
    RETURNING id INTO v_event_id;

    RETURN public.measured_boq_catalog_lifecycle_result(
      'already_published', p_revision_id, v_prev_status, 'published', v_event_id, p_request_id, false
    );
  END IF;

  IF v_rev.status IS DISTINCT FROM 'draft' THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'stale_status', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  PERFORM pg_catalog.set_config(
    'app.measured_boq_catalog_lifecycle_command',
    'publish',
    true
  );

  UPDATE public.measured_boq_catalog_revisions r
  SET
    status = 'published',
    published_at = pg_catalog.now(),
    published_by_kind = 'service_role',
    published_by_id = NULL,
    updated_at = pg_catalog.now()
  WHERE r.id = v_rev.id;

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
    'publication',
    v_cmd_scope,
    p_request_id,
    v_rev.catalog_revision,
    v_rev.id,
    v_pkg.id,
    v_rev.input_checksum,
    v_rev.content_checksum,
    'service_role',
    NULL,
    'published',
    jsonb_build_object(
      'expected_status', p_expected_status,
      'previous_status', 'draft',
      'new_status', 'published'
    )
  )
  RETURNING id INTO v_event_id;

  RETURN public.measured_boq_catalog_lifecycle_result(
    'published', p_revision_id, 'draft', 'published', v_event_id, p_request_id, false
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Re-read durable request event after rare race; never map recognised
    -- request collision to database_failure.
    SELECT *
      INTO v_existing_event
    FROM public.measured_boq_catalog_events e
    WHERE e.command_scope = 'publish'
      AND e.request_id = p_request_id;

    IF FOUND THEN
      IF v_existing_event.revision_id IS NOT DISTINCT FROM p_revision_id
         AND COALESCE(v_existing_event.payload_json ->> 'expected_status', '')
             IS NOT DISTINCT FROM COALESCE(p_expected_status, '')
         AND v_existing_event.event_type IN ('publication', 'publication_replay')
         AND v_existing_event.result IN ('published', 'already_published', 'idempotent_replay')
      THEN
        RETURN public.measured_boq_catalog_lifecycle_result(
          'idempotent_replay',
          v_existing_event.revision_id,
          COALESCE(v_existing_event.payload_json ->> 'previous_status', NULL),
          COALESCE(v_existing_event.payload_json ->> 'new_status', 'published'),
          v_existing_event.id,
          p_request_id,
          true
        );
      END IF;
      RETURN public.measured_boq_catalog_lifecycle_result(
        'request_conflict', p_revision_id, NULL, NULL, NULL, p_request_id, false
      );
    END IF;
    RETURN public.measured_boq_catalog_lifecycle_result(
      'database_failure', p_revision_id, NULL, NULL, NULL, p_request_id, false
    );
  WHEN others THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'database_failure', p_revision_id, NULL, NULL, NULL, p_request_id, false
    );
END;
$$;

COMMENT ON FUNCTION public.publish_measured_boq_catalog_revision(uuid, text, uuid) IS
  'B2E/B2E1 publish draft→published. Request-identity locked; provenance before already-state.';

-- Re-assert grants/ownership (CREATE OR REPLACE preserves owner; grants are explicit).
REVOKE ALL ON FUNCTION public.publish_measured_boq_catalog_revision(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_measured_boq_catalog_revision(uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.publish_measured_boq_catalog_revision(uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.publish_measured_boq_catalog_revision(uuid, text, uuid) TO service_role;
ALTER FUNCTION public.publish_measured_boq_catalog_revision(uuid, text, uuid) OWNER TO postgres;

-- ────────────────────────────────────────────────────────────────────
-- 2. retire_measured_boq_catalog_revision (repaired body)
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.retire_measured_boq_catalog_revision(
  p_revision_id uuid,
  p_expected_status text,
  p_reason text,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cmd_scope constant text := 'retire';
  v_rev public.measured_boq_catalog_revisions%ROWTYPE;
  v_pkg public.measured_boq_catalog_packages%ROWTYPE;
  v_existing_event public.measured_boq_catalog_events%ROWTYPE;
  v_event_id uuid;
  v_prev_status text;
  v_reason text;
BEGIN
  IF p_revision_id IS NULL OR p_request_id IS NULL THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'database_failure', NULL, NULL, NULL, NULL, p_request_id, false
    );
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL OR length(v_reason) > 2000 THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'database_failure', p_revision_id, NULL, NULL, NULL, p_request_id, false
    );
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'measured-boq-lifecycle-request:' || v_cmd_scope || ':' || p_request_id::text,
      0
    )
  );

  SELECT *
    INTO v_rev
  FROM public.measured_boq_catalog_revisions r
  WHERE r.id = p_revision_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'revision_not_found', p_revision_id, NULL, NULL, NULL, p_request_id, false
    );
  END IF;

  v_prev_status := v_rev.status;

  SELECT *
    INTO v_existing_event
  FROM public.measured_boq_catalog_events e
  WHERE e.command_scope = v_cmd_scope
    AND e.request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_event.revision_id IS NOT DISTINCT FROM p_revision_id
       AND COALESCE(v_existing_event.payload_json ->> 'expected_status', '')
           IS NOT DISTINCT FROM COALESCE(p_expected_status, '')
       AND COALESCE(v_existing_event.reason, '') IS NOT DISTINCT FROM v_reason
       AND v_existing_event.event_type = 'retirement'
       AND v_existing_event.result IN ('retired', 'already_retired', 'idempotent_replay')
    THEN
      RETURN public.measured_boq_catalog_lifecycle_result(
        'idempotent_replay',
        v_existing_event.revision_id,
        COALESCE(v_existing_event.payload_json ->> 'previous_status', v_prev_status),
        COALESCE(v_existing_event.payload_json ->> 'new_status', 'retired'),
        v_existing_event.id,
        p_request_id,
        true
      );
    END IF;

    RETURN public.measured_boq_catalog_lifecycle_result(
      'request_conflict', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  -- Provenance before already_retired.
  SELECT *
    INTO v_pkg
  FROM public.measured_boq_catalog_packages p
  WHERE p.revision_id = v_rev.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'provenance_required', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  IF p_expected_status IS DISTINCT FROM 'published' THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'stale_status', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  IF v_rev.status = 'retired' THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'already_retired', p_revision_id, v_prev_status, 'retired', NULL, p_request_id, false
    );
  END IF;

  IF v_rev.status IS DISTINCT FROM 'published' THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'stale_status', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  PERFORM pg_catalog.set_config(
    'app.measured_boq_catalog_lifecycle_command',
    'retire',
    true
  );

  UPDATE public.measured_boq_catalog_revisions r
  SET
    status = 'retired',
    retired_at = pg_catalog.now(),
    retired_by_kind = 'service_role',
    retired_by_id = NULL,
    retirement_reason = v_reason,
    updated_at = pg_catalog.now()
  WHERE r.id = v_rev.id;

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
    reason,
    result,
    payload_json
  ) VALUES (
    'retirement',
    v_cmd_scope,
    p_request_id,
    v_rev.catalog_revision,
    v_rev.id,
    v_pkg.id,
    v_rev.input_checksum,
    v_rev.content_checksum,
    'service_role',
    NULL,
    v_reason,
    'retired',
    jsonb_build_object(
      'expected_status', p_expected_status,
      'previous_status', 'published',
      'new_status', 'retired'
    )
  )
  RETURNING id INTO v_event_id;

  RETURN public.measured_boq_catalog_lifecycle_result(
    'retired', p_revision_id, 'published', 'retired', v_event_id, p_request_id, false
  );

EXCEPTION
  WHEN unique_violation THEN
    SELECT *
      INTO v_existing_event
    FROM public.measured_boq_catalog_events e
    WHERE e.command_scope = 'retire'
      AND e.request_id = p_request_id;

    IF FOUND THEN
      IF v_existing_event.revision_id IS NOT DISTINCT FROM p_revision_id
         AND COALESCE(v_existing_event.payload_json ->> 'expected_status', '')
             IS NOT DISTINCT FROM COALESCE(p_expected_status, '')
         AND COALESCE(v_existing_event.reason, '') IS NOT DISTINCT FROM NULLIF(btrim(COALESCE(p_reason, '')), '')
         AND v_existing_event.event_type = 'retirement'
         AND v_existing_event.result IN ('retired', 'already_retired', 'idempotent_replay')
      THEN
        RETURN public.measured_boq_catalog_lifecycle_result(
          'idempotent_replay',
          v_existing_event.revision_id,
          COALESCE(v_existing_event.payload_json ->> 'previous_status', NULL),
          COALESCE(v_existing_event.payload_json ->> 'new_status', 'retired'),
          v_existing_event.id,
          p_request_id,
          true
        );
      END IF;
      RETURN public.measured_boq_catalog_lifecycle_result(
        'request_conflict', p_revision_id, NULL, NULL, NULL, p_request_id, false
      );
    END IF;
    RETURN public.measured_boq_catalog_lifecycle_result(
      'database_failure', p_revision_id, NULL, NULL, NULL, p_request_id, false
    );
  WHEN others THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'database_failure', p_revision_id, NULL, NULL, NULL, p_request_id, false
    );
END;
$$;

COMMENT ON FUNCTION public.retire_measured_boq_catalog_revision(uuid, text, text, uuid) IS
  'B2E/B2E1 retire published→retired. Request-identity locked; provenance before already-state.';

REVOKE ALL ON FUNCTION public.retire_measured_boq_catalog_revision(uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.retire_measured_boq_catalog_revision(uuid, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.retire_measured_boq_catalog_revision(uuid, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.retire_measured_boq_catalog_revision(uuid, text, text, uuid) TO service_role;
ALTER FUNCTION public.retire_measured_boq_catalog_revision(uuid, text, text, uuid) OWNER TO postgres;

-- ────────────────────────────────────────────────────────────────────
-- 3. rollback_measured_boq_catalog_publication (repaired body)
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rollback_measured_boq_catalog_publication(
  p_revision_id uuid,
  p_prior_revision_id uuid,
  p_expected_status text,
  p_reason text,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cmd_scope constant text := 'rollback_retire';
  v_target public.measured_boq_catalog_revisions%ROWTYPE;
  v_prior public.measured_boq_catalog_revisions%ROWTYPE;
  v_target_pkg public.measured_boq_catalog_packages%ROWTYPE;
  v_existing_event public.measured_boq_catalog_events%ROWTYPE;
  v_event_id uuid;
  v_prev_status text;
  v_reason text;
  v_first uuid;
  v_second uuid;
  v_lock_a public.measured_boq_catalog_revisions%ROWTYPE;
  v_lock_b public.measured_boq_catalog_revisions%ROWTYPE;
BEGIN
  IF p_revision_id IS NULL OR p_prior_revision_id IS NULL OR p_request_id IS NULL THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'database_failure', NULL, NULL, NULL, NULL, p_request_id, false
    );
  END IF;

  IF p_revision_id = p_prior_revision_id THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'database_failure', p_revision_id, NULL, NULL, NULL, p_request_id, false
    );
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL OR length(v_reason) > 2000 THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'database_failure', p_revision_id, NULL, NULL, NULL, p_request_id, false
    );
  END IF;

  -- Request-identity lock before any revision-row lock.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'measured-boq-lifecycle-request:' || v_cmd_scope || ':' || p_request_id::text,
      0
    )
  );

  -- Deterministic ascending UUID row-lock order (independent of argument order).
  v_first := LEAST(p_revision_id, p_prior_revision_id);
  v_second := GREATEST(p_revision_id, p_prior_revision_id);

  SELECT *
    INTO v_lock_a
  FROM public.measured_boq_catalog_revisions r
  WHERE r.id = v_first
  FOR UPDATE;

  IF NOT FOUND THEN
    IF v_first = p_revision_id THEN
      RETURN public.measured_boq_catalog_lifecycle_result(
        'revision_not_found', p_revision_id, NULL, NULL, NULL, p_request_id, false
      );
    END IF;
    RETURN public.measured_boq_catalog_lifecycle_result(
      'revision_not_found', p_prior_revision_id, NULL, NULL, NULL, p_request_id, false
    );
  END IF;

  SELECT *
    INTO v_lock_b
  FROM public.measured_boq_catalog_revisions r
  WHERE r.id = v_second
  FOR UPDATE;

  IF NOT FOUND THEN
    IF v_second = p_revision_id THEN
      RETURN public.measured_boq_catalog_lifecycle_result(
        'revision_not_found', p_revision_id, NULL, NULL, NULL, p_request_id, false
      );
    END IF;
    RETURN public.measured_boq_catalog_lifecycle_result(
      'revision_not_found', p_prior_revision_id, NULL, NULL, NULL, p_request_id, false
    );
  END IF;

  IF p_revision_id = v_first THEN
    v_target := v_lock_a;
    v_prior := v_lock_b;
  ELSE
    v_target := v_lock_b;
    v_prior := v_lock_a;
  END IF;

  v_prev_status := v_target.status;

  SELECT *
    INTO v_existing_event
  FROM public.measured_boq_catalog_events e
  WHERE e.command_scope = v_cmd_scope
    AND e.request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_event.revision_id IS NOT DISTINCT FROM p_revision_id
       AND v_existing_event.prior_revision_id IS NOT DISTINCT FROM p_prior_revision_id
       AND COALESCE(v_existing_event.payload_json ->> 'expected_status', '')
           IS NOT DISTINCT FROM COALESCE(p_expected_status, '')
       AND COALESCE(v_existing_event.reason, '') IS NOT DISTINCT FROM v_reason
       AND v_existing_event.event_type = 'rollback_recorded'
       AND v_existing_event.result IN ('rollback_recorded', 'idempotent_replay')
    THEN
      RETURN public.measured_boq_catalog_lifecycle_result(
        'idempotent_replay',
        v_existing_event.revision_id,
        COALESCE(v_existing_event.payload_json ->> 'previous_status', v_prev_status),
        COALESCE(v_existing_event.payload_json ->> 'new_status', 'retired'),
        v_existing_event.id,
        p_request_id,
        true
      );
    END IF;

    RETURN public.measured_boq_catalog_lifecycle_result(
      'request_conflict', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  -- Dual package provenance before already_retired / status branches.
  SELECT *
    INTO v_target_pkg
  FROM public.measured_boq_catalog_packages p
  WHERE p.revision_id = v_target.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'provenance_required', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  PERFORM 1
  FROM public.measured_boq_catalog_packages p
  WHERE p.revision_id = v_prior.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'provenance_required', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  IF p_expected_status IS DISTINCT FROM 'published' THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'stale_status', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  IF v_target.status = 'retired' THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'already_retired', p_revision_id, v_prev_status, 'retired', NULL, p_request_id, false
    );
  END IF;

  IF v_target.status IS DISTINCT FROM 'published' THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'stale_status', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  IF v_prior.status IS DISTINCT FROM 'published' THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'stale_status', p_revision_id, v_prev_status, v_prev_status, NULL, p_request_id, false
    );
  END IF;

  PERFORM pg_catalog.set_config(
    'app.measured_boq_catalog_lifecycle_command',
    'rollback-retire',
    true
  );

  UPDATE public.measured_boq_catalog_revisions r
  SET
    status = 'retired',
    retired_at = pg_catalog.now(),
    retired_by_kind = 'service_role',
    retired_by_id = NULL,
    retirement_reason = v_reason,
    updated_at = pg_catalog.now()
  WHERE r.id = v_target.id;

  INSERT INTO public.measured_boq_catalog_events (
    event_type,
    command_scope,
    request_id,
    catalog_revision,
    revision_id,
    package_id,
    prior_revision_id,
    input_checksum,
    content_checksum,
    actor_kind,
    actor_user_id,
    reason,
    result,
    payload_json
  ) VALUES (
    'rollback_recorded',
    v_cmd_scope,
    p_request_id,
    v_target.catalog_revision,
    v_target.id,
    v_target_pkg.id,
    v_prior.id,
    v_target.input_checksum,
    v_target.content_checksum,
    'service_role',
    NULL,
    v_reason,
    'rollback_recorded',
    jsonb_build_object(
      'expected_status', p_expected_status,
      'previous_status', 'published',
      'new_status', 'retired',
      'prior_revision_id', v_prior.id,
      'prior_catalog_revision', v_prior.catalog_revision
    )
  )
  RETURNING id INTO v_event_id;

  RETURN public.measured_boq_catalog_lifecycle_result(
    'rollback_recorded', p_revision_id, 'published', 'retired', v_event_id, p_request_id, false
  );

EXCEPTION
  WHEN unique_violation THEN
    SELECT *
      INTO v_existing_event
    FROM public.measured_boq_catalog_events e
    WHERE e.command_scope = 'rollback_retire'
      AND e.request_id = p_request_id;

    IF FOUND THEN
      IF v_existing_event.revision_id IS NOT DISTINCT FROM p_revision_id
         AND v_existing_event.prior_revision_id IS NOT DISTINCT FROM p_prior_revision_id
         AND COALESCE(v_existing_event.payload_json ->> 'expected_status', '')
             IS NOT DISTINCT FROM COALESCE(p_expected_status, '')
         AND COALESCE(v_existing_event.reason, '') IS NOT DISTINCT FROM NULLIF(btrim(COALESCE(p_reason, '')), '')
         AND v_existing_event.event_type = 'rollback_recorded'
         AND v_existing_event.result IN ('rollback_recorded', 'idempotent_replay')
      THEN
        RETURN public.measured_boq_catalog_lifecycle_result(
          'idempotent_replay',
          v_existing_event.revision_id,
          COALESCE(v_existing_event.payload_json ->> 'previous_status', NULL),
          COALESCE(v_existing_event.payload_json ->> 'new_status', 'retired'),
          v_existing_event.id,
          p_request_id,
          true
        );
      END IF;
      RETURN public.measured_boq_catalog_lifecycle_result(
        'request_conflict', p_revision_id, NULL, NULL, NULL, p_request_id, false
      );
    END IF;
    RETURN public.measured_boq_catalog_lifecycle_result(
      'database_failure', p_revision_id, NULL, NULL, NULL, p_request_id, false
    );
  WHEN others THEN
    RETURN public.measured_boq_catalog_lifecycle_result(
      'database_failure', p_revision_id, NULL, NULL, NULL, p_request_id, false
    );
END;
$$;

COMMENT ON FUNCTION public.rollback_measured_boq_catalog_publication(
  uuid, uuid, text, text, uuid
) IS
  'B2E/B2E1 rollback-retire target only. Request-identity lock then ascending UUID row locks.';

REVOKE ALL ON FUNCTION public.rollback_measured_boq_catalog_publication(
  uuid, uuid, text, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_measured_boq_catalog_publication(
  uuid, uuid, text, text, uuid
) FROM anon;
REVOKE ALL ON FUNCTION public.rollback_measured_boq_catalog_publication(
  uuid, uuid, text, text, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_measured_boq_catalog_publication(
  uuid, uuid, text, text, uuid
) TO service_role;
ALTER FUNCTION public.rollback_measured_boq_catalog_publication(
  uuid, uuid, text, text, uuid
) OWNER TO postgres;
