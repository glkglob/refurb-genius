-- AP-R1 — Room analysis persistence schema baseline reconciliation.
--
-- Evidence:
--   - CREATE (20260523000000) defined visible_issues/recommended_works as jsonb.
--   - Production live schema is text[] (uncaptured historical transition).
--   - 20260807144000 rewrote replace_project_room_analyses to write text[] but
--     did not alter the columns, so clean resets stay jsonb + text[] RPC → fail.
--
-- Canonical contract (production + RPC + domain string[]):
--   room_analyses.visible_issues      text[] NOT NULL DEFAULT ARRAY[]::text[]
--   room_analyses.recommended_works   text[] NOT NULL DEFAULT ARRAY[]::text[]
--
-- Idempotent: no-op when columns are already text[] (production).
-- Does NOT rewrite 20260807144000 or other applied history.
-- Does NOT change IA-3/IA-4 Analysis authority semantics.

-- ---------------------------------------------------------------------------
-- 1) Column type reconciliation (jsonb → text[] of strings only)
-- ---------------------------------------------------------------------------
-- Helper used only inside the USING clause (Postgres forbids bare subqueries there).
CREATE OR REPLACE FUNCTION public.ap_r1_jsonb_string_array_to_text(p_value jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN ARRAY[]::text[]
    WHEN jsonb_typeof(p_value) <> 'array' THEN NULL
    ELSE coalesce(
      (
        SELECT array_agg(x.value ORDER BY x.ord)
        FROM jsonb_array_elements_text(p_value) WITH ORDINALITY AS x(value, ord)
      ),
      ARRAY[]::text[]
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.ap_r1_jsonb_string_array_to_text(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ap_r1_jsonb_string_array_to_text(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.ap_r1_jsonb_string_array_to_text(jsonb) FROM authenticated;

DO $$
DECLARE
  v_issues_udt text;
  v_works_udt text;
  v_bad int;
BEGIN
  SELECT c.udt_name
  INTO v_issues_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'room_analyses'
    AND c.column_name = 'visible_issues';

  SELECT c.udt_name
  INTO v_works_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'room_analyses'
    AND c.column_name = 'recommended_works';

  IF v_issues_udt IS NULL OR v_works_udt IS NULL THEN
    RAISE EXCEPTION 'room_analyses visible_issues/recommended_works missing';
  END IF;

  -- Already canonical (production / previously reconciled).
  IF v_issues_udt = '_text' AND v_works_udt = '_text' THEN
    ALTER TABLE public.room_analyses
      ALTER COLUMN visible_issues SET DEFAULT ARRAY[]::text[],
      ALTER COLUMN recommended_works SET DEFAULT ARRAY[]::text[];
    RETURN;
  END IF;

  IF v_issues_udt <> 'jsonb' OR v_works_udt <> 'jsonb' THEN
    RAISE EXCEPTION
      'room_analyses array columns unexpected types: visible_issues=%, recommended_works=%',
      v_issues_udt, v_works_udt;
  END IF;

  -- Reject non-array or non-string-array jsonb before conversion.
  SELECT count(*)
  INTO v_bad
  FROM public.room_analyses ra
  WHERE jsonb_typeof(ra.visible_issues) IS DISTINCT FROM 'array'
     OR jsonb_typeof(ra.recommended_works) IS DISTINCT FROM 'array'
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(ra.visible_issues) e(val)
       WHERE jsonb_typeof(e.val) <> 'string'
     )
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(ra.recommended_works) e(val)
       WHERE jsonb_typeof(e.val) <> 'string'
     );

  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'room_analyses has % row(s) with non-string-array visible_issues/recommended_works; refusing unsafe conversion',
      v_bad;
  END IF;

  ALTER TABLE public.room_analyses
    ALTER COLUMN visible_issues DROP DEFAULT,
    ALTER COLUMN recommended_works DROP DEFAULT;

  ALTER TABLE public.room_analyses
    ALTER COLUMN visible_issues TYPE text[]
      USING public.ap_r1_jsonb_string_array_to_text(visible_issues),
    ALTER COLUMN recommended_works TYPE text[]
      USING public.ap_r1_jsonb_string_array_to_text(recommended_works);

  ALTER TABLE public.room_analyses
    ALTER COLUMN visible_issues SET DEFAULT ARRAY[]::text[],
    ALTER COLUMN recommended_works SET DEFAULT ARRAY[]::text[],
    ALTER COLUMN visible_issues SET NOT NULL,
    ALTER COLUMN recommended_works SET NOT NULL;
END;
$$;

DROP FUNCTION IF EXISTS public.ap_r1_jsonb_string_array_to_text(jsonb);

-- ---------------------------------------------------------------------------
-- 2) Reaffirm RPC (text[] writes) — same contract as 20260807144000
--    Ensures clean-reset function body matches canonical columns.
-- ---------------------------------------------------------------------------
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
  v_issues text[];
  v_works text[];
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

  v_payload_count := coalesce(array_length(v_photo_ids, 1), 0);
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

    IF jsonb_typeof(coalesce(v_elem -> 'visible_issues', '[]'::jsonb)) <> 'array'
       OR jsonb_typeof(coalesce(v_elem -> 'recommended_works', '[]'::jsonb)) <> 'array' THEN
      RAISE EXCEPTION 'invalid_analyses_payload' USING ERRCODE = '22023';
    END IF;

    -- Reject non-string elements (structured objects not part of contract).
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(v_elem -> 'visible_issues', '[]'::jsonb)) e(val)
      WHERE jsonb_typeof(e.val) <> 'string'
    ) OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(v_elem -> 'recommended_works', '[]'::jsonb)) e(val)
      WHERE jsonb_typeof(e.val) <> 'string'
    ) THEN
      RAISE EXCEPTION 'invalid_analyses_payload' USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(array_agg(x.value ORDER BY x.ord), ARRAY[]::text[])
    INTO v_issues
    FROM jsonb_array_elements_text(coalesce(v_elem -> 'visible_issues', '[]'::jsonb))
         WITH ORDINALITY AS x(value, ord);

    SELECT coalesce(array_agg(x.value ORDER BY x.ord), ARRAY[]::text[])
    INTO v_works
    FROM jsonb_array_elements_text(coalesce(v_elem -> 'recommended_works', '[]'::jsonb))
         WITH ORDINALITY AS x(value, ord);

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
  'Atomic room_analyses replacement. Project FOR UPDATE serializes with photo catalogue mutations. Complete catalogue required. Persists visible_issues/recommended_works as text[].';

REVOKE ALL ON FUNCTION public.replace_project_room_analyses(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_project_room_analyses(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_project_room_analyses(uuid, jsonb) TO authenticated;
