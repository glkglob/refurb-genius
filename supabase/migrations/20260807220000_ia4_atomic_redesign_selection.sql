-- IA-4-R1 — Atomic Redesign selection authority.
-- Unapplied to production until IA-4-M. Canonical columns + DB uniqueness + RPC.
--
-- Live redesign_concepts columns (pre-migration):
--   id, user_id, project_id, photo_id, title, description, style, image_url,
--   created_at, updated_at
--
-- Adds:
--   analysis_identity text  — durable Analysis catalogue fingerprint
--   is_selected boolean     — sole selected authority flag
-- Partial unique: at most one is_selected=true per project
-- RPC: select_project_redesign_concept (project FOR UPDATE + single-transaction select)

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Canonical authority columns
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.redesign_concepts
  ADD COLUMN IF NOT EXISTS analysis_identity text NOT NULL DEFAULT '';

ALTER TABLE public.redesign_concepts
  ADD COLUMN IF NOT EXISTS is_selected boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.redesign_concepts.analysis_identity IS
  'IA-4: durable photo-catalogue identity at generation/selection; empty for legacy rows.';

COMMENT ON COLUMN public.redesign_concepts.is_selected IS
  'IA-4: exactly one selected Redesign per project (partial unique index).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Backfill from IA-4 description JSON (safe fail-closed)
-- ═══════════════════════════════════════════════════════════════════════════

-- Safe JSON backfill (plain-text / malformed descriptions skipped)
DO $$
DECLARE
  r record;
  j jsonb;
  v_identity text;
  v_selected boolean;
BEGIN
  FOR r IN
    SELECT id, description
    FROM public.redesign_concepts
    WHERE description IS NOT NULL
      AND left(trim(description), 1) = '{'
  LOOP
    BEGIN
      j := r.description::jsonb;
    EXCEPTION
      WHEN others THEN
        CONTINUE;
    END;

    v_identity := coalesce(nullif(trim(j ->> 'analysisIdentity'), ''), '');
    v_selected := (j ->> 'isSelected') = 'true' AND v_identity <> '';

    UPDATE public.redesign_concepts
    SET
      analysis_identity = CASE
        WHEN analysis_identity = '' AND v_identity <> '' THEN v_identity
        ELSE analysis_identity
      END,
      is_selected = CASE
        WHEN is_selected = false AND v_selected THEN true
        ELSE is_selected
      END
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- If multiple selected per project after backfill, keep newest only (deterministic)
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY project_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.redesign_concepts
  WHERE is_selected = true
)
UPDATE public.redesign_concepts rc
SET is_selected = false
FROM ranked r
WHERE rc.id = r.id
  AND r.rn > 1;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Database uniqueness: at most one selected per project
-- ═══════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS redesign_concepts_one_selected_per_project
  ON public.redesign_concepts (project_id)
  WHERE is_selected = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Atomic selection RPC (SECURITY INVOKER + project FOR UPDATE)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.select_project_redesign_concept(
  p_project_id uuid,
  p_concept_id uuid
)
RETURNS public.redesign_concepts
LANGUAGE plpgsql
SECURITY INVOKER
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

  -- Serialize selection per project (same pattern as Analysis publish).
  SELECT p.id
  INTO v_project_id
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.user_id = v_uid
  FOR UPDATE;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'project_not_authorised' USING ERRCODE = '42501';
  END IF;

  -- Target must belong to this project and user (RLS still applies; explicit check).
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
  'IA-4-R1: atomic single selected Redesign per project. Locks projects row FOR UPDATE; clears prior selection; sets target. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.select_project_redesign_concept(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_project_redesign_concept(uuid, uuid) TO authenticated;

-- Optional helper: clear selection (not required for IA-4-R1 happy path)
-- Intentionally omitted to keep surface minimal.
