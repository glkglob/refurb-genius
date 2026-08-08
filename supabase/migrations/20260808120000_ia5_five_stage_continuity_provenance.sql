-- IA-5 — Full Five-Stage Continuity: minimum purpose-built provenance.
--
-- Canonical Scope = scope_analyses (rooms/issues/items). Not a sixth stage.
-- Estimate binds to scope revision via input_scope_id.
-- Export snapshot binds to estimate via project_export_snapshots.
--
-- Does NOT:
--   - invent a generic revision engine
--   - replay or rewrite historical migration bodies
--   - open dual Scope authority

-- ── 1. Scope provenance ────────────────────────────────────────────────────

ALTER TABLE public.scope_analyses
  ADD COLUMN IF NOT EXISTS analysis_identity text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS redesign_concept_id uuid NULL,
  ADD COLUMN IF NOT EXISTS redesign_identity text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.scope_analyses.analysis_identity IS
  'IA-5: durable Analysis catalogue identity (sorted photo_ids joined by U+0001) used when this Scope was reconciled.';
COMMENT ON COLUMN public.scope_analyses.redesign_concept_id IS
  'IA-5: selected redesign_concepts.id used when this Scope was reconciled (nullable for legacy rows).';
COMMENT ON COLUMN public.scope_analyses.redesign_identity IS
  'IA-5: stable string identity of selected Redesign (typically concept id) for currentness comparison.';

CREATE INDEX IF NOT EXISTS scope_analyses_property_created_idx
  ON public.scope_analyses (property_id, created_at DESC);

-- ── 2. Estimate → Scope binding ────────────────────────────────────────────

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS input_scope_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'estimates_input_scope_id_fkey'
      AND conrelid = 'public.estimates'::regclass
  ) THEN
    ALTER TABLE public.estimates
      ADD CONSTRAINT estimates_input_scope_id_fkey
      FOREIGN KEY (input_scope_id)
      REFERENCES public.scope_analyses(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.estimates.input_scope_id IS
  'IA-5: scope_analyses.id (Scope revision) this Estimate was built against.';

CREATE INDEX IF NOT EXISTS estimates_input_scope_id_idx
  ON public.estimates (input_scope_id)
  WHERE input_scope_id IS NOT NULL;

-- ── 3. Export snapshots (Estimate-bound; download alone is not Complete) ──

CREATE TABLE IF NOT EXISTS public.project_export_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'investor_report',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_export_snapshots IS
  'IA-5: durable Export/report generation evidence bound to an Estimate revision. Page view / download alone is not authority.';

CREATE INDEX IF NOT EXISTS project_export_snapshots_project_created_idx
  ON public.project_export_snapshots (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS project_export_snapshots_estimate_id_idx
  ON public.project_export_snapshots (estimate_id);

ALTER TABLE public.project_export_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_export_snapshots_select_own" ON public.project_export_snapshots;
CREATE POLICY "project_export_snapshots_select_own"
  ON public.project_export_snapshots
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "project_export_snapshots_insert_own" ON public.project_export_snapshots;
CREATE POLICY "project_export_snapshots_insert_own"
  ON public.project_export_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = (SELECT auth.uid())
    )
  );

-- No client UPDATE/DELETE — append-only snapshot evidence.
REVOKE UPDATE, DELETE ON public.project_export_snapshots FROM authenticated, anon;
GRANT SELECT, INSERT ON public.project_export_snapshots TO authenticated;
GRANT ALL ON public.project_export_snapshots TO service_role;

-- ── 4. Bind Estimate → Scope (authenticated, ownership-checked) ────────────
-- Authority estimates (pricing_authority ≠ none) are not client-updatable.
-- This SECURITY DEFINER path only stamps input_scope_id.

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = v_project_id
      AND p.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'project_not_authorised' USING ERRCODE = '42501';
  END IF;

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
  'IA-5: bind estimate.input_scope_id to a Scope revision. Owner-only; SECURITY DEFINER; fixed search_path.';

REVOKE ALL ON FUNCTION public.bind_estimate_input_scope(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bind_estimate_input_scope(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.bind_estimate_input_scope(uuid, uuid) TO authenticated;
