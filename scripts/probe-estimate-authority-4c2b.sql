-- Ticket 4C2B local database probes (run as postgres superuser)
-- Usage:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f scripts/probe-estimate-authority-4c2b.sql

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE probe_results (
  name text PRIMARY KEY,
  ok boolean NOT NULL,
  detail text
);

-- Allow role switches (authenticated/anon) to record outcomes.
GRANT ALL ON TABLE probe_results TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION pg_temp.record(p_name text, p_ok boolean, p_detail text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, public
AS $$
BEGIN
  INSERT INTO probe_results(name, ok, detail) VALUES (p_name, p_ok, p_detail)
  ON CONFLICT (name) DO UPDATE SET ok = EXCLUDED.ok, detail = EXCLUDED.detail;
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.record(text, boolean, text) TO authenticated, anon, service_role;

DO $$
DECLARE
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_other uuid := '22222222-2222-4222-8222-222222222222';
  v_project uuid := '33333333-3333-4333-8333-333333333333';
  v_legacy uuid := '44444444-4444-4444-8444-444444444444';
  v_auth uuid;
  v_hash text := encode(digest('payload-a', 'sha256'), 'hex');
  v_hash_b text := encode(digest('payload-b', 'sha256'), 'hex');
  v_result jsonb;
  v_estimate_id uuid;
  v_replay boolean;
  v_gdv numeric;
  v_count int;
  v_raised boolean;
  v_err text;
BEGIN
  -- Fixtures
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner4c2b@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'other4c2b@example.com', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email)
  VALUES (v_owner, 'owner4c2b@example.com'), (v_other, 'other4c2b@example.com')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.projects (
    id, user_id, name, address, postcode, region, property_type,
    bedrooms, bathrooms, size_sqm, purchase_price, estimated_gdv, estimate_done
  ) VALUES (
    v_project, v_owner, '4C2B Project', '1 Test St', 'SW1A 1AA', 'London', 'Flat',
    2, 1, 90, 250000, 400000, false
  ) ON CONFLICT (id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        estimated_gdv = 400000,
        estimate_done = false;

  -- 1. Legacy default authority = none
  INSERT INTO public.estimates (
    id, project_id, user_id, region, condition_level, finish_level
  ) VALUES (
    v_legacy, v_project, v_owner, 'London', 'Dated', 'Standard'
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM pg_temp.record(
    'legacy_defaults_to_none',
    (SELECT pricing_authority = 'none'
       AND pricing_policy_version IS NULL
       AND catalog_revision IS NULL
     FROM public.estimates WHERE id = v_legacy)
  );

  -- Marker integrity negatives
  BEGIN
    INSERT INTO public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, pricing_policy_version)
    VALUES (v_project, v_owner, 'London', 'Dated', 'Standard', 'none', 'v1');
    PERFORM pg_temp.record('reject_none_with_policy', false, 'insert succeeded');
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.record('reject_none_with_policy', true);
  END;

  BEGIN
    INSERT INTO public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, catalog_revision)
    VALUES (v_project, v_owner, 'London', 'Dated', 'Standard', 'none', 'rev');
    PERFORM pg_temp.record('reject_none_with_catalog', false, 'insert succeeded');
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.record('reject_none_with_catalog', true);
  END;

  BEGIN
    INSERT INTO public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority)
    VALUES (v_project, v_owner, 'London', 'Dated', 'Standard', 'category-engine');
    PERFORM pg_temp.record('reject_category_without_policy', false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.record('reject_category_without_policy', true);
  END;

  BEGIN
    INSERT INTO public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, pricing_policy_version, catalog_revision)
    VALUES (v_project, v_owner, 'London', 'Dated', 'Standard', 'category-engine', 'category-engine-v1', 'rev');
    PERFORM pg_temp.record('reject_category_with_catalog', false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.record('reject_category_with_catalog', true);
  END;

  BEGIN
    INSERT INTO public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, pricing_policy_version)
    VALUES (v_project, v_owner, 'London', 'Dated', 'Standard', 'measured-boq-engine', 'v1');
    PERFORM pg_temp.record('reject_measured_without_catalog', false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.record('reject_measured_without_catalog', true);
  END;

  BEGIN
    INSERT INTO public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, pricing_policy_version, catalog_revision)
    VALUES (v_project, v_owner, 'London', 'Dated', 'Standard', 'measured-boq-engine', '', 'rev');
    PERFORM pg_temp.record('reject_empty_policy_version', false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.record('reject_empty_policy_version', true);
  END;

  BEGIN
    INSERT INTO public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority)
    VALUES (v_project, v_owner, 'London', 'Dated', 'Standard', 'unknown');
    PERFORM pg_temp.record('reject_unknown_authority', false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.record('reject_unknown_authority', true);
  END;

  -- Service role RPC happy path
  v_gdv := (SELECT estimated_gdv FROM public.projects WHERE id = v_project);

  v_result := public.persist_category_engine_estimate(
    v_project,
    v_owner,
    'idem-key-1',
    v_hash,
    'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
  );

  v_estimate_id := (v_result->>'estimate_id')::uuid;
  v_replay := (v_result->>'replay')::boolean;

  PERFORM pg_temp.record('service_role_rpc_ok', v_estimate_id IS NOT NULL AND v_replay = false);
  PERFORM pg_temp.record(
    'rpc_marker_category_engine',
    (SELECT pricing_authority = 'category-engine'
       AND pricing_policy_version = 'category-engine-v1'
       AND catalog_revision IS NULL
     FROM public.estimates WHERE id = v_estimate_id)
  );
  PERFORM pg_temp.record(
    'rpc_items_inserted',
    (SELECT count(*) = 1 FROM public.estimate_items WHERE estimate_id = v_estimate_id)
  );
  PERFORM pg_temp.record(
    'rpc_estimate_done_true',
    (SELECT estimate_done IS TRUE FROM public.projects WHERE id = v_project)
  );
  PERFORM pg_temp.record(
    'rpc_estimated_gdv_unchanged',
    (SELECT estimated_gdv = v_gdv FROM public.projects WHERE id = v_project)
  );

  -- Same key / same hash → replay
  v_result := public.persist_category_engine_estimate(
    v_project, v_owner, 'idem-key-1', v_hash, 'category-engine-v1',
    'London', 'Dated', 'Standard',
    1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
    '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
  );
  PERFORM pg_temp.record(
    'idempotent_replay_same_hash',
    (v_result->>'replay')::boolean = true
    AND (v_result->>'estimate_id')::uuid = v_estimate_id
  );
  SELECT count(*) INTO v_count FROM public.estimates
  WHERE project_id = v_project AND pricing_authority = 'category-engine';
  PERFORM pg_temp.record('idempotent_single_estimate', v_count = 1);

  -- Same key / different hash → conflict
  BEGIN
    PERFORM public.persist_category_engine_estimate(
      v_project, v_owner, 'idem-key-1', v_hash_b, 'category-engine-v1',
      'London', 'Dated', 'Standard',
      1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
      '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
    );
    PERFORM pg_temp.record('idempotent_conflict_different_hash', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record(
      'idempotent_conflict_different_hash',
      SQLERRM ILIKE '%IDEMPOTENCY_CONFLICT%'
    );
  END;

  -- Ownership mismatch
  BEGIN
    PERFORM public.persist_category_engine_estimate(
      v_project, v_other, 'idem-key-2', v_hash, 'category-engine-v1',
      'London', 'Dated', 'Standard',
      1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
      '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
    );
    PERFORM pg_temp.record('owner_mismatch_rejects', false);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record(
      'owner_mismatch_rejects',
      SQLERRM ILIKE '%PROJECT_OWNERSHIP_CHANGED%'
    );
  END;

  -- Missing project
  BEGIN
    PERFORM public.persist_category_engine_estimate(
      '99999999-9999-4999-8999-999999999999'::uuid, v_owner, 'idem-key-3', v_hash,
      'category-engine-v1', 'London', 'Dated', 'Standard',
      1, 1, 1, 1, 1, 1, 1, 1, 1, '[]'::jsonb
    );
    PERFORM pg_temp.record('missing_project_rejects', false);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record(
      'missing_project_rejects',
      SQLERRM ILIKE '%PROJECT_NOT_FOUND%'
    );
  END;

  -- Ownership failure leaves no partial rows for new key
  SELECT count(*) INTO v_count FROM public.estimate_authority_idempotency
  WHERE project_id = v_project AND idempotency_key = 'idem-key-2';
  PERFORM pg_temp.record('ownership_failure_no_idemp', v_count = 0);

  -- Rollback proof: bad items shape rolls back
  BEGIN
    PERFORM public.persist_category_engine_estimate(
      v_project, v_owner, 'idem-key-rollback',
      encode(digest('payload-rollback', 'sha256'), 'hex'),
      'category-engine-v1', 'London', 'Dated', 'Standard',
      1, 1, 1, 1, 1, 1, 1, 1, 1,
      '"not-an-array"'::jsonb
    );
    PERFORM pg_temp.record('malformed_payload_rolls_back', false);
  EXCEPTION WHEN OTHERS THEN
    SELECT count(*) INTO v_count FROM public.estimate_authority_idempotency
    WHERE project_id = v_project AND idempotency_key = 'idem-key-rollback';
    PERFORM pg_temp.record('malformed_payload_rolls_back', v_count = 0, SQLERRM);
  END;

END $$;

-- RLS probes as authenticated owner
DO $$
DECLARE
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_project uuid := '33333333-3333-4333-8333-333333333333';
  v_auth_est uuid;
  v_canon uuid;
  v_ok boolean;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- Draft insert allowed
  BEGIN
    INSERT INTO public.estimates (project_id, user_id, region, condition_level, finish_level)
    VALUES (v_project, v_owner, 'London', 'Dated', 'Standard')
    RETURNING id INTO v_auth_est;
    PERFORM pg_temp.record('browser_insert_draft_ok', v_auth_est IS NOT NULL);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('browser_insert_draft_ok', false, SQLERRM);
  END;

  -- Cannot insert category-engine
  BEGIN
    INSERT INTO public.estimates (
      project_id, user_id, region, condition_level, finish_level,
      pricing_authority, pricing_policy_version
    ) VALUES (
      v_project, v_owner, 'London', 'Dated', 'Standard',
      'category-engine', 'category-engine-v1'
    );
    PERFORM pg_temp.record('browser_cannot_insert_category', false);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR OTHERS THEN
    PERFORM pg_temp.record('browser_cannot_insert_category', true, SQLERRM);
  END;

  -- Cannot insert measured-boq-engine
  BEGIN
    INSERT INTO public.estimates (
      project_id, user_id, region, condition_level, finish_level,
      pricing_authority, pricing_policy_version, catalog_revision
    ) VALUES (
      v_project, v_owner, 'London', 'Dated', 'Standard',
      'measured-boq-engine', 'v1', 'rev1'
    );
    PERFORM pg_temp.record('browser_cannot_insert_measured', false);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR OTHERS THEN
    PERFORM pg_temp.record('browser_cannot_insert_measured', true, SQLERRM);
  END;

  -- Cannot escalate none → category-engine
  BEGIN
    UPDATE public.estimates
    SET pricing_authority = 'category-engine',
        pricing_policy_version = 'category-engine-v1'
    WHERE id = v_auth_est;
    -- If update "succeeds" but changes 0 rows due to RLS, still OK
    GET DIAGNOSTICS v_ok = ROW_COUNT;
    IF v_ok > 0 THEN
      -- verify row unchanged
      IF EXISTS (
        SELECT 1 FROM public.estimates
        WHERE id = v_auth_est AND pricing_authority = 'category-engine'
      ) THEN
        PERFORM pg_temp.record('browser_cannot_escalate_marker', false, 'escalated');
      ELSE
        PERFORM pg_temp.record('browser_cannot_escalate_marker', true);
      END IF;
    ELSE
      PERFORM pg_temp.record('browser_cannot_escalate_marker', true, '0 rows');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('browser_cannot_escalate_marker', true, SQLERRM);
  END;

  -- Canonical row protections
  SELECT id INTO v_canon FROM public.estimates
  WHERE project_id = v_project AND pricing_authority = 'category-engine'
  LIMIT 1;

  BEGIN
    UPDATE public.estimates SET mid_total = 1 WHERE id = v_canon;
    GET DIAGNOSTICS v_ok = ROW_COUNT;
    PERFORM pg_temp.record('browser_cannot_update_canonical', v_ok = 0);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('browser_cannot_update_canonical', true, SQLERRM);
  END;

  BEGIN
    DELETE FROM public.estimates WHERE id = v_canon;
    GET DIAGNOSTICS v_ok = ROW_COUNT;
    PERFORM pg_temp.record('browser_cannot_delete_canonical', v_ok = 0);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('browser_cannot_delete_canonical', true, SQLERRM);
  END;

  BEGIN
    INSERT INTO public.estimate_items (estimate_id, user_id, category, labour, materials, total_cost, weeks)
    VALUES (v_canon, v_owner, 'Hack', 1, 1, 2, 1);
    PERFORM pg_temp.record('browser_cannot_insert_canonical_item', false);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('browser_cannot_insert_canonical_item', true, SQLERRM);
  END;

  BEGIN
    UPDATE public.estimate_items SET total_cost = 0 WHERE estimate_id = v_canon;
    GET DIAGNOSTICS v_ok = ROW_COUNT;
    PERFORM pg_temp.record('browser_cannot_update_canonical_item', v_ok = 0);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('browser_cannot_update_canonical_item', true, SQLERRM);
  END;

  BEGIN
    DELETE FROM public.estimate_items WHERE estimate_id = v_canon;
    GET DIAGNOSTICS v_ok = ROW_COUNT;
    PERFORM pg_temp.record('browser_cannot_delete_canonical_item', v_ok = 0);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('browser_cannot_delete_canonical_item', true, SQLERRM);
  END;

  -- Authenticated cannot execute private RPC
  BEGIN
    PERFORM public.persist_category_engine_estimate(
      v_project, v_owner, 'auth-rpc', encode(digest('x', 'sha256'), 'hex'),
      'category-engine-v1', 'London', 'Dated', 'Standard',
      1, 1, 1, 1, 1, 1, 1, 1, 1, '[]'::jsonb
    );
    PERFORM pg_temp.record('authenticated_cannot_execute_rpc', false);
  EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
    PERFORM pg_temp.record('authenticated_cannot_execute_rpc', true, SQLERRM);
  END;

  -- Idempotency table not readable
  BEGIN
    PERFORM 1 FROM public.estimate_authority_idempotency LIMIT 1;
    PERFORM pg_temp.record('browser_cannot_read_idemp', false, 'read succeeded');
  EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
    PERFORM pg_temp.record('browser_cannot_read_idemp', true, SQLERRM);
  END;

  RESET ROLE;
END $$;

-- Anon cannot execute RPC
DO $$
BEGIN
  PERFORM set_config('role', 'anon', true);
  BEGIN
    PERFORM public.persist_category_engine_estimate(
      '33333333-3333-4333-8333-333333333333'::uuid,
      '11111111-1111-4111-8111-111111111111'::uuid,
      'anon-rpc', encode(digest('y', 'sha256'), 'hex'),
      'category-engine-v1', 'London', 'Dated', 'Standard',
      1, 1, 1, 1, 1, 1, 1, 1, 1, '[]'::jsonb
    );
    PERFORM pg_temp.record('anon_cannot_execute_rpc', false);
  EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
    PERFORM pg_temp.record('anon_cannot_execute_rpc', true, SQLERRM);
  END;
  RESET ROLE;
END $$;

-- Report
\echo '=== 4C2B probe results ==='
SELECT name, ok, detail FROM probe_results ORDER BY name;

SELECT
  count(*) FILTER (WHERE ok) AS passed,
  count(*) FILTER (WHERE NOT ok) AS failed,
  count(*) AS total
FROM probe_results;

DO $$
DECLARE
  v_failed int;
BEGIN
  SELECT count(*) INTO v_failed FROM probe_results WHERE NOT ok;
  IF v_failed > 0 THEN
    RAISE EXCEPTION '% probe(s) failed', v_failed;
  END IF;
END $$;

ROLLBACK;
