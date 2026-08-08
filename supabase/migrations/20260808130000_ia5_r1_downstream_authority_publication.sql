-- IA-5-R1 — Downstream authority publication hardening.
-- Unapplied to production until IA-5-M.
--
-- BV blocking defects:
--   A. Scope provenance client-forged (analysis_identity / redesign_*)
--   B. Export snapshot client INSERT lacks estimate↔project + currentness
--   C. bind_estimate_input_scope binds any owned Scope, including stale S1
--
-- Does NOT edit 20260808120000_ia5_five_stage_continuity_provenance.sql.

-- ═══════════════════════════════════════════════════════════════════════════
-- Helpers: current Analysis identity + current selected Redesign (read)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ia5_derive_current_analysis_identity(
  p_project_id uuid,
  p_uid uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_catalogue_count int;
  v_analysis_count int;
  v_matched int;
  v_identity text;
BEGIN
  SELECT count(*)::int
  INTO v_catalogue_count
  FROM public.photos ph
  WHERE ph.project_id = p_project_id
    AND ph.user_id = p_uid;

  IF v_catalogue_count < 1 THEN
    RAISE EXCEPTION 'analysis_not_current' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::int
  INTO v_analysis_count
  FROM public.room_analyses ra
  WHERE ra.project_id = p_project_id
    AND ra.user_id = p_uid;

  IF v_analysis_count < 1 OR v_analysis_count <> v_catalogue_count THEN
    RAISE EXCEPTION 'analysis_not_current' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.room_analyses ra
    WHERE ra.project_id = p_project_id
      AND ra.user_id = p_uid
      AND (ra.photo_id IS NULL OR coalesce(ra.source, '') = 'mock')
  ) THEN
    RAISE EXCEPTION 'analysis_not_current' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(DISTINCT ra.photo_id)
    FROM public.room_analyses ra
    WHERE ra.project_id = p_project_id
      AND ra.user_id = p_uid
  ) <> v_analysis_count THEN
    RAISE EXCEPTION 'analysis_not_current' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::int
  INTO v_matched
  FROM public.room_analyses ra
  INNER JOIN public.photos ph
    ON ph.id = ra.photo_id
   AND ph.project_id = p_project_id
   AND ph.user_id = p_uid
  WHERE ra.project_id = p_project_id
    AND ra.user_id = p_uid;

  IF v_matched <> v_catalogue_count THEN
    RAISE EXCEPTION 'analysis_not_current' USING ERRCODE = '22023';
  END IF;

  SELECT string_agg(ra.photo_id::text, E'\x01' ORDER BY ra.photo_id::text)
  INTO v_identity
  FROM public.room_analyses ra
  WHERE ra.project_id = p_project_id
    AND ra.user_id = p_uid
    AND ra.photo_id IS NOT NULL
    AND coalesce(ra.source, '') <> 'mock';

  IF v_identity IS NULL OR v_identity = '' THEN
    RAISE EXCEPTION 'analysis_not_current' USING ERRCODE = '22023';
  END IF;

  RETURN v_identity;
END;
$$;

