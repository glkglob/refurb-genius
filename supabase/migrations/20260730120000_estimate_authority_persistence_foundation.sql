-- Ticket 4C2B — Estimate authority persistence foundation
--
-- Adds pricing authority markers, browser write protection for canonical
-- estimates, a private durable-idempotency table, and a category-only
-- SECURITY DEFINER persistence RPC (service_role only).
--
-- Does NOT:
--   - backfill legacy rows as canonical
--   - create measured-BOQ persistence
--   - update projects.estimated_gdv
--   - grant authenticated users execute on the private RPC

-- ────────────────────────────────────────────────────────────────────
-- 1. Authority marker columns on estimates
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS pricing_authority text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS pricing_policy_version text NULL,
  ADD COLUMN IF NOT EXISTS catalog_revision text NULL;

-- Drop previous constraint if re-applied during local iteration
ALTER TABLE public.estimates
  DROP CONSTRAINT IF EXISTS estimates_pricing_authority_marker_check;

ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_pricing_authority_marker_check
  CHECK (
    (
      pricing_authority = 'none'
      AND pricing_policy_version IS NULL
      AND catalog_revision IS NULL
    )
    OR (
      pricing_authority = 'category-engine'
      AND pricing_policy_version IS NOT NULL
      AND length(btrim(pricing_policy_version)) > 0
      AND length(pricing_policy_version) <= 64
      AND catalog_revision IS NULL
    )
    OR (
      pricing_authority = 'measured-boq-engine'
      AND pricing_policy_version IS NOT NULL
      AND length(btrim(pricing_policy_version)) > 0
      AND length(pricing_policy_version) <= 64
      AND catalog_revision IS NOT NULL
      AND length(btrim(catalog_revision)) > 0
      AND length(catalog_revision) <= 64
    )
  );

CREATE INDEX IF NOT EXISTS estimates_pricing_authority_idx
  ON public.estimates (project_id, pricing_authority, created_at DESC);

COMMENT ON COLUMN public.estimates.pricing_authority IS
  'Authority marker: none (draft/legacy), category-engine, or measured-boq-engine. Not derived from status/ai_generated.';
COMMENT ON COLUMN public.estimates.pricing_policy_version IS
  'Server-owned pricing policy version for authority-priced estimates; null when authority is none.';
COMMENT ON COLUMN public.estimates.catalog_revision IS
  'Immutable catalogue revision for measured-boq-engine authority; null for none and category-engine.';

-- ────────────────────────────────────────────────────────────────────
-- 2. Durable idempotency table (private — no authenticated policies)
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.estimate_authority_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  pricing_authority text NOT NULL,
  operation_status text NOT NULL,
  resulting_estimate_id uuid NULL REFERENCES public.estimates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  CONSTRAINT estimate_authority_idempotency_project_key_unique
    UNIQUE (project_id, idempotency_key),
  CONSTRAINT estimate_authority_idempotency_key_check
    CHECK (
      length(btrim(idempotency_key)) > 0
      AND length(idempotency_key) <= 128
    ),
  CONSTRAINT estimate_authority_idempotency_payload_hash_check
    CHECK (
      payload_hash ~ '^[0-9a-f]{64}$'
    ),
  CONSTRAINT estimate_authority_idempotency_authority_check
    CHECK (pricing_authority IN ('category-engine', 'measured-boq-engine')),
  CONSTRAINT estimate_authority_idempotency_status_check
    CHECK (operation_status IN ('pending', 'committed')),
  CONSTRAINT estimate_authority_idempotency_status_estimate_check
    CHECK (
      (operation_status = 'pending' AND resulting_estimate_id IS NULL AND completed_at IS NULL)
      OR (operation_status = 'committed' AND resulting_estimate_id IS NOT NULL AND completed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS estimate_authority_idempotency_estimate_idx
  ON public.estimate_authority_idempotency (resulting_estimate_id)
  WHERE resulting_estimate_id IS NOT NULL;

ALTER TABLE public.estimate_authority_idempotency ENABLE ROW LEVEL SECURITY;

-- No authenticated policies. Explicitly revoke direct access.
REVOKE ALL ON TABLE public.estimate_authority_idempotency FROM PUBLIC;
REVOKE ALL ON TABLE public.estimate_authority_idempotency FROM anon;
REVOKE ALL ON TABLE public.estimate_authority_idempotency FROM authenticated;
-- service_role bypasses RLS; grant for clarity in non-bypass contexts
GRANT ALL ON TABLE public.estimate_authority_idempotency TO service_role;

COMMENT ON TABLE public.estimate_authority_idempotency IS
  'Private durable idempotency for authority-priced estimate writes. Browser roles have no access.';

-- ────────────────────────────────────────────────────────────────────
-- 3. Replace permissive browser write policies on estimates
--    Preserve admin SELECT. Split owner ALL into SELECT + draft writes.
-- ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "estimates_all_own" ON public.estimates;

DROP POLICY IF EXISTS "estimates_select_own" ON public.estimates;
CREATE POLICY "estimates_select_own"
  ON public.estimates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "estimates_insert_draft_own" ON public.estimates;
CREATE POLICY "estimates_insert_draft_own"
  ON public.estimates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND pricing_authority = 'none'
    AND pricing_policy_version IS NULL
    AND catalog_revision IS NULL
  );

DROP POLICY IF EXISTS "estimates_update_draft_own" ON public.estimates;
CREATE POLICY "estimates_update_draft_own"
  ON public.estimates
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND pricing_authority = 'none'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND pricing_authority = 'none'
    AND pricing_policy_version IS NULL
    AND catalog_revision IS NULL
  );

