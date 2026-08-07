-- P0-PHOTO-ANALYZE-R2 — Atomic replacement of project room_analyses authority.
-- SECURITY INVOKER: operates under caller RLS (auth.uid() = user_id on owned rows).
-- Does not apply to production in this phase; file is for local/preview/test only until release.

CREATE OR REPLACE FUNCTION public.replace_project_room_analyses(
  p_project_id uuid,
  p_analyses jsonb
)
RETURNS SETOF public.room_analyses
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_len int;
  v_i int;
  v_elem jsonb;
  v_photo_id uuid;
  v_source text;
  v_room_type text;
  v_condition text;
  v_refurb text;
  v_issues jsonb;
  v_works jsonb;
  v_summary text;
  v_confidence real;
  v_photo_ids uuid[] := ARRAY[]::uuid[];
  v_photo_count int;
  v_seen uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Serialize competing replacements for this project under the owner.
  SELECT p.id
  INTO v_project_id
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.user_id = v_uid
  FOR UPDATE;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'project_not_authorised' USING ERRCODE = '42501';
  END IF;

  IF p_analyses IS NULL OR jsonb_typeof(p_analyses) <> 'array' THEN
    RAISE EXCEPTION 'invalid_analyses_payload' USING ERRCODE = '22023';
  END IF;

  v_len := jsonb_array_length(p_analyses);
  IF v_len < 1 THEN
    RAISE EXCEPTION 'invalid_analyses_payload' USING ERRCODE = '22023';
  END IF;

  -- Validate payload + collect photo_ids (no mock; unique photo_id required).
  FOR v_i IN 0 .. (v_len - 1) LOOP
    v_elem := p_analyses -> v_i;
    IF v_elem IS NULL OR jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'invalid_analyses_payload' USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_photo_id := (v_elem ->> 'photo_id')::uuid;
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION 'invalid_photo_id' USING ERRCODE = '22023';
    END;

    IF v_photo_id IS NULL THEN
      RAISE EXCEPTION 'invalid_photo_id' USING ERRCODE = '22023';
    END IF;

    IF v_photo_id = ANY (v_seen) THEN
      RAISE EXCEPTION 'duplicate_photo_id' USING ERRCODE = '22023';
    END IF;
    v_seen := array_append(v_seen, v_photo_id);
    v_photo_ids := array_append(v_photo_ids, v_photo_id);

    v_source := coalesce(v_elem ->> 'source', '');
    IF v_source = 'mock' OR v_source NOT IN ('ai', 'fallback', 'persisted') THEN
      RAISE EXCEPTION 'mock_or_invalid_source' USING ERRCODE = '22023';
    END IF;

    v_room_type := coalesce(v_elem ->> 'room_type', '');
    v_condition := coalesce(v_elem ->> 'condition_level', '');
    v_refurb := coalesce(v_elem ->> 'refurbishment_level', '');
    IF v_room_type = '' OR v_condition = '' OR v_refurb = '' THEN
      RAISE EXCEPTION 'invalid_analyses_payload' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Every photo_id must exist on this project for the authenticated owner.
  SELECT count(*)::int
  INTO v_photo_count
  FROM public.photos ph
  WHERE ph.project_id = p_project_id
    AND ph.user_id = v_uid
    AND ph.id = ANY (v_photo_ids);

  IF v_photo_count <> array_length(v_photo_ids, 1) THEN
    RAISE EXCEPTION 'source_not_authorised' USING ERRCODE = '42501';
  END IF;

  -- Atomic replace: delete previous project rows then insert complete set.
  DELETE FROM public.room_analyses ra
  WHERE ra.project_id = p_project_id
    AND ra.user_id = v_uid;

  FOR v_i IN 0 .. (v_len - 1) LOOP
    v_elem := p_analyses -> v_i;
    v_photo_id := (v_elem ->> 'photo_id')::uuid;
    v_source := v_elem ->> 'source';
    v_room_type := v_elem ->> 'room_type';
    v_condition := v_elem ->> 'condition_level';
    v_refurb := v_elem ->> 'refurbishment_level';
    v_issues := coalesce(v_elem -> 'visible_issues', '[]'::jsonb);
    v_works := coalesce(v_elem -> 'recommended_works', '[]'::jsonb);
    v_summary := coalesce(v_elem ->> 'ai_summary', '');
    BEGIN
      v_confidence := coalesce((v_elem ->> 'confidence_score')::real, 0);
    EXCEPTION
      WHEN others THEN
        v_confidence := 0;
    END;

    -- Durable URL/name come from canonical photos row (not client payload).
    INSERT INTO public.room_analyses (
      project_id,
      user_id,
      photo_id,
      photo_url,
      photo_name,
      room_type,
      condition_level,
      refurbishment_level,
      visible_issues,
      recommended_works,
      ai_summary,
      confidence_score,
      source
    )
    SELECT
      p_project_id,
      v_uid,
      v_photo_id,
      ph.url,
      ph.name,
      v_room_type,
      v_condition,
      v_refurb,
      v_issues,
      v_works,
      v_summary,
      v_confidence,
      v_source
    FROM public.photos ph
    WHERE ph.id = v_photo_id
      AND ph.project_id = p_project_id
      AND ph.user_id = v_uid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'source_not_authorised' USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT ra.*
  FROM public.room_analyses ra
  WHERE ra.project_id = p_project_id
    AND ra.user_id = v_uid
  ORDER BY ra.created_at ASC;
END;
$$;

COMMENT ON FUNCTION public.replace_project_room_analyses(uuid, jsonb) IS
  'Atomic project room_analyses replacement (SECURITY INVOKER). Validates photo ownership, rejects mock, persists photo_id.';

REVOKE ALL ON FUNCTION public.replace_project_room_analyses(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_project_room_analyses(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_project_room_analyses(uuid, jsonb) TO authenticated;
