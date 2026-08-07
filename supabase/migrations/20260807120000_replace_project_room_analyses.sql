-- P0-PHOTO-ANALYZE R2/R3/R4 — Project catalogue serialization + analysis authority.
-- Unapplied to production (history remains 40). Amended in-place on PR #110 only.
--
-- R4 contract:
--   CATALOGUE MUTATION  → projects row FOR UPDATE
--   ANALYSIS REPLACEMENT → projects row FOR UPDATE
--   AUTHORITY READ      → projects row FOR SHARE
-- Photo metadata INSERT/DELETE go through hardened SECURITY DEFINER RPCs so
-- authenticated direct DML can be sealed without bypassing ownership checks.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Atomic room_analyses replacement (SECURITY INVOKER)
-- ═══════════════════════════════════════════════════════════════════════════

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
  v_seen uuid[] := ARRAY[]::uuid[];
  v_catalogue_ids uuid[];
  v_catalogue_count int;
  v_payload_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Project-row exclusive lock: serializes vs photo metadata mutations.
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

  -- Catalogue snapshot under project FOR UPDATE (primary serialization).
  -- Do not FOR SHARE photo rows: authenticated has SELECT-only after DML seal.
  SELECT coalesce(array_agg(ph.id ORDER BY ph.id), ARRAY[]::uuid[])
  INTO v_catalogue_ids
  FROM public.photos ph
  WHERE ph.project_id = p_project_id
    AND ph.user_id = v_uid;

  v_catalogue_count := coalesce(array_length(v_catalogue_ids, 1), 0);
  IF v_catalogue_count < 1 THEN
    RAISE EXCEPTION 'empty_photo_catalogue' USING ERRCODE = '22023';
  END IF;

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
    IF v_source NOT IN ('ai', 'fallback') THEN
      RAISE EXCEPTION 'mock_or_invalid_source' USING ERRCODE = '22023';
    END IF;

    v_room_type := coalesce(v_elem ->> 'room_type', '');
    v_condition := coalesce(v_elem ->> 'condition_level', '');
    v_refurb := coalesce(v_elem ->> 'refurbishment_level', '');
    IF v_room_type = '' OR v_condition = '' OR v_refurb = '' THEN
      RAISE EXCEPTION 'invalid_analyses_payload' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  v_payload_count := array_length(v_photo_ids, 1);

  IF v_payload_count <> v_catalogue_count THEN
    RAISE EXCEPTION 'incomplete_photo_catalogue' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_photo_ids) AS pid(id)
    WHERE NOT (pid.id = ANY (v_catalogue_ids))
  ) THEN
    RAISE EXCEPTION 'source_not_authorised' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_catalogue_ids) AS cid(id)
    WHERE NOT (cid.id = ANY (v_photo_ids))
  ) THEN
    RAISE EXCEPTION 'incomplete_photo_catalogue' USING ERRCODE = '22023';
  END IF;

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
  'Atomic room_analyses replacement. Project FOR UPDATE serializes with photo catalogue mutations. Complete catalogue required.';