DROP POLICY IF EXISTS "estimates_delete_draft_own" ON public.estimates;
CREATE POLICY "estimates_delete_draft_own"
  ON public.estimates
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND pricing_authority = 'none'
  );

-- Admin select policy already exists (estimates_select_admin); leave intact.

-- ────────────────────────────────────────────────────────────────────
-- 4. estimate_rooms — draft-only browser writes (parent authority = none)
-- ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can manage rooms on their own estimates" ON public.estimate_rooms;

DROP POLICY IF EXISTS "estimate_rooms_select_own" ON public.estimate_rooms;
CREATE POLICY "estimate_rooms_select_own"
  ON public.estimate_rooms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      WHERE e.id = estimate_rooms.estimate_id
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "estimate_rooms_insert_draft_own" ON public.estimate_rooms;
CREATE POLICY "estimate_rooms_insert_draft_own"
  ON public.estimate_rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      WHERE e.id = estimate_rooms.estimate_id
        AND e.user_id = auth.uid()
        AND e.pricing_authority = 'none'
    )
  );

DROP POLICY IF EXISTS "estimate_rooms_update_draft_own" ON public.estimate_rooms;
CREATE POLICY "estimate_rooms_update_draft_own"
  ON public.estimate_rooms
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      WHERE e.id = estimate_rooms.estimate_id
        AND e.user_id = auth.uid()
        AND e.pricing_authority = 'none'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      WHERE e.id = estimate_rooms.estimate_id
        AND e.user_id = auth.uid()
        AND e.pricing_authority = 'none'
    )
  );

DROP POLICY IF EXISTS "estimate_rooms_delete_draft_own" ON public.estimate_rooms;
CREATE POLICY "estimate_rooms_delete_draft_own"
  ON public.estimate_rooms
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      WHERE e.id = estimate_rooms.estimate_id
        AND e.user_id = auth.uid()
        AND e.pricing_authority = 'none'
    )
  );

-- Admin select preserved (estimate_rooms_select_admin).

-- ────────────────────────────────────────────────────────────────────
-- 5. estimate_items — draft-only browser writes via parent authority
-- ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "estimate_items_all_own" ON public.estimate_items;

DROP POLICY IF EXISTS "estimate_items_select_own" ON public.estimate_items;
CREATE POLICY "estimate_items_select_own"
  ON public.estimate_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      WHERE e.id = estimate_items.estimate_id
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "estimate_items_insert_draft_own" ON public.estimate_items;
CREATE POLICY "estimate_items_insert_draft_own"
  ON public.estimate_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.estimates e
      WHERE e.id = estimate_items.estimate_id
        AND e.user_id = auth.uid()
        AND e.pricing_authority = 'none'
    )
  );