REVOKE ALL ON FUNCTION public.ia5_derive_current_analysis_identity(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ia5_derive_current_analysis_identity(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ia5_derive_current_analysis_identity(uuid, uuid) FROM authenticated;
-- Internal helper only (called by DEFINER RPCs).

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
  ORDER BY sa.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.ia5_resolve_current_scope_id(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ia5_resolve_current_scope_id(uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.ia5_resolve_current_scope_id(uuid, uuid, text, text) FROM authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- A. Canonical Scope publication (server-derived provenance)
-- ═══════════════════════════════════════════════════════════════════════════

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

  -- Serialize publication / redesign / analysis mutations for this project.
  SELECT p.id
  INTO v_project_id
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.user_id = v_uid
  FOR UPDATE;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'project_not_authorised' USING ERRCODE = '42501';
  END IF;

  -- Re-resolve current Analysis under project lock (TOCTOU barrier).
  v_analysis_identity := public.ia5_derive_current_analysis_identity(p_project_id, v_uid);

  -- Current selected Redesign must match Analysis identity.
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
    redesign_identity
  ) VALUES (
    v_uid,
    p_project_id,
    v_score,
    nullif(trim(coalesce(p_summary, '')), ''),
    nullif(trim(coalesce(p_region, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_analysis_identity,
    v_redesign_id,
    v_redesign_identity
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
  'IA-5-R1: canonical Scope publication. SECURITY DEFINER; server-derived analysis_identity + selected Redesign; transactional tree insert; project FOR UPDATE TOCTOU.';

REVOKE ALL ON FUNCTION public.save_project_scope_analysis(uuid, numeric, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_project_scope_analysis(uuid, numeric, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_project_scope_analysis(uuid, numeric, text, text, text, jsonb) TO authenticated;

-- Seal direct client DML on Scope tree (SELECT retained for reads).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.scope_analyses FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.scope_analysis_rooms FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.scope_analysis_issues FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.scope_analysis_items FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.scope_analyses TO authenticated;
GRANT SELECT ON public.scope_analysis_rooms TO authenticated;
GRANT SELECT ON public.scope_analysis_issues TO authenticated;
GRANT SELECT ON public.scope_analysis_items TO authenticated;

ALTER TABLE public.scope_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scope_analysis_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scope_analysis_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scope_analysis_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scope_analyses_select_own" ON public.scope_analyses;
CREATE POLICY "scope_analyses_select_own"
  ON public.scope_analyses
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "scope_analysis_rooms_select_own" ON public.scope_analysis_rooms;
CREATE POLICY "scope_analysis_rooms_select_own"
  ON public.scope_analysis_rooms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scope_analyses sa
      WHERE sa.id = scope_analysis_rooms.scope_analysis_id
        AND sa.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "scope_analysis_issues_select_own" ON public.scope_analysis_issues;
CREATE POLICY "scope_analysis_issues_select_own"
  ON public.scope_analysis_issues
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.scope_analysis_rooms sr
      JOIN public.scope_analyses sa ON sa.id = sr.scope_analysis_id
      WHERE sr.id = scope_analysis_issues.room_id
        AND sa.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "scope_analysis_items_select_own" ON public.scope_analysis_items;
CREATE POLICY "scope_analysis_items_select_own"
  ON public.scope_analysis_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.scope_analysis_rooms sr
      JOIN public.scope_analyses sa ON sa.id = sr.scope_analysis_id
      WHERE sr.id = scope_analysis_items.room_id
        AND sa.user_id = (SELECT auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- C. Estimate bind requires CURRENT Scope (replace prior ownership-only RPC)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bind_estimate_input_scope(
  p_estimate_id uuid,
  p_scope_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_owner uuid;
  v_analysis_identity text;
  v_redesign_id uuid;
  v_redesign_identity text;
  v_current_scope_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_estimate_id IS NULL OR p_scope_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT e.project_id, e.user_id
  INTO v_project_id, v_owner
  FROM public.estimates e
  WHERE e.id = p_estimate_id
  FOR UPDATE;

  IF v_project_id IS NULL OR v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'estimate_not_authorised' USING ERRCODE = '42501';
  END IF;

  -- Lock project for currentness resolution.
  SELECT p.id
  INTO v_project_id
  FROM public.projects p
  WHERE p.id = v_project_id
    AND p.user_id = v_uid
  FOR UPDATE;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'project_not_authorised' USING ERRCODE = '42501';
  END IF;

  -- Resolve CURRENT Analysis + selected Redesign under lock.
  v_analysis_identity := public.ia5_derive_current_analysis_identity(v_project_id, v_uid);

  SELECT rc.id
  INTO v_redesign_id
  FROM public.redesign_concepts rc
  WHERE rc.project_id = v_project_id
    AND rc.user_id = v_uid
    AND rc.is_selected = true
    AND rc.analysis_identity = v_analysis_identity;

  IF v_redesign_id IS NULL THEN
    RAISE EXCEPTION 'redesign_not_current' USING ERRCODE = '22023';
  END IF;

  v_redesign_identity := v_redesign_id::text;

  v_current_scope_id := public.ia5_resolve_current_scope_id(
    v_project_id,
    v_uid,
    v_analysis_identity,
    v_redesign_identity
  );

  IF v_current_scope_id IS NULL THEN
    RAISE EXCEPTION 'scope_not_current' USING ERRCODE = '22023';
  END IF;

  IF p_scope_id IS DISTINCT FROM v_current_scope_id THEN
    RAISE EXCEPTION 'stale_scope' USING ERRCODE = '22023';
  END IF;

  -- Confirm supplied scope row is owned + same project (defense in depth).
  IF NOT EXISTS (
    SELECT 1
    FROM public.scope_analyses s
    WHERE s.id = p_scope_id
      AND s.user_id = v_uid
      AND s.property_id = v_project_id
  ) THEN
    RAISE EXCEPTION 'scope_not_authorised' USING ERRCODE = '42501';
  END IF;

  UPDATE public.estimates
  SET input_scope_id = p_scope_id,
      updated_at = now()
  WHERE id = p_estimate_id
    AND user_id = v_uid;
END;
$$;

COMMENT ON FUNCTION public.bind_estimate_input_scope(uuid, uuid) IS
  'IA-5-R1: bind Estimate to CURRENT Scope only. SECURITY DEFINER; project lock; rejects stale same-project Scope.';

REVOKE ALL ON FUNCTION public.bind_estimate_input_scope(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bind_estimate_input_scope(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.bind_estimate_input_scope(uuid, uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- B. Canonical Export snapshot publication
-- ═══════════════════════════════════════════════════════════════════════════

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

  -- Current Estimate = latest durable row for this project/user.
  -- Tie-break on id for same-transaction created_at collisions.
  SELECT e.id
  INTO v_current_estimate_id
  FROM public.estimates e
  WHERE e.project_id = p_project_id
    AND e.user_id = v_uid
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_current_estimate_id IS NULL THEN
    RAISE EXCEPTION 'estimate_not_current' USING ERRCODE = '22023';
  END IF;

  IF p_estimate_id IS DISTINCT FROM v_current_estimate_id THEN
    RAISE EXCEPTION 'stale_estimate' USING ERRCODE = '22023';
  END IF;

  SELECT e.id, e.project_id, e.user_id
  INTO v_estimate_id, v_estimate_project, v_estimate_owner
  FROM public.estimates e
  WHERE e.id = p_estimate_id
  FOR UPDATE;

  IF v_estimate_id IS NULL OR v_estimate_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'estimate_not_authorised' USING ERRCODE = '42501';
  END IF;

  IF v_estimate_project IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'estimate_project_mismatch' USING ERRCODE = '42501';
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
  'IA-5-R1: canonical Export snapshot publish. SECURITY DEFINER; project lock; requires current Estimate + same project; sole INSERT path.';

REVOKE ALL ON FUNCTION public.publish_project_export_snapshot(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_project_export_snapshot(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.publish_project_export_snapshot(uuid, uuid, text) TO authenticated;

-- Seal direct INSERT on export snapshots (SELECT retained).
DROP POLICY IF EXISTS "project_export_snapshots_insert_own" ON public.project_export_snapshots;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.project_export_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.project_export_snapshots TO authenticated;

-- Keep SELECT policy; no INSERT policy for authenticated.
DROP POLICY IF EXISTS "project_export_snapshots_select_own" ON public.project_export_snapshots;
CREATE POLICY "project_export_snapshots_select_own"
  ON public.project_export_snapshots
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
