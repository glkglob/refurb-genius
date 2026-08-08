-- IA-5-R2 semantic current-Estimate probe (local only)
\set ON_ERROR_STOP on

DO $$
DECLARE
  u1 uuid := 'dddddddd-1111-4111-8111-111111111111';
  p1 uuid := 'dddddddd-aaaa-4aaa-8aaa-aaaaaaaaaa01';
  ph1 uuid := 'dddddddd-bbbb-4bbb-8bbb-bbbbbbbbbb01';
  r1 uuid;
  s1 public.scope_analyses%ROWTYPE;
  s2 public.scope_analyses%ROWTYPE;
  e_valid uuid;
  e_draft uuid;
  e_stale uuid;
  e2 uuid;
  snap public.project_export_snapshots%ROWTYPE;
  v_identity text;
BEGIN
  DELETE FROM public.project_export_snapshots WHERE user_id = u1;
  DELETE FROM public.estimates WHERE user_id = u1;
  DELETE FROM public.scope_analysis_items WHERE room_id IN (SELECT id FROM public.scope_analysis_rooms WHERE scope_analysis_id IN (SELECT id FROM public.scope_analyses WHERE user_id=u1));
  DELETE FROM public.scope_analysis_issues WHERE room_id IN (SELECT id FROM public.scope_analysis_rooms WHERE scope_analysis_id IN (SELECT id FROM public.scope_analyses WHERE user_id=u1));
  DELETE FROM public.scope_analysis_rooms WHERE scope_analysis_id IN (SELECT id FROM public.scope_analyses WHERE user_id=u1);
  DELETE FROM public.scope_analyses WHERE user_id = u1;
  DELETE FROM public.redesign_concepts WHERE user_id = u1;
  DELETE FROM public.room_analyses WHERE user_id = u1;
  DELETE FROM public.photos WHERE user_id = u1;
  DELETE FROM public.projects WHERE id = p1;
  DELETE FROM public.profiles WHERE id = u1;
  DELETE FROM auth.users WHERE id = u1;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r2@example.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, email) VALUES (u1, 'r2@example.com') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.projects (id, user_id, name, region, property_type) VALUES (p1, u1, 'R2', 'London', 'Terraced');
  INSERT INTO public.photos (id, project_id, user_id, storage_path, url, name, size)
  VALUES (ph1, p1, u1, 'x/1.jpg', 'https://example.com/1.jpg', '1.jpg', 100);
  INSERT INTO public.room_analyses (project_id, user_id, photo_id, photo_url, photo_name, room_type, condition_level, refurbishment_level, source, confidence_score)
  VALUES (p1, u1, ph1, 'https://example.com/1.jpg', '1.jpg', 'Kitchen', 'average', 'light', 'ai', 0.9);
  v_identity := ph1::text;
  INSERT INTO public.redesign_concepts (project_id, user_id, style, title, description, analysis_identity, is_selected)
  VALUES (p1, u1, 'Modern', 'R1', 'd', v_identity, true) RETURNING id INTO r1;

  PERFORM set_config('request.jwt.claim.sub', u1::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT * INTO s1 FROM public.save_project_scope_analysis(
    p1, 7, 's1', 'London', '',
    '[{"room":"Kitchen","condition_summary":"ok","issues":[{"category":"g","description":"d","severity":"low","recommended_action":"a"}],"recommended_items":[{"name":"Paint","category":"materials","quantity":1,"unit":"m2","base_unit_cost":10}]}]'::jsonb
  );

  INSERT INTO public.estimates (
    project_id, user_id, region, condition_level, finish_level,
    labour_total, materials_total, subtotal, contingency, vat_amount, low_total, mid_total, high_total, timeline_weeks,
    pricing_authority, pricing_policy_version, status, input_scope_id, created_at
  ) VALUES (
    p1, u1, 'London', 'average', 'standard', 10,10,20,0,0,20,20,20,1,
    'category-engine', 'category-engine-v1', 'draft', s1.id, now() - interval '2 minutes'
  ) RETURNING id INTO e_valid;

  INSERT INTO public.estimates (
    project_id, user_id, region, condition_level, finish_level,
    labour_total, materials_total, subtotal, contingency, vat_amount, low_total, mid_total, high_total, timeline_weeks,
    pricing_authority, status, created_at
  ) VALUES (
    p1, u1, 'London', 'average', 'standard', 1,1,2,0,0,2,2,2,1,
    'none', 'draft', now() - interval '1 minute'
  ) RETURNING id INTO e_draft;

  -- Draft publish must fail
  BEGIN
    PERFORM public.publish_project_export_snapshot(p1, e_draft, 'investor_report');
    RAISE EXCEPTION 'DRAFT_EXPORT: unexpected success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%stale_estimate%' OR SQLERRM LIKE '%estimate_not_current%' THEN
      RAISE NOTICE 'DRAFT_EXPORT: REJECTED OK (%)', SQLERRM;
    ELSE RAISE; END IF;
  END;

  -- Valid still current despite newer draft
  SELECT * INTO snap FROM public.publish_project_export_snapshot(p1, e_valid, 'investor_report');
  RAISE NOTICE 'VALID_EXPORT_DESPITE_DRAFT: OK snap=% est=%', snap.id, snap.estimate_id;

  -- Scope → S2
  SELECT * INTO s2 FROM public.save_project_scope_analysis(
    p1, 8, 's2', 'London', '',
    '[{"room":"Kitchen","condition_summary":"ok2","issues":[{"category":"g","description":"d2","severity":"low","recommended_action":"a"}],"recommended_items":[{"name":"Tile","category":"materials","quantity":1,"unit":"m2","base_unit_cost":20}]}]'::jsonb
  );

  -- E_valid now stale for Export
  BEGIN
    PERFORM public.publish_project_export_snapshot(p1, e_valid, 'investor_report');
    RAISE EXCEPTION 'STALE_SCOPE_E1_EXPORT: unexpected success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%stale_estimate%' OR SQLERRM LIKE '%estimate_not_current%' THEN
      RAISE NOTICE 'STALE_SCOPE_E1_EXPORT: REJECTED OK';
    ELSE RAISE; END IF;
  END;

  -- Newer authority estimate still on S1
  INSERT INTO public.estimates (
    project_id, user_id, region, condition_level, finish_level,
    labour_total, materials_total, subtotal, contingency, vat_amount, low_total, mid_total, high_total, timeline_weeks,
    pricing_authority, pricing_policy_version, status, input_scope_id, created_at
  ) VALUES (
    p1, u1, 'London', 'average', 'standard', 50,50,100,0,0,100,100,100,3,
    'category-engine', 'category-engine-v1', 'draft', s1.id, now()
  ) RETURNING id INTO e_stale;

  BEGIN
    PERFORM public.publish_project_export_snapshot(p1, e_stale, 'investor_report');
    RAISE EXCEPTION 'STALE_SCOPE_NEWEST_EXPORT: unexpected success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%stale_estimate%' OR SQLERRM LIKE '%estimate_not_current%' THEN
      RAISE NOTICE 'STALE_SCOPE_NEWEST_EXPORT: REJECTED OK';
    ELSE RAISE; END IF;
  END;

  -- E2 on S2
  INSERT INTO public.estimates (
    project_id, user_id, region, condition_level, finish_level,
    labour_total, materials_total, subtotal, contingency, vat_amount, low_total, mid_total, high_total, timeline_weeks,
    pricing_authority, pricing_policy_version, status, input_scope_id, created_at
  ) VALUES (
    p1, u1, 'London', 'average', 'standard', 60,60,120,0,0,120,120,120,4,
    'category-engine', 'category-engine-v1', 'draft', s2.id, now() + interval '1 second'
  ) RETURNING id INTO e2;

  SELECT * INTO snap FROM public.publish_project_export_snapshot(p1, e2, 'investor_report');
  RAISE NOTICE 'E2_CURRENT_EXPORT: OK snap=%', snap.id;

  -- Cleanup
  DELETE FROM public.project_export_snapshots WHERE user_id = u1;
  DELETE FROM public.estimates WHERE user_id = u1;
  DELETE FROM public.scope_analysis_items WHERE room_id IN (SELECT id FROM public.scope_analysis_rooms WHERE scope_analysis_id IN (SELECT id FROM public.scope_analyses WHERE user_id=u1));
  DELETE FROM public.scope_analysis_issues WHERE room_id IN (SELECT id FROM public.scope_analysis_rooms WHERE scope_analysis_id IN (SELECT id FROM public.scope_analyses WHERE user_id=u1));
  DELETE FROM public.scope_analysis_rooms WHERE scope_analysis_id IN (SELECT id FROM public.scope_analyses WHERE user_id=u1);
  DELETE FROM public.scope_analyses WHERE user_id = u1;
  DELETE FROM public.redesign_concepts WHERE user_id = u1;
  DELETE FROM public.room_analyses WHERE user_id = u1;
  DELETE FROM public.photos WHERE user_id = u1;
  DELETE FROM public.projects WHERE id = p1;

  RAISE NOTICE 'IA5_R2_PROBE_COMPLETE';
END $$;