REVOKE ALL ON FUNCTION public.replace_project_room_analyses(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_project_room_analyses(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_project_room_analyses(uuid, jsonb) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Photo metadata INSERT (SECURITY DEFINER — sealed direct DML)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_project_photo_metadata(
  p_project_id uuid,
  p_photo_id uuid,
  p_storage_path text,
  p_url text,
  p_name text,
  p_size integer
)
RETURNS public.photos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_row public.photos;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_project_id IS NULL OR p_photo_id IS NULL THEN
    RAISE EXCEPTION 'invalid_photo_metadata' USING ERRCODE = '22023';
  END IF;

  IF coalesce(trim(p_storage_path), '') = ''
     OR coalesce(trim(p_url), '') = ''
     OR coalesce(trim(p_name), '') = ''
     OR p_size IS NULL
     OR p_size < 0 THEN
    RAISE EXCEPTION 'invalid_photo_metadata' USING ERRCODE = '22023';
  END IF;

  -- Serialize vs analysis replacement / concurrent catalogue mutations.
  SELECT p.id
  INTO v_project_id
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.user_id = v_uid
  FOR UPDATE;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'project_not_authorised' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.photos (
    id,
    project_id,
    user_id,
    storage_path,
    url,
    name,
    size
  )
  VALUES (
    p_photo_id,
    p_project_id,
    v_uid,
    p_storage_path,
    p_url,
    p_name,
    p_size
  )
  RETURNING * INTO v_row;

  -- Catalogue changed → prior complete analysis is no longer current.
  UPDATE public.projects
  SET analysis_done = false
  WHERE id = p_project_id
    AND user_id = v_uid;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.create_project_photo_metadata(uuid, uuid, text, text, text, integer) IS
  'Serialize project photo metadata INSERT under projects FOR UPDATE; invalidates analysis_done.';

REVOKE ALL ON FUNCTION public.create_project_photo_metadata(uuid, uuid, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_project_photo_metadata(uuid, uuid, text, text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_project_photo_metadata(uuid, uuid, text, text, text, integer) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Photo metadata DELETE (SECURITY DEFINER — sealed direct DML)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.delete_project_photo_metadata(
  p_photo_id uuid
)
RETURNS TABLE (
  id uuid,
  storage_path text,
  project_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_owner uuid;
  v_storage_path text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_photo_id IS NULL THEN
    RAISE EXCEPTION 'invalid_photo_id' USING ERRCODE = '22023';
  END IF;

  -- Resolve ownership without leaking foreign existence details.
  SELECT ph.project_id, ph.user_id, ph.storage_path
  INTO v_project_id, v_owner, v_storage_path
  FROM public.photos ph
  WHERE ph.id = p_photo_id;

  IF v_project_id IS NULL OR v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'source_not_authorised' USING ERRCODE = '42501';
  END IF;

  -- Same project-row lock as insert / analysis replacement.
  PERFORM 1
  FROM public.projects p
  WHERE p.id = v_project_id
    AND p.user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_authorised' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.photos ph
  WHERE ph.id = p_photo_id
    AND ph.user_id = v_uid
    AND ph.project_id = v_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'source_not_authorised' USING ERRCODE = '42501';
  END IF;

  UPDATE public.projects
  SET analysis_done = false
  WHERE public.projects.id = v_project_id
    AND public.projects.user_id = v_uid;

  id := p_photo_id;
  storage_path := coalesce(v_storage_path, '');
  project_id := v_project_id;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.delete_project_photo_metadata(uuid) IS
  'Serialize project photo metadata DELETE under projects FOR UPDATE; invalidates analysis_done.';

REVOKE ALL ON FUNCTION public.delete_project_photo_metadata(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_project_photo_metadata(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_project_photo_metadata(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Atomic current analysis authority read (SECURITY INVOKER + FOR SHARE)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_current_project_analysis_authority(
  p_project_id uuid
)
RETURNS SETOF public.room_analyses
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_catalogue_count int;
  v_analysis_count int;
  v_matched int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Shared lock: blocks catalogue mutations / replacement until resolution completes.
  SELECT p.id
  INTO v_project_id
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.user_id = v_uid
  FOR SHARE;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'project_not_authorised' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::int
  INTO v_catalogue_count
  FROM public.photos ph
  WHERE ph.project_id = p_project_id
    AND ph.user_id = v_uid;

  IF v_catalogue_count < 1 THEN
    RAISE EXCEPTION 'stale_requires_reanalysis' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::int
  INTO v_analysis_count
  FROM public.room_analyses ra
  WHERE ra.project_id = p_project_id
    AND ra.user_id = v_uid;

  IF v_analysis_count < 1 OR v_analysis_count <> v_catalogue_count THEN
    RAISE EXCEPTION 'stale_requires_reanalysis' USING ERRCODE = '22023';
  END IF;

  -- Reject mock / null photo_id / non-unique photo_id.
  IF EXISTS (
    SELECT 1
    FROM public.room_analyses ra
    WHERE ra.project_id = p_project_id
      AND ra.user_id = v_uid
      AND (ra.photo_id IS NULL OR ra.source = 'mock')
  ) THEN
    RAISE EXCEPTION 'stale_requires_reanalysis' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(DISTINCT ra.photo_id)
    FROM public.room_analyses ra
    WHERE ra.project_id = p_project_id
      AND ra.user_id = v_uid
  ) <> v_analysis_count THEN
    RAISE EXCEPTION 'stale_requires_reanalysis' USING ERRCODE = '22023';
  END IF;

  -- Exact set equality + canonical URL/name correspondence.
  SELECT count(*)::int
  INTO v_matched
  FROM public.room_analyses ra
  INNER JOIN public.photos ph
    ON ph.id = ra.photo_id
   AND ph.project_id = p_project_id
   AND ph.user_id = v_uid
   AND ph.url = ra.photo_url
   AND ph.name = ra.photo_name
  WHERE ra.project_id = p_project_id
    AND ra.user_id = v_uid;

  IF v_matched <> v_catalogue_count THEN
    RAISE EXCEPTION 'stale_requires_reanalysis' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT ra.*
  FROM public.room_analyses ra
  WHERE ra.project_id = p_project_id
    AND ra.user_id = v_uid
  ORDER BY ra.created_at ASC;
END;
$$;

COMMENT ON FUNCTION public.get_current_project_analysis_authority(uuid) IS
  'Atomic current analysis authority under projects FOR SHARE. Raises when stale/incomplete/mock.';

REVOKE ALL ON FUNCTION public.get_current_project_analysis_authority(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_project_analysis_authority(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_project_analysis_authority(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Seal authenticated direct DML on public.photos
--    Mutations only via create/delete RPCs (SECURITY DEFINER).
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "photos_all_own" ON public.photos;

CREATE POLICY "photos_select_own"
  ON public.photos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- photos_select_admin already exists for admin read.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.photos FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.photos FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.photos FROM authenticated;

-- Authenticated retains SELECT under RLS policies above.
GRANT SELECT ON TABLE public.photos TO authenticated;
