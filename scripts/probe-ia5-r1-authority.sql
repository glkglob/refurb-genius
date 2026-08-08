-- IA-5-R1 authority TOCTOU / forgery probes (local only).
-- Run as postgres against local Supabase after migration apply.
\set ON_ERROR_STOP on

DO $$
DECLARE
  u1 uuid := 'aaaaaaaa-1111-4111-8111-111111111111';
  p1 uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
  p2 uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02';
  ph1 uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01';
  ph2 uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02';
  r1 uuid;
  r2 uuid;
  s1 public.scope_analyses%ROWTYPE;
  s2 public.scope_analyses%ROWTYPE;
  e1 uuid;
  e2 uuid;
  snap public.project_export_snapshots%ROWTYPE;
  v_identity text;
BEGIN
  DELETE FROM public.project_export_snapshots WHERE user_id = u1;
  DELETE FROM public.estimate_items WHERE user_id = u1;
  DELETE FROM public.estimates WHERE user_id = u1;
  DELETE FROM public.scope_analysis_items WHERE room_id IN (
    SELECT id FROM public.scope_analysis_rooms WHERE scope_analysis_id IN (
      SELECT id FROM public.scope_analyses WHERE user_id = u1
    )
  );
  DELETE FROM public.scope_analysis_issues WHERE room_id IN (
    SELECT id FROM public.scope_analysis_rooms WHERE scope_analysis_id IN (
      SELECT id FROM public.scope_analyses WHERE user_id = u1
    )
  );
  DELETE FROM public.scope_analysis_rooms WHERE scope_analysis_id IN (
    SELECT id FROM public.scope_analyses WHERE user_id = u1
  );
  DELETE FROM public.scope_analyses WHERE user_id = u1;
  DELETE FROM public.redesign_concepts WHERE user_id = u1;
  DELETE FROM public.room_analyses WHERE user_id = u1;
  DELETE FROM public.photos WHERE user_id = u1;
  DELETE FROM public.projects WHERE id IN (p1, p2);
  DELETE FROM public.profiles WHERE id = u1;
  DELETE FROM auth.users WHERE id = u1;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ia5r1@example.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, email) VALUES (u1, 'ia5r1@example.com') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.projects (id, user_id, name, region, property_type)
  VALUES (p1, u1, 'IA5-R1 P1', 'London', 'Terraced'),
         (p2, u1, 'IA5-R1 P2', 'London', 'Terraced');

  INSERT INTO public.photos (id, project_id, user_id, storage_path, url, name, size)
  VALUES (ph1, p1, u1, 'x/1.jpg', 'https://example.com/1.jpg', '1.jpg', 100);

  INSERT INTO public.room_analyses (
    project_id, user_id, photo_id, photo_url, photo_name, room_type,
    condition_level, refurbishment_level, source, confidence_score
  ) VALUES (
    p1, u1, ph1, 'https://example.com/1.jpg', '1.jpg', 'Kitchen',
    'average', 'light', 'ai', 0.9
  );

  v_identity := ph1::text;

  INSERT INTO public.redesign_concepts (
    id, project_id, user_id, style, title, description, analysis_identity, is_selected
  ) VALUES (
    gen_random_uuid(), p1, u1, 'Modern', 'R1', 'desc', v_identity, true
  ) RETURNING id INTO r1;

  -- Act as u1 for RPCs
  PERFORM set_config('request.jwt.claim.sub', u1::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- Scope publish OK
  SELECT * INTO s1 FROM public.save_project_scope_analysis(
    p1,
    7,
    'scope one',
    'London',
    null,
    '[{"room":"Kitchen","condition_summary":"ok","issues":[{"category":"g","description":"d","severity":"low","recommended_action":"a"}],"recommended_items":[{"name":"Paint","category":"materials","quantity":1,"unit":"m2","base_unit_cost":10}]}]'::jsonb
  );

  IF s1.analysis_identity IS DISTINCT FROM v_identity THEN
    RAISE EXCEPTION 'SCOPE_PROVENANCE_FAIL expected % got %', v_identity, s1.analysis_identity;
  END IF;
  IF s1.redesign_identity IS DISTINCT FROM r1::text THEN
    RAISE EXCEPTION 'SCOPE_REDESIGN_PROVENANCE_FAIL';
  END IF;
  RAISE NOTICE 'SCOPE_PUBLISH_OK id=% analysis=% redesign=%', s1.id, s1.analysis_identity, s1.redesign_identity;

  -- Second redesign + reselect for TOCTOU
  UPDATE public.redesign_concepts SET is_selected = false WHERE id = r1;
  INSERT INTO public.redesign_concepts (
    project_id, user_id, style, title, description, analysis_identity, is_selected
  ) VALUES (
    p1, u1, 'Classic', 'R2', 'desc', v_identity, true
  ) RETURNING id INTO r2;

  SELECT * INTO s2 FROM public.save_project_scope_analysis(
    p1,
    8,
    'scope two',
    'London',
    null,
    '[{"room":"Kitchen","condition_summary":"ok","issues":[{"category":"g","description":"d2","severity":"low","recommended_action":"a"}],"recommended_items":[{"name":"Tile","category":"materials","quantity":1,"unit":"m2","base_unit_cost":20}]}]'::jsonb
  );
  RAISE NOTICE 'SCOPE_S2_OK id=% redesign=%', s2.id, s2.redesign_identity;

  -- Estimates
  INSERT INTO public.estimates (
    project_id, user_id, region, condition_level, finish_level,
    labour_total, materials_total, subtotal, contingency, vat_amount, low_total, mid_total, high_total, timeline_weeks,
    pricing_authority, pricing_policy_version, status
  ) VALUES (
    p1, u1, 'London', 'average', 'standard', 1,1,2,0,0,2,2,2,1, 'category-engine', 'category-engine-v1', 'draft'
  ) RETURNING id INTO e1;

  -- Bind to stale S1 while S2 current → reject
  BEGIN
    PERFORM public.bind_estimate_input_scope(e1, s1.id);
    RAISE EXCEPTION 'STALE_SCOPE_BIND: unexpected success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%stale_scope%' OR SQLERRM LIKE '%scope_not_current%' THEN
      RAISE NOTICE 'STALE_SCOPE_BIND: REJECTED as expected (% )', SQLERRM;
    ELSE
      RAISE;
    END IF;
  END;

  -- Bind to current S2 → ok
  PERFORM public.bind_estimate_input_scope(e1, s2.id);
  IF (SELECT input_scope_id FROM public.estimates WHERE id = e1) IS DISTINCT FROM s2.id THEN
    RAISE EXCEPTION 'CURRENT_SCOPE_BIND_FAIL';
  END IF;
  RAISE NOTICE 'CURRENT_SCOPE_BIND: OK';

  -- New estimate E2 (append-only)
  INSERT INTO public.estimates (
    project_id, user_id, region, condition_level, finish_level,
    labour_total, materials_total, subtotal, contingency, vat_amount, low_total, mid_total, high_total, timeline_weeks,
    pricing_authority, pricing_policy_version, status, input_scope_id
  ) VALUES (
    p1, u1, 'London', 'average', 'standard', 5,5,10,0,0,10,10,10,2, 'category-engine', 'category-engine-v1', 'draft', s2.id
  ) RETURNING id INTO e2;

  IF e1 = e2 THEN
    RAISE EXCEPTION 'CASE_A_FAIL same estimate id';
  END IF;
  RAISE NOTICE 'CASE_A: E1=% E2=%', e1, e2;

  -- Export against stale E1 while E2 current → reject
  BEGIN
    PERFORM public.publish_project_export_snapshot(p1, e1, 'investor_report');
    RAISE EXCEPTION 'STALE_ESTIMATE_EXPORT: unexpected success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%stale_estimate%' THEN
      RAISE NOTICE 'STALE_ESTIMATE_EXPORT: REJECTED as expected';
    ELSE
      RAISE;
    END IF;
  END;

  -- Export against current E2 → ok
  SELECT * INTO snap FROM public.publish_project_export_snapshot(p1, e2, 'investor_report');
  IF snap.estimate_id IS DISTINCT FROM e2 THEN
    RAISE EXCEPTION 'EXPORT_BIND_FAIL';
  END IF;
  RAISE NOTICE 'EXPORT_PUBLISH_OK id=% estimate=%', snap.id, snap.estimate_id;

  -- Cross-project: estimate for p2, publish under p1
  INSERT INTO public.photos (id, project_id, user_id, storage_path, url, name, size)
  VALUES (ph2, p2, u1, 'x/2.jpg', 'https://example.com/2.jpg', '2.jpg', 100);
  INSERT INTO public.estimates (
    project_id, user_id, region, condition_level, finish_level,
    labour_total, materials_total, subtotal, contingency, vat_amount, low_total, mid_total, high_total, timeline_weeks,
    pricing_authority, pricing_policy_version, status
  ) VALUES (
    p2, u1, 'London', 'average', 'standard', 1,1,2,0,0,2,2,2,1, 'category-engine', 'category-engine-v1', 'draft'
  ) RETURNING id INTO e1; -- reuse var for p2 estimate

  BEGIN
    PERFORM public.publish_project_export_snapshot(p1, e1, 'investor_report');
    RAISE EXCEPTION 'CROSS_PROJECT_EXPORT: unexpected success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%stale_estimate%' OR SQLERRM LIKE '%estimate_project_mismatch%' OR SQLERRM LIKE '%estimate_not%' THEN
      RAISE NOTICE 'CROSS_PROJECT_EXPORT: REJECTED as expected (% )', SQLERRM;
    ELSE
      RAISE;
    END IF;
  END;

  -- Cleanup
  DELETE FROM public.project_export_snapshots WHERE user_id = u1;
  DELETE FROM public.estimates WHERE user_id = u1;
  DELETE FROM public.scope_analysis_items WHERE room_id IN (
    SELECT id FROM public.scope_analysis_rooms WHERE scope_analysis_id IN (
      SELECT id FROM public.scope_analyses WHERE user_id = u1
    )
  );
  DELETE FROM public.scope_analysis_issues WHERE room_id IN (
    SELECT id FROM public.scope_analysis_rooms WHERE scope_analysis_id IN (
      SELECT id FROM public.scope_analyses WHERE user_id = u1
    )
  );
  DELETE FROM public.scope_analysis_rooms WHERE scope_analysis_id IN (
    SELECT id FROM public.scope_analyses WHERE user_id = u1
  );
  DELETE FROM public.scope_analyses WHERE user_id = u1;
  DELETE FROM public.redesign_concepts WHERE user_id = u1;
  DELETE FROM public.room_analyses WHERE user_id = u1;
  DELETE FROM public.photos WHERE user_id = u1;
  DELETE FROM public.projects WHERE id IN (p1, p2);

  RAISE NOTICE 'IA5_R1_PROBE_COMPLETE';
END $$;
