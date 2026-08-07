-- IA-4-R2 — Redesign authority write-path seal.
-- Unapplied to production until IA-4-M.
--
-- Threat (proven on verification DB under role authenticated + JWT sub):
--   Direct UPDATE is_selected / analysis_identity succeeded (bypass open).
--   Unique index alone does not stop clearing authority or forging identity.
--
-- Seal (photos-pattern):
--   1. Canonical mutations via SECURITY DEFINER RPCs with explicit ownership.
--   2. REVOKE INSERT/UPDATE/DELETE/TRUNCATE on redesign_concepts from
--      authenticated/anon/PUBLIC so ordinary clients cannot bypass.
--   3. Authenticated retains SELECT under existing RLS.
--
-- Does NOT edit 20260807220000_ia4_atomic_redesign_selection.sql.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Atomic selection RPC — promote to SECURITY DEFINER (post-DML seal)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.select_project_redesign_concept(
  p_project_id uuid,
  p_concept_id uuid
)
RETURNS public.redesign_concepts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_row public.redesign_concepts;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_project_id IS NULL OR p_concept_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  -- Serialize selection per project (same pattern as Analysis publish / photo seal).
  SELECT p.id
  INTO v_project_id
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.user_id = v_uid
  FOR UPDATE;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'project_not_authorised' USING ERRCODE = '42501';
  END IF;

  -- Target must belong to this project and user.
  SELECT *
  INTO v_row
  FROM public.redesign_concepts rc
  WHERE rc.id = p_concept_id
    AND rc.project_id = p_project_id
    AND rc.user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'redesign_concept_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Clear any other selected rows for this project (under project lock).
  UPDATE public.redesign_concepts
  SET
    is_selected = false,
    updated_at = now()
  WHERE project_id = p_project_id
    AND user_id = v_uid
    AND is_selected = true
    AND id <> p_concept_id;

  -- Set sole selected authority.
  UPDATE public.redesign_concepts
  SET
    is_selected = true,
    updated_at = now()
  WHERE id = p_concept_id
    AND project_id = p_project_id
    AND user_id = v_uid
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'redesign_selection_failed' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.select_project_redesign_concept(uuid, uuid) IS
  'IA-4-R2: atomic single selected Redesign per project. SECURITY DEFINER + fixed search_path; auth.uid ownership; projects FOR UPDATE; sole write path for is_selected.';