DROP POLICY IF EXISTS "estimate_items_update_draft_own" ON public.estimate_items;
CREATE POLICY "estimate_items_update_draft_own"
  ON public.estimate_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      WHERE e.id = estimate_items.estimate_id
        AND e.user_id = auth.uid()
        AND e.pricing_authority = 'none'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.estimates e
      WHERE e.id = estimate_items.estimate_id
        AND e.user_id = auth.uid()
        AND e.pricing_authority = 'none'
    )
  );

DROP POLICY IF EXISTS "estimate_items_delete_draft_own" ON public.estimate_items;
CREATE POLICY "estimate_items_delete_draft_own"
  ON public.estimate_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.estimates e
      WHERE e.id = estimate_items.estimate_id
        AND e.user_id = auth.uid()
        AND e.pricing_authority = 'none'
    )
  );

-- Admin select preserved (estimate_items_select_admin).

-- ────────────────────────────────────────────────────────────────────
-- 6. Private category-only persistence RPC
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.persist_category_engine_estimate(
  p_project_id uuid,
  p_expected_owner_id uuid,
  p_idempotency_key text,
  p_payload_hash text,
  p_pricing_policy_version text,
  p_region text,
  p_condition_level text,
  p_finish_level text,
  p_labour_total numeric,
  p_materials_total numeric,
  p_subtotal numeric,
  p_contingency numeric,
  p_vat_amount numeric,
  p_low_total numeric,
  p_mid_total numeric,
  p_high_total numeric,
  p_timeline_weeks numeric,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner_id uuid;
  v_idemp public.estimate_authority_idempotency%ROWTYPE;
  v_estimate_id uuid;
  v_item jsonb;
  v_item_order integer := 0;
  v_result jsonb;
BEGIN
  -- Input sanity (server-trusted path still validates hard bounds)
  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_owner_id IS NULL THEN
    RAISE EXCEPTION 'PROJECT_OWNERSHIP_CHANGED' USING ERRCODE = 'P0001';
  END IF;
  IF p_idempotency_key IS NULL
     OR length(btrim(p_idempotency_key)) = 0
     OR length(p_idempotency_key) > 128 THEN
    RAISE EXCEPTION 'INVALID_AUTHORITY_FIELD_VALUE' USING ERRCODE = '22023';
  END IF;
  IF p_payload_hash IS NULL OR p_payload_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_AUTHORITY_FIELD_VALUE' USING ERRCODE = '22023';
  END IF;
  IF p_pricing_policy_version IS NULL
     OR length(btrim(p_pricing_policy_version)) = 0
     OR length(p_pricing_policy_version) > 64 THEN
    RAISE EXCEPTION 'INVALID_AUTHORITY_FIELD_VALUE' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_AUTHORITY_FIELD_VALUE' USING ERRCODE = '22023';
  END IF;

  -- 6.1 Ownership lock + recheck (authoritative)
  SELECT p.user_id
    INTO v_owner_id
  FROM public.projects p
  WHERE p.id = p_project_id
  FOR UPDATE;

  IF NOT FOUND OR v_owner_id IS NULL THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id IS DISTINCT FROM p_expected_owner_id THEN
    RAISE EXCEPTION 'PROJECT_OWNERSHIP_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  -- 6.2 Idempotency lookup / reservation (serialized by project lock)
  SELECT *
    INTO v_idemp
  FROM public.estimate_authority_idempotency i
  WHERE i.project_id = p_project_id
    AND i.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_idemp.payload_hash IS DISTINCT FROM p_payload_hash THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
    END IF;

    IF v_idemp.operation_status = 'committed' AND v_idemp.resulting_estimate_id IS NOT NULL THEN
      SELECT jsonb_build_object(
        'estimate_id', e.id,
        'replay', true,
        'estimate', to_jsonb(e),
        'items', COALESCE((
          SELECT jsonb_agg(to_jsonb(ei) ORDER BY ei.display_order, ei.category)
          FROM public.estimate_items ei
          WHERE ei.estimate_id = e.id
        ), '[]'::jsonb)
      )
        INTO v_result
      FROM public.estimates e
      WHERE e.id = v_idemp.resulting_estimate_id;

      IF v_result IS NULL THEN
        RAISE EXCEPTION 'AUTHORITY_PERSISTENCE_FAILED' USING ERRCODE = 'P0003';
      END IF;

      RETURN v_result;
    END IF;

    -- Stale pending row (should not survive a committed transaction).
    RAISE EXCEPTION 'AUTHORITY_PERSISTENCE_FAILED' USING ERRCODE = 'P0003';
  END IF;

  INSERT INTO public.estimate_authority_idempotency (
    project_id,
    idempotency_key,
    payload_hash,
    pricing_authority,
    operation_status
  ) VALUES (
    p_project_id,
    p_idempotency_key,
    p_payload_hash,
    'category-engine',
    'pending'
  );

  -- 6.3 Insert authority estimate header (hard-coded marker)
  INSERT INTO public.estimates (
    project_id,
    user_id,
    region,
    condition_level,
    finish_level,
    labour_total,
    materials_total,
    subtotal,
    contingency,
    vat_amount,
    low_total,
    mid_total,
    high_total,
    timeline_weeks,
    status,
    ai_generated,
    pricing_authority,
    pricing_policy_version,
    catalog_revision
  ) VALUES (
    p_project_id,
    p_expected_owner_id,
    p_region,
    p_condition_level,
    p_finish_level,
    p_labour_total,
    p_materials_total,
    p_subtotal,
    p_contingency,
    p_vat_amount,
    p_low_total,
    p_mid_total,
    p_high_total,
    p_timeline_weeks,
    'draft',
    false,
    'category-engine',
    p_pricing_policy_version,
    NULL
  )
  RETURNING id INTO v_estimate_id;

  -- 6.4 Category line items (no rooms)
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_AUTHORITY_FIELD_VALUE' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.estimate_items (
      estimate_id,
      user_id,
      category,
      name,
      labour,
      materials,
      total_cost,
      weeks,
      display_order,
      is_ai_suggested
    ) VALUES (
      v_estimate_id,
      p_expected_owner_id,
      COALESCE(v_item->>'category', ''),
      COALESCE(v_item->>'category', ''),
      COALESCE((v_item->>'labour')::numeric, 0),
      COALESCE((v_item->>'materials')::numeric, 0),
      COALESCE((v_item->>'total')::numeric, 0),
      COALESCE((v_item->>'weeks')::numeric, 0),
      v_item_order,
      false
    );

    v_item_order := v_item_order + 1;
  END LOOP;

  -- 6.5 Atomic stage flag — never estimated_gdv
  UPDATE public.projects
  SET estimate_done = true
  WHERE id = p_project_id
    AND user_id = p_expected_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_OWNERSHIP_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  -- 6.6 Complete idempotency
  UPDATE public.estimate_authority_idempotency
  SET
    operation_status = 'committed',
    resulting_estimate_id = v_estimate_id,
    completed_at = now()
  WHERE project_id = p_project_id
    AND idempotency_key = p_idempotency_key;

  SELECT jsonb_build_object(
    'estimate_id', e.id,
    'replay', false,
    'estimate', to_jsonb(e),
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(ei) ORDER BY ei.display_order, ei.category)
      FROM public.estimate_items ei
      WHERE ei.estimate_id = e.id
    ), '[]'::jsonb)
  )
    INTO v_result
  FROM public.estimates e
  WHERE e.id = v_estimate_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.persist_category_engine_estimate(
  uuid, uuid, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.persist_category_engine_estimate(
  uuid, uuid, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb
) FROM anon;
REVOKE ALL ON FUNCTION public.persist_category_engine_estimate(
  uuid, uuid, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.persist_category_engine_estimate(
  uuid, uuid, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb
) TO service_role;

COMMENT ON FUNCTION public.persist_category_engine_estimate IS
  'Private category-engine authority persistence. service_role only. Hard-codes pricing_authority=category-engine.';
