-- Ticket 4C2B local database probes (run as postgres superuser)
-- Usage:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f scripts/probe-estimate-authority-4c2b.sql
-- Exits non-zero when any probe fails.

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE probe_results (
  name text PRIMARY KEY,
  ok boolean NOT NULL,
  detail text
);

GRANT ALL ON TABLE probe_results TO authenticated, anon, service_role;

-- SECURITY INVOKER: writes only to this transaction's temp table.
-- No elevated privileges; no empty search_path (temp table would be unresolvable).
CREATE OR REPLACE FUNCTION pg_temp.record(p_name text, p_ok boolean, p_detail text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
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
  v_foreign uuid := '55555555-5555-4555-8555-555555555555';
  v_legacy uuid := '44444444-4444-4444-8444-444444444444';
  v_hash text := encode(digest('payload-a', 'sha256'), 'hex');
  v_hash_b text := encode(digest('payload-b', 'sha256'), 'hex');
  v_result jsonb;
  v_estimate_id uuid;
  v_replay boolean;
  v_gdv numeric;
  v_count int;
  v_rows integer;
  v_auth_est uuid;
  v_canon uuid;
BEGIN
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
  ) VALUES
    (v_project, v_owner, '4C2B Project', '1 Test St', 'SW1A 1AA', 'London', 'Flat',
     2, 1, 90, 250000, 400000, false),
    (v_foreign, v_other, 'Foreign Project', '2 Other St', 'E1 1AA', 'London', 'Flat',
     2, 1, 80, 200000, 300000, false)
  ON CONFLICT (id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        estimated_gdv = EXCLUDED.estimated_gdv,
        estimate_done = false;

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

  BEGIN
    INSERT INTO public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority, pricing_policy_version)
    VALUES (v_project, v_owner, 'London', 'Dated', 'Standard', 'none', 'v1');
    PERFORM pg_temp.record('reject_none_with_policy', false, 'insert succeeded');
  EXCEPTION
    WHEN check_violation THEN
      PERFORM pg_temp.record('reject_none_with_policy', true);
    WHEN OTHERS THEN
      PERFORM pg_temp.record('reject_none_with_policy', false, 'unexpected ' || SQLSTATE || ': ' || SQLERRM);
  END;

  BEGIN
    INSERT INTO public.estimates (project_id, user_id, region, condition_level, finish_level, pricing_authority)
    VALUES (v_project, v_owner, 'London', 'Dated', 'Standard', 'category-engine');
    PERFORM pg_temp.record('reject_category_without_policy', false, 'insert succeeded');
  EXCEPTION
    WHEN check_violation THEN
      PERFORM pg_temp.record('reject_category_without_policy', true);
    WHEN OTHERS THEN
      PERFORM pg_temp.record('reject_category_without_policy', false, 'unexpected ' || SQLSTATE || ': ' || SQLERRM);
  END;

  -- Service-role path (explicit role)
  PERFORM set_config('role', 'service_role', true);

  v_gdv := (SELECT estimated_gdv FROM public.projects WHERE id = v_project);

  v_result := public.persist_category_engine_estimate(
    v_project, v_owner, 'idem-key-1', v_hash, 'category-engine-v1',
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

  BEGIN
    PERFORM public.persist_category_engine_estimate(
      v_project, v_owner, 'idem-key-1', v_hash_b, 'category-engine-v1',
      'London', 'Dated', 'Standard',
      1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
      '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
    );
    PERFORM pg_temp.record('idempotent_conflict_different_hash', false, 'operation unexpectedly succeeded');
  EXCEPTION
    WHEN unique_violation THEN
      PERFORM pg_temp.record(
        'idempotent_conflict_different_hash',
        SQLERRM ILIKE '%IDEMPOTENCY_CONFLICT%',
        SQLSTATE || ': ' || SQLERRM
      );
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'idempotent_conflict_different_hash',
        false,
        'unexpected ' || SQLSTATE || ': ' || SQLERRM
      );
  END;

  BEGIN
    PERFORM public.persist_category_engine_estimate(
      v_project, v_other, 'idem-key-2', v_hash, 'category-engine-v1',
      'London', 'Dated', 'Standard',
      1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
      '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
    );
    PERFORM pg_temp.record('owner_mismatch_rejects', false, 'operation unexpectedly succeeded');
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'owner_mismatch_rejects',
        SQLSTATE = 'P0001' AND SQLERRM ILIKE '%PROJECT_OWNERSHIP_CHANGED%',
        SQLSTATE || ': ' || SQLERRM
      );
  END;

  BEGIN
    PERFORM public.persist_category_engine_estimate(
      '99999999-9999-4999-8999-999999999999'::uuid, v_owner, 'idem-key-3', v_hash,
      'category-engine-v1', 'London', 'Dated', 'Standard',
      1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
      '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
    );
    PERFORM pg_temp.record('missing_project_rejects', false, 'operation unexpectedly succeeded');
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'missing_project_rejects',
        SQLSTATE = 'P0002' AND SQLERRM ILIKE '%PROJECT_NOT_FOUND%',
        SQLSTATE || ': ' || SQLERRM
      );
  END;

  BEGIN
    PERFORM public.persist_category_engine_estimate(
      v_project, v_owner, 'idem-malformed',
      encode(digest('payload-malformed', 'sha256'), 'hex'),
      'category-engine-v1', 'London', 'Dated', 'Standard',
      1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
      '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3,"extra":true}]'::jsonb
    );
    PERFORM pg_temp.record('malformed_payload_rolls_back', false, 'operation unexpectedly succeeded');
  EXCEPTION
    WHEN invalid_parameter_value THEN
      SELECT count(*) INTO v_count FROM public.estimate_authority_idempotency
      WHERE project_id = v_project AND idempotency_key = 'idem-malformed';
      PERFORM pg_temp.record(
        'malformed_payload_rolls_back',
        v_count = 0 AND SQLSTATE = '22023',
        SQLSTATE || ': ' || SQLERRM
      );
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'malformed_payload_rolls_back',
        false,
        'unexpected ' || SQLSTATE || ': ' || SQLERRM
      );
  END;

  -- Retry after rollback
  BEGIN
    v_result := public.persist_category_engine_estimate(
      v_project, v_owner, 'idem-malformed',
      encode(digest('payload-retry-ok', 'sha256'), 'hex'),
      'category-engine-v1', 'London', 'Dated', 'Standard',
      1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
      '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
    );
    PERFORM pg_temp.record('retry_after_failed_reservation', (v_result->>'estimate_id') IS NOT NULL);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record('retry_after_failed_reservation', false, SQLSTATE || ': ' || SQLERRM);
  END;

  RESET ROLE;

  -- Authenticated RLS probes
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  BEGIN
    INSERT INTO public.estimates (project_id, user_id, region, condition_level, finish_level)
    VALUES (v_project, v_owner, 'London', 'Dated', 'Standard')
    RETURNING id INTO v_auth_est;
    PERFORM pg_temp.record('browser_insert_draft_own_project', v_auth_est IS NOT NULL);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record('browser_insert_draft_own_project', false, SQLSTATE || ': ' || SQLERRM);
  END;

  BEGIN
    INSERT INTO public.estimates (project_id, user_id, region, condition_level, finish_level)
    VALUES (v_foreign, v_owner, 'London', 'Dated', 'Standard');
    PERFORM pg_temp.record('browser_cannot_insert_foreign_project', false, 'insert succeeded');
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM pg_temp.record('browser_cannot_insert_foreign_project', true, SQLSTATE || ': ' || SQLERRM);
    WHEN OTHERS THEN
      -- RLS may raise different codes depending on version; accept only privilege-class denials
      PERFORM pg_temp.record(
        'browser_cannot_insert_foreign_project',
        SQLSTATE = '42501',
        'unexpected ' || SQLSTATE || ': ' || SQLERRM
      );
  END;

  BEGIN
    INSERT INTO public.estimates (
      project_id, user_id, region, condition_level, finish_level,
      pricing_authority, pricing_policy_version
    ) VALUES (
      v_project, v_owner, 'London', 'Dated', 'Standard',
      'category-engine', 'category-engine-v1'
    );
    PERFORM pg_temp.record('browser_cannot_insert_category', false, 'insert succeeded');
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM pg_temp.record('browser_cannot_insert_category', true, SQLSTATE || ': ' || SQLERRM);
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'browser_cannot_insert_category',
        SQLSTATE = '42501',
        'unexpected ' || SQLSTATE || ': ' || SQLERRM
      );
  END;

  BEGIN
    UPDATE public.estimates
    SET pricing_authority = 'category-engine',
        pricing_policy_version = 'category-engine-v1'
    WHERE id = v_auth_est;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM pg_temp.record(
      'browser_cannot_escalate_marker',
      v_rows = 0 OR NOT EXISTS (
        SELECT 1 FROM public.estimates WHERE id = v_auth_est AND pricing_authority = 'category-engine'
      ),
      'rows=' || v_rows
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM pg_temp.record('browser_cannot_escalate_marker', true, SQLSTATE || ': ' || SQLERRM);
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'browser_cannot_escalate_marker',
        SQLSTATE = '42501',
        'unexpected ' || SQLSTATE || ': ' || SQLERRM
      );
  END;

  SELECT id INTO v_canon FROM public.estimates
  WHERE project_id = v_project AND pricing_authority = 'category-engine'
  LIMIT 1;

  PERFORM pg_temp.record(
    'canonical_estimate_visible_to_owner',
    v_canon IS NOT NULL,
    'canonical=' || coalesce(v_canon::text, 'null')
  );

  BEGIN
    UPDATE public.estimates SET mid_total = 1 WHERE id = v_canon;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM pg_temp.record(
      'browser_cannot_update_canonical',
      v_canon IS NOT NULL AND v_rows = 0,
      'canonical=' || coalesce(v_canon::text, 'null') || ', rows=' || v_rows
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM pg_temp.record(
        'browser_cannot_update_canonical',
        v_canon IS NOT NULL,
        SQLSTATE || ': ' || SQLERRM
      );
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'browser_cannot_update_canonical',
        false,
        'unexpected ' || SQLSTATE || ': ' || SQLERRM
      );
  END;

  BEGIN
    DELETE FROM public.estimates WHERE id = v_canon;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM pg_temp.record(
      'browser_cannot_delete_canonical',
      v_canon IS NOT NULL AND v_rows = 0,
      'canonical=' || coalesce(v_canon::text, 'null') || ', rows=' || v_rows
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM pg_temp.record(
        'browser_cannot_delete_canonical',
        v_canon IS NOT NULL,
        SQLSTATE || ': ' || SQLERRM
      );
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'browser_cannot_delete_canonical',
        false,
        'unexpected ' || SQLSTATE || ': ' || SQLERRM
      );
  END;

  BEGIN
    INSERT INTO public.estimate_items (estimate_id, user_id, category, labour, materials, total_cost, weeks)
    VALUES (v_canon, v_owner, 'Hack', 1, 1, 2, 1);
    PERFORM pg_temp.record(
      'browser_cannot_insert_canonical_item',
      false,
      'insert succeeded; canonical=' || coalesce(v_canon::text, 'null')
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM pg_temp.record(
        'browser_cannot_insert_canonical_item',
        v_canon IS NOT NULL,
        SQLSTATE || ': ' || SQLERRM
      );
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'browser_cannot_insert_canonical_item',
        v_canon IS NOT NULL AND SQLSTATE = '42501',
        'unexpected ' || SQLSTATE || ': ' || SQLERRM
      );
  END;

  BEGIN
    UPDATE public.estimate_items SET total_cost = 0 WHERE estimate_id = v_canon;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM pg_temp.record(
      'browser_cannot_update_canonical_item',
      v_canon IS NOT NULL AND v_rows = 0,
      'canonical=' || coalesce(v_canon::text, 'null') || ', rows=' || v_rows
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM pg_temp.record(
        'browser_cannot_update_canonical_item',
        v_canon IS NOT NULL,
        SQLSTATE || ': ' || SQLERRM
      );
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'browser_cannot_update_canonical_item',
        false,
        'unexpected ' || SQLSTATE || ': ' || SQLERRM
      );
  END;

  BEGIN
    DELETE FROM public.estimate_items WHERE estimate_id = v_canon;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM pg_temp.record(
      'browser_cannot_delete_canonical_item',
      v_canon IS NOT NULL AND v_rows = 0,
      'canonical=' || coalesce(v_canon::text, 'null') || ', rows=' || v_rows
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM pg_temp.record(
        'browser_cannot_delete_canonical_item',
        v_canon IS NOT NULL,
        SQLSTATE || ': ' || SQLERRM
      );
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'browser_cannot_delete_canonical_item',
        false,
        'unexpected ' || SQLSTATE || ': ' || SQLERRM
      );
  END;

  BEGIN
    PERFORM public.persist_category_engine_estimate(
      v_project, v_owner, 'auth-rpc', encode(digest('x', 'sha256'), 'hex'),
      'category-engine-v1', 'London', 'Dated', 'Standard',
      1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
      '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
    );
    PERFORM pg_temp.record('authenticated_cannot_execute_rpc', false, 'operation unexpectedly succeeded');
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM pg_temp.record('authenticated_cannot_execute_rpc', true, SQLSTATE || ': ' || SQLERRM);
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'authenticated_cannot_execute_rpc',
        SQLSTATE = '42501',
        'unexpected ' || SQLSTATE || ': ' || SQLERRM
      );
  END;

  BEGIN
    PERFORM 1 FROM public.estimate_authority_idempotency LIMIT 1;
    PERFORM pg_temp.record('browser_cannot_read_idemp', false, 'read succeeded');
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM pg_temp.record('browser_cannot_read_idemp', true, SQLSTATE || ': ' || SQLERRM);
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'browser_cannot_read_idemp',
        SQLSTATE = '42501',
        'unexpected ' || SQLSTATE || ': ' || SQLERRM
      );
  END;

  RESET ROLE;

  -- Anon RPC denial
  PERFORM set_config('role', 'anon', true);
  BEGIN
    PERFORM public.persist_category_engine_estimate(
      v_project, v_owner, 'anon-rpc', encode(digest('y', 'sha256'), 'hex'),
      'category-engine-v1', 'London', 'Dated', 'Standard',
      1000, 2000, 3000, 300, 660, 3500, 3960, 4500, 4,
      '[{"category":"Kitchen","labour":1000,"materials":2000,"total":3000,"weeks":3}]'::jsonb
    );
    PERFORM pg_temp.record('anon_cannot_execute_rpc', false, 'operation unexpectedly succeeded');
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM pg_temp.record('anon_cannot_execute_rpc', true, SQLSTATE || ': ' || SQLERRM);
    WHEN OTHERS THEN
      PERFORM pg_temp.record(
        'anon_cannot_execute_rpc',
        SQLSTATE = '42501',
        'unexpected ' || SQLSTATE || ': ' || SQLERRM
      );
  END;
  RESET ROLE;
END $$;

\echo '=== 4C2B probe results ==='
SELECT name, ok, detail FROM probe_results ORDER BY name;

SELECT
  count(*) FILTER (WHERE ok) AS passed,
  count(*) FILTER (WHERE NOT ok) AS failed,
  count(*) AS total
FROM probe_results;

-- Expected standalone probe count (update when adding/removing named probes).
-- Includes canonical_estimate_visible_to_owner so zero-row RLS checks cannot
-- pass vacuously when the fixture is missing.
DO $$
DECLARE
  v_failed int;
  v_total int;
  v_expected int := 27;
BEGIN
  SELECT count(*) FILTER (WHERE NOT ok), count(*)
  INTO v_failed, v_total
  FROM probe_results;
  IF v_total <> v_expected THEN
    RAISE EXCEPTION 'expected % probes, got %', v_expected, v_total;
  END IF;
  IF v_failed > 0 THEN
    RAISE EXCEPTION '% probe(s) failed', v_failed;
  END IF;
END $$;

ROLLBACK;
