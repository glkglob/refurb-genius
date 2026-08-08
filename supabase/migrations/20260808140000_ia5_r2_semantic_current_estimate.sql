-- IA-5-R2 — Semantic current-Estimate resolution for Export publication.
-- Unapplied to production until IA-5-M.
--
-- BV2 defect: publish_project_export_snapshot selected current Estimate as
-- newest row by created_at/id only, allowing drafts and stale-Scope estimates
-- to win Export authority.
--
-- Does NOT edit 20260808120000 / 20260808130000 migration files.

-- Authoritative pricing markers (aligned with estimateAuthorityEvidenceFromRow):
--   category-engine | measured-boq-engine
-- Draft / non-authority:
--   pricing_authority = 'none' (typically status draft)

-- Tie-break Scope currentness when multiple rows share created_at (same txn).
CREATE OR REPLACE FUNCTION public.ia5_resolve_current_scope_id(
  p_project_id uuid,
  p_uid uuid,
  p_analysis_identity text,
  p_redesign_identity text
)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT sa.id
  FROM public.scope_analyses sa
  WHERE sa.property_id = p_project_id
    AND sa.user_id = p_uid
    AND sa.analysis_identity = p_analysis_identity
    AND sa.redesign_identity = p_redesign_identity
    AND sa.analysis_identity <> ''
    AND sa.redesign_identity <> ''
  ORDER BY sa.created_at DESC, sa.id DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.ia5_resolve_current_scope_id(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ia5_resolve_current_scope_id(uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.ia5_resolve_current_scope_id(uuid, uuid, text, text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.ia5_is_authoritative_estimate_pricing(
  p_pricing_authority text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(p_pricing_authority, 'none') IN ('category-engine', 'measured-boq-engine');
$$;

REVOKE ALL ON FUNCTION public.ia5_is_authoritative_estimate_pricing(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ia5_is_authoritative_estimate_pricing(text) FROM anon;
REVOKE ALL ON FUNCTION public.ia5_is_authoritative_estimate_pricing(text) FROM authenticated;
-- Internal helper (DEFINER callers only).

-- Resolve CURRENT Scope id for a project (same semantics as bind_estimate_input_scope).
CREATE OR REPLACE FUNCTION public.ia5_resolve_current_scope_id_for_project(
  p_project_id uuid,
  p_uid uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_analysis_identity text;
  v_redesign_id uuid;
  v_redesign_identity text;
  v_scope_id uuid;
BEGIN
  v_analysis_identity := public.ia5_derive_current_analysis_identity(p_project_id, p_uid);

  SELECT rc.id
  INTO v_redesign_id
  FROM public.redesign_concepts rc
  WHERE rc.project_id = p_project_id
    AND rc.user_id = p_uid
    AND rc.is_selected = true
    AND rc.analysis_identity = v_analysis_identity;

  IF v_redesign_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_redesign_identity := v_redesign_id::text;

  v_scope_id := public.ia5_resolve_current_scope_id(
    p_project_id,
    p_uid,
    v_analysis_identity,
    v_redesign_identity
  );

  RETURN v_scope_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ia5_resolve_current_scope_id_for_project(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ia5_resolve_current_scope_id_for_project(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ia5_resolve_current_scope_id_for_project(uuid, uuid) FROM authenticated;

-- Current Estimate: latest qualifying authority row bound to current Scope.
CREATE OR REPLACE FUNCTION public.ia5_resolve_current_estimate_id(
  p_project_id uuid,
  p_uid uuid,
  p_current_scope_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT e.id
  FROM public.estimates e
  WHERE e.project_id = p_project_id
    AND e.user_id = p_uid
    AND public.ia5_is_authoritative_estimate_pricing(e.pricing_authority)
    AND e.input_scope_id IS NOT NULL
    AND e.input_scope_id = p_current_scope_id
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.ia5_resolve_current_estimate_id(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ia5_resolve_current_estimate_id(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ia5_resolve_current_estimate_id(uuid, uuid, uuid) FROM authenticated;

-- Replace Export publication with semantic current-Estimate resolution.
CREATE OR REPLACE FUNCTION public.publish_project_export_snapshot(
  p_project_id uuid,
  p_estimate_id uuid,
  p_kind text DEFAULT 'investor_report'
)
RETURNS public.project_export_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_estimate_id uuid;
  v_estimate_project uuid;
  v_estimate_owner uuid;
  v_estimate_scope uuid;
  v_estimate_authority text;
  v_current_scope_id uuid;
  v_current_estimate_id uuid;
  v_kind text;
  v_row public.project_export_snapshots;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_project_id IS NULL OR p_estimate_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  v_kind := coalesce(nullif(trim(p_kind), ''), 'investor_report');
  IF length(v_kind) > 64 THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT p.id
  INTO v_project_id
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.user_id = v_uid
  FOR UPDATE;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'project_not_authorised' USING ERRCODE = '42501';
  END IF;

  -- Semantic current Scope (Analysis + selected Redesign provenance).
  BEGIN
    v_current_scope_id := public.ia5_resolve_current_scope_id_for_project(p_project_id, v_uid);
  EXCEPTION
    WHEN others THEN
      -- analysis_not_current / etc. → no current Scope → no current Estimate
      RAISE EXCEPTION 'estimate_not_current' USING ERRCODE = '22023';
  END;

  IF v_current_scope_id IS NULL THEN
    RAISE EXCEPTION 'estimate_not_current' USING ERRCODE = '22023';
  END IF;

  -- Semantic current Estimate among authority rows bound to that Scope.
  v_current_estimate_id := public.ia5_resolve_current_estimate_id(
    p_project_id,
    v_uid,
    v_current_scope_id
  );

  IF v_current_estimate_id IS NULL THEN
    RAISE EXCEPTION 'estimate_not_current' USING ERRCODE = '22023';
  END IF;

  IF p_estimate_id IS DISTINCT FROM v_current_estimate_id THEN
    RAISE EXCEPTION 'stale_estimate' USING ERRCODE = '22023';
  END IF;

  SELECT e.id, e.project_id, e.user_id, e.input_scope_id, e.pricing_authority
  INTO v_estimate_id, v_estimate_project, v_estimate_owner, v_estimate_scope, v_estimate_authority
  FROM public.estimates e
  WHERE e.id = p_estimate_id
  FOR UPDATE;

  IF v_estimate_id IS NULL OR v_estimate_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'estimate_not_authorised' USING ERRCODE = '42501';
  END IF;

  IF v_estimate_project IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'estimate_project_mismatch' USING ERRCODE = '42501';
  END IF;

  -- Defense in depth: re-check authority + current Scope binding after lock.
  IF NOT public.ia5_is_authoritative_estimate_pricing(v_estimate_authority) THEN
    RAISE EXCEPTION 'estimate_not_current' USING ERRCODE = '22023';
  END IF;

  IF v_estimate_scope IS DISTINCT FROM v_current_scope_id THEN
    RAISE EXCEPTION 'stale_estimate' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.project_export_snapshots (
    project_id,
    user_id,
    estimate_id,
    kind
  ) VALUES (
    p_project_id,
    v_uid,
    p_estimate_id,
    v_kind
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.publish_project_export_snapshot(uuid, uuid, text) IS
  'IA-5-R2: Export publish. SECURITY DEFINER; current Scope provenance + authoritative Estimate bound to that Scope; rejects drafts and stale-Scope estimates.';

REVOKE ALL ON FUNCTION public.publish_project_export_snapshot(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_project_export_snapshot(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.publish_project_export_snapshot(uuid, uuid, text) TO authenticated;

-- Ensure Scope append-only revisions get distinct created_at within one txn.
CREATE OR REPLACE FUNCTION public.save_project_scope_analysis(
  p_project_id uuid,
  p_overall_score numeric,
  p_summary text,
  p_region text,
  p_notes text,
  p_rooms jsonb
)
RETURNS public.scope_analyses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_analysis_identity text;
  v_redesign_id uuid;
  v_redesign_identity text;
  v_header public.scope_analyses;
  v_room jsonb;
  v_issue jsonb;
  v_item jsonb;
  v_room_id uuid;
  v_i int;
  v_j int;
  v_rooms_len int;
  v_issues_len int;
  v_items_len int;
  v_room_name text;
  v_score numeric;
  v_ts timestamptz := clock_timestamp();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  IF p_rooms IS NULL OR jsonb_typeof(p_rooms) <> 'array' THEN
    RAISE EXCEPTION 'invalid_scope_payload' USING ERRCODE = '22023';
  END IF;

  v_rooms_len := jsonb_array_length(p_rooms);
  IF v_rooms_len < 1 THEN
    RAISE EXCEPTION 'invalid_scope_payload' USING ERRCODE = '22023';
  END IF;

  SELECT p.id
  INTO v_project_id
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.user_id = v_uid
  FOR UPDATE;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'project_not_authorised' USING ERRCODE = '42501';
  END IF;

  v_analysis_identity := public.ia5_derive_current_analysis_identity(p_project_id, v_uid);

  SELECT rc.id
  INTO v_redesign_id
  FROM public.redesign_concepts rc
  WHERE rc.project_id = p_project_id
    AND rc.user_id = v_uid
    AND rc.is_selected = true
    AND rc.analysis_identity = v_analysis_identity
  FOR UPDATE;

  IF v_redesign_id IS NULL THEN
    RAISE EXCEPTION 'redesign_not_current' USING ERRCODE = '22023';
  END IF;

  v_redesign_identity := v_redesign_id::text;

  v_score := coalesce(p_overall_score, 0);
  IF v_score < 0 OR v_score > 10 THEN
    RAISE EXCEPTION 'invalid_scope_payload' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.scope_analyses (
    user_id,
    property_id,
    overall_score,
    summary,
    region,
    notes,
    analysis_identity,
    redesign_concept_id,
    redesign_identity,
    created_at,
    updated_at
  ) VALUES (
    v_uid,
    p_project_id,
    v_score,
    nullif(trim(coalesce(p_summary, '')), ''),
    nullif(trim(coalesce(p_region, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_analysis_identity,
    v_redesign_id,
    v_redesign_identity,
    v_ts,
    v_ts
  )
  RETURNING * INTO v_header;

  FOR v_i IN 0 .. (v_rooms_len - 1) LOOP
    v_room := p_rooms -> v_i;
    IF v_room IS NULL OR jsonb_typeof(v_room) <> 'object' THEN
      RAISE EXCEPTION 'invalid_scope_payload' USING ERRCODE = '22023';
    END IF;

    v_room_name := nullif(trim(coalesce(v_room ->> 'room', '')), '');
    IF v_room_name IS NULL THEN
      RAISE EXCEPTION 'invalid_scope_payload' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.scope_analysis_rooms (
      scope_analysis_id,
      room_name,
      area_sqm,
      condition_summary,
      display_order
    ) VALUES (
      v_header.id,
      left(v_room_name, 200),
      CASE
        WHEN (v_room ->> 'area_sqm') IS NULL OR (v_room ->> 'area_sqm') = '' THEN NULL
        ELSE (v_room ->> 'area_sqm')::numeric
      END,
      nullif(trim(coalesce(v_room ->> 'condition_summary', '')), ''),
      v_i
    )
    RETURNING id INTO v_room_id;

    IF jsonb_typeof(v_room -> 'issues') = 'array' THEN
      v_issues_len := jsonb_array_length(v_room -> 'issues');
      FOR v_j IN 0 .. (v_issues_len - 1) LOOP
        v_issue := v_room -> 'issues' -> v_j;
        IF v_issue IS NULL OR jsonb_typeof(v_issue) <> 'object' THEN
          RAISE EXCEPTION 'invalid_scope_payload' USING ERRCODE = '22023';
        END IF;
        IF nullif(trim(coalesce(v_issue ->> 'description', '')), '') IS NULL THEN
          RAISE EXCEPTION 'invalid_scope_payload' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.scope_analysis_issues (
          room_id,
          description,
          severity,
          category,
          recommended_action,
          display_order
        ) VALUES (
          v_room_id,
          left(trim(v_issue ->> 'description'), 2000),
          nullif(trim(coalesce(v_issue ->> 'severity', '')), ''),
          nullif(trim(coalesce(v_issue ->> 'category', '')), ''),
          nullif(trim(coalesce(v_issue ->> 'recommended_action', '')), ''),
          v_j
        );
      END LOOP;
    END IF;

    IF jsonb_typeof(v_room -> 'recommended_items') = 'array' THEN
      v_items_len := jsonb_array_length(v_room -> 'recommended_items');
      FOR v_j IN 0 .. (v_items_len - 1) LOOP
        v_item := v_room -> 'recommended_items' -> v_j;
        IF v_item IS NULL OR jsonb_typeof(v_item) <> 'object' THEN
          RAISE EXCEPTION 'invalid_scope_payload' USING ERRCODE = '22023';
        END IF;
        IF nullif(trim(coalesce(v_item ->> 'name', '')), '') IS NULL THEN
          RAISE EXCEPTION 'invalid_scope_payload' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.scope_analysis_items (
          room_id,
          name,
          category,
          quantity,
          unit,
          base_unit_cost,
          notes,
          display_order
        ) VALUES (
          v_room_id,
          left(trim(v_item ->> 'name'), 200),
          nullif(trim(coalesce(v_item ->> 'category', '')), ''),
          coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1),
          nullif(trim(coalesce(v_item ->> 'unit', '')), ''),
          coalesce(nullif(v_item ->> 'base_unit_cost', '')::numeric, 0),
          nullif(trim(coalesce(v_item ->> 'notes', '')), ''),
          v_j
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_header;
END;
$$;

COMMENT ON FUNCTION public.save_project_scope_analysis(uuid, numeric, text, text, text, jsonb) IS
  'IA-5-R1/R2: Scope publication with server-derived provenance; clock_timestamp for revision ordering.';

REVOKE ALL ON FUNCTION public.save_project_scope_analysis(uuid, numeric, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_project_scope_analysis(uuid, numeric, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_project_scope_analysis(uuid, numeric, text, text, text, jsonb) TO authenticated;