REVOKE ALL ON FUNCTION public.select_project_redesign_concept(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.select_project_redesign_concept(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.select_project_redesign_concept(uuid, uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Candidate replace RPC — sole path for generation INSERT/DELETE
--    analysis_identity is derived server-side from durable room_analyses.
--    New rows always is_selected = false. Never accepts client authority flags.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.replace_project_redesign_candidates(
  p_project_id uuid,
  p_concepts jsonb
)
RETURNS SETOF public.redesign_concepts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_identity text;
  v_preserved_id uuid;
  v_preserved_style text;
  v_len int;
  v_i int;
  v_elem jsonb;
  v_title text;
  v_description text;
  v_style text;
  v_image_url text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  IF p_concepts IS NULL OR jsonb_typeof(p_concepts) <> 'array' THEN
    RAISE EXCEPTION 'invalid_concepts_payload' USING ERRCODE = '22023';
  END IF;

  -- Serialize with selection / catalogue mutations.
  SELECT p.id
  INTO v_project_id
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.user_id = v_uid
  FOR UPDATE;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'project_not_authorised' USING ERRCODE = '42501';
  END IF;

  -- Server-derived Analysis identity (sorted durable photo_ids). Client cannot forge.
  SELECT coalesce(
    string_agg(ra.photo_id::text, E'\x01' ORDER BY ra.photo_id::text),
    ''
  )
  INTO v_identity
  FROM public.room_analyses ra
  WHERE ra.project_id = p_project_id
    AND ra.user_id = v_uid
    AND ra.photo_id IS NOT NULL
    AND coalesce(ra.source, '') <> 'mock';

  IF v_identity IS NULL OR v_identity = '' THEN
    RAISE EXCEPTION 'redesign_requires_analysis_identity' USING ERRCODE = '22023';
  END IF;

  -- Preserve selected row when bound to the same Analysis identity.
  SELECT rc.id, rc.style
  INTO v_preserved_id, v_preserved_style
  FROM public.redesign_concepts rc
  WHERE rc.project_id = p_project_id
    AND rc.user_id = v_uid
    AND rc.is_selected = true
    AND rc.analysis_identity = v_identity
  FOR UPDATE;

  IF v_preserved_id IS NOT NULL THEN
    DELETE FROM public.redesign_concepts rc
    WHERE rc.project_id = p_project_id
      AND rc.user_id = v_uid
      AND rc.id <> v_preserved_id;
  ELSE
    DELETE FROM public.redesign_concepts rc
    WHERE rc.project_id = p_project_id
      AND rc.user_id = v_uid;
  END IF;

  v_len := jsonb_array_length(p_concepts);
  FOR v_i IN 0 .. (v_len - 1) LOOP
    v_elem := p_concepts -> v_i;
    IF v_elem IS NULL OR jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'invalid_concepts_payload' USING ERRCODE = '22023';
    END IF;

    v_style := nullif(trim(coalesce(v_elem ->> 'style', '')), '');
    v_title := nullif(trim(coalesce(v_elem ->> 'title', '')), '');
    v_description := v_elem ->> 'description';
    v_image_url := nullif(trim(coalesce(v_elem ->> 'image_url', '')), '');

    IF v_style IS NULL THEN
      RAISE EXCEPTION 'invalid_concepts_payload' USING ERRCODE = '22023';
    END IF;

    -- Skip duplicate style when preserving selected authority.
    IF v_preserved_id IS NOT NULL AND v_preserved_style IS NOT NULL AND v_style = v_preserved_style THEN
      CONTINUE;
    END IF;

    IF v_title IS NULL THEN
      v_title := left(v_style, 200);
    END IF;

    -- Force non-selected. analysis_identity from derived identity only.
    INSERT INTO public.redesign_concepts (
      project_id,
      user_id,
      title,
      description,
      style,
      image_url,
      analysis_identity,
      is_selected
    )
    VALUES (
      p_project_id,
      v_uid,
      left(v_title, 200),
      v_description,
      v_style,
      v_image_url,
      v_identity,
      false
    );
  END LOOP;

  RETURN QUERY
  SELECT rc.*
  FROM public.redesign_concepts rc
  WHERE rc.project_id = p_project_id
    AND rc.user_id = v_uid
  ORDER BY rc.created_at ASC;
END;
$$;

COMMENT ON FUNCTION public.replace_project_redesign_candidates(uuid, jsonb) IS
  'IA-4-R2: replace Redesign candidates. SECURITY DEFINER; derives analysis_identity from room_analyses; forces is_selected=false; preserves selected same-identity row.';

REVOKE ALL ON FUNCTION public.replace_project_redesign_candidates(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_project_redesign_candidates(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_project_redesign_candidates(uuid, jsonb) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Seal authenticated / anon direct DML on redesign_concepts
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop broad FOR ALL policy if present (legacy); keep explicit SELECT policies.
DROP POLICY IF EXISTS "redesign_all_own" ON public.redesign_concepts;

-- INSERT/UPDATE/DELETE policies become unreachable once privileges are revoked;
-- drop them so the surface documents SELECT-only for authenticated clients.
DROP POLICY IF EXISTS "Users can create own redesign concepts" ON public.redesign_concepts;
DROP POLICY IF EXISTS "Users can update own redesign concepts" ON public.redesign_concepts;
DROP POLICY IF EXISTS "Users can delete own redesign concepts" ON public.redesign_concepts;

-- Ensure SELECT policy remains for owners (+ admin if already present).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'redesign_concepts'
      AND policyname = 'redesign_concepts_select_authenticated'
  ) THEN
    CREATE POLICY "redesign_concepts_select_authenticated"
      ON public.redesign_concepts
      FOR SELECT
      TO authenticated
      USING (is_admin() OR (user_id = (SELECT auth.uid())));
  END IF;
END;
$$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.redesign_concepts FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.redesign_concepts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.redesign_concepts FROM authenticated;

-- Authenticated retains SELECT (and REFERENCES/TRIGGER if previously granted).
GRANT SELECT ON TABLE public.redesign_concepts TO authenticated;

-- service_role retains full access for admin/ops tooling.
GRANT ALL ON TABLE public.redesign_concepts TO service_role;
