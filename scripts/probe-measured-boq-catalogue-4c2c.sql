-- Ticket 4C2C-B local database probes (run as postgres superuser)
-- Usage:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f scripts/probe-measured-boq-catalogue-4c2c.sql
-- Exits non-zero when any probe fails.

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE probe_results (
  name text PRIMARY KEY,
  ok boolean NOT NULL,
  detail text
);

GRANT ALL ON TABLE probe_results TO authenticated, anon, service_role;

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
  v_owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_project uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_count int;
  v_rows integer;
  v_sqlstate text;
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'probe4c2c@example.com', crypt('pw', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email)
  VALUES (v_owner, 'probe4c2c@example.com')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.projects (
    id, user_id, name, address, postcode, region, property_type,
    bedrooms, bathrooms, size_sqm, purchase_price, estimated_gdv, estimate_done
  ) VALUES (
    v_project, v_owner, '4C2C Probe', '1 Probe St', 'SW1A 1AA', 'London', 'Flat',
    2, 1, 90, 250000, 400000, false
  ) ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id;

  -- 1 catalogue tables private (authenticated)
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    SELECT count(*) INTO v_count FROM public.measured_boq_catalog_revisions;
    PERFORM pg_temp.record('catalogue_private_auth', false, 'unexpected select success');
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.record('catalogue_private_auth', true, '42501');
  WHEN OTHERS THEN
    PERFORM pg_temp.record('catalogue_private_auth', false, SQLERRM);
  END;
  PERFORM set_config('role', 'postgres', true);

  -- 2 service-role exact reads
  BEGIN
    PERFORM set_config('role', 'service_role', true);
    SELECT count(*) INTO v_count FROM public.measured_boq_catalog_revisions;
    PERFORM pg_temp.record('service_role_read', true, format('count=%s', v_count));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('service_role_read', false, SQLERRM);
  END;
  PERFORM set_config('role', 'postgres', true);

  -- 3 draft editing
  BEGIN
    INSERT INTO public.measured_boq_catalog_revisions (
      catalog_revision, status, schema_version, source_description, entry_count,
      content_checksum, effective_from, created_by
    ) VALUES (
      'mboq-2099.03.01', 'draft', 'mboq-catalogue-v1', 'SYNTHETIC probe', 0,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '2099-03-01', 'probe'
    );
    INSERT INTO public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) VALUES (
      'mboq-2099.03.01', 'synth.probe.m2', 'SYNTHETIC probe item', 'test', 'm2', 'combined', 12
    );
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      PERFORM pg_temp.record('draft_editing', false, format('entry rows=%s', v_rows));
    ELSE
      PERFORM pg_temp.record('draft_editing', true, 'draft entry inserted');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('draft_editing', false, SQLERRM);
  END;

  -- 4 published immutability
  BEGIN
    UPDATE public.measured_boq_catalog_revisions
    SET status = 'published', published_at = now(), entry_count = 1
    WHERE catalog_revision = 'mboq-2099.03.01';
    BEGIN
      UPDATE public.measured_boq_catalog_entries
      SET base_unit_rate = 99
      WHERE catalog_revision = 'mboq-2099.03.01';
      PERFORM pg_temp.record('published_immutability', false, 'entry update succeeded');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      PERFORM pg_temp.record('published_immutability', v_sqlstate = 'P0001', v_sqlstate);
    END;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('published_immutability', false, SQLERRM);
  END;

  -- 5 retired readability (service_role select after retire)
  BEGIN
    UPDATE public.measured_boq_catalog_revisions
    SET status = 'retired', retired_at = now()
    WHERE catalog_revision = 'mboq-2099.03.01';
    PERFORM set_config('role', 'service_role', true);
    SELECT count(*) INTO v_count
    FROM public.measured_boq_catalog_entries
    WHERE catalog_revision = 'mboq-2099.03.01';
    PERFORM pg_temp.record('retired_readable', v_count = 1, format('count=%s', v_count));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('retired_readable', false, SQLERRM);
  END;
  PERFORM set_config('role', 'postgres', true);

  -- 6 duplicate-key prevention
  BEGIN
    INSERT INTO public.measured_boq_catalog_revisions (
      catalog_revision, status, schema_version, source_description, entry_count,
      content_checksum, effective_from, created_by
    ) VALUES (
      'mboq-2099.03.02', 'draft', 'mboq-catalogue-v1', 'SYNTHETIC dup', 0,
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      '2099-03-02', 'probe'
    );
    INSERT INTO public.measured_boq_catalog_entries (
      catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
    ) VALUES (
      'mboq-2099.03.02', 'synth.dup.m2', 'a', 'test', 'm2', 'combined', 1
    );
    BEGIN
      INSERT INTO public.measured_boq_catalog_entries (
        catalog_revision, rate_key, display_name, trade_or_domain, unit, cost_type, base_unit_rate
      ) VALUES (
        'mboq-2099.03.02', 'synth.dup.m2', 'b', 'test', 'm2', 'combined', 2
      );
      PERFORM pg_temp.record('duplicate_key', false, 'duplicate allowed');
    EXCEPTION WHEN unique_violation THEN
      PERFORM pg_temp.record('duplicate_key', true, '23505');
    END;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('duplicate_key', false, SQLERRM);
  END;

  -- 7 composite catalogue reference + measured header/item match
  BEGIN
    INSERT INTO public.estimates (
      id, project_id, user_id, region, condition_level, finish_level,
      mid_total, pricing_authority, pricing_policy_version, catalog_revision
    ) VALUES (
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      v_project, v_owner, 'London', 'Dated', 'Standard',
      12, 'measured-boq-engine', '2026-07-30.1', 'mboq-2099.03.01'
    );
    INSERT INTO public.estimate_items (
      id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost,
      rate_source, rate_key, catalog_revision, base_unit_rate, regional_multiplier, resolved_unit_rate
    ) VALUES (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      v_owner, 'paint', 'Measured', 1, 'm2', 12, 12,
      'library', 'synth.probe.m2', 'mboq-2099.03.01', 12, 1.0, 12
    );
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM pg_temp.record('composite_reference', v_rows = 1, format('rows=%s', v_rows));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('composite_reference', false, SQLERRM);
  END;

  -- 8 draft provenance rejection (trigger path → exactly P0001)
  BEGIN
    INSERT INTO public.estimates (
      id, project_id, user_id, region, condition_level, finish_level,
      mid_total, pricing_authority
    ) VALUES (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      v_project, v_owner, 'London', 'Dated', 'Standard',
      10, 'none'
    );
    BEGIN
      INSERT INTO public.estimate_items (
        id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost,
        rate_source, rate_key, catalog_revision, base_unit_rate, regional_multiplier, resolved_unit_rate
      ) VALUES (
        '11111111-1111-4111-8111-111111111111',
        'ffffffff-ffff-4fff-8fff-ffffffffffff',
        v_owner, 'paint', 'bad', 1, 'm2', 12, 12,
        'library', 'synth.probe.m2', 'mboq-2099.03.01', 12, 1.0, 12
      );
      PERFORM pg_temp.record('draft_provenance_reject', false, 'allowed');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      PERFORM pg_temp.record('draft_provenance_reject', v_sqlstate = 'P0001', v_sqlstate);
    END;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('draft_provenance_reject', false, SQLERRM);
  END;

  -- 8b RLS-only denial on measured header (trigger would accept; RLS → 42501)
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    BEGIN
      INSERT INTO public.estimate_items (
        id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost,
        rate_source, rate_key, catalog_revision, base_unit_rate, regional_multiplier, resolved_unit_rate
      ) VALUES (
        '55555555-5555-4555-8555-555555555555',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        v_owner, 'paint', 'rls block', 1, 'm2', 12, 12,
        'library', 'synth.probe.m2', 'mboq-2099.03.01', 12, 1.0, 12
      );
      PERFORM pg_temp.record('rls_measured_insert_deny', false, 'allowed');
    EXCEPTION WHEN insufficient_privilege THEN
      PERFORM pg_temp.record('rls_measured_insert_deny', true, '42501');
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      PERFORM pg_temp.record('rls_measured_insert_deny', v_sqlstate = '42501', v_sqlstate);
    END;
    PERFORM set_config('role', 'postgres', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role', 'postgres', true);
    PERFORM pg_temp.record('rls_measured_insert_deny', false, SQLERRM);
  END;

  -- 9 category compatibility
  BEGIN
    INSERT INTO public.estimates (
      id, project_id, user_id, region, condition_level, finish_level,
      mid_total, pricing_authority, pricing_policy_version
    ) VALUES (
      '22222222-2222-4222-8222-222222222222',
      v_project, v_owner, 'London', 'Dated', 'Standard',
      50, 'category-engine', 'category-engine-v1'
    );
    INSERT INTO public.estimate_items (
      id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost
    ) VALUES (
      '33333333-3333-4333-8333-333333333333',
      '22222222-2222-4222-8222-222222222222',
      v_owner, 'paint', 'cat item', 1, 'item', 50, 50
    );
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM pg_temp.record('category_compat', v_rows = 1, format('rows=%s', v_rows));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('category_compat', false, SQLERRM);
  END;

  -- 10 arithmetic integrity
  BEGIN
    BEGIN
      INSERT INTO public.estimate_items (
        id, estimate_id, user_id, category, name, quantity, unit, unit_cost, total_cost,
        rate_source, rate_key, catalog_revision, base_unit_rate, regional_multiplier, resolved_unit_rate
      ) VALUES (
        '44444444-4444-4444-8444-444444444444',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        v_owner, 'paint', 'bad arith', 1, 'm2', 12, 12,
        'library', 'synth.probe.m2', 'mboq-2099.03.01', 12, 1.0, 99
      );
      PERFORM pg_temp.record('arithmetic_integrity', false, 'bad arith allowed');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      PERFORM pg_temp.record('arithmetic_integrity', v_sqlstate = 'P0001', v_sqlstate);
    END;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.record('arithmetic_integrity', false, SQLERRM);
  END;

END $$;

SELECT name, ok, detail FROM probe_results ORDER BY name;

DO $$
DECLARE
  v_total int;
  v_failed int;
  v_expected int := 11;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE NOT ok)
  INTO v_total, v_failed
  FROM probe_results;
  IF v_total <> v_expected THEN
    RAISE EXCEPTION 'probe count mismatch: expected %, got %', v_expected, v_total;
  END IF;
  IF v_failed > 0 THEN
    RAISE EXCEPTION '% probe(s) failed', v_failed;
  END IF;
  RAISE NOTICE 'All % 4C2C-B catalogue probes passed', v_total;
END $$;

ROLLBACK;
