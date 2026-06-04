-- Evolve estimates schema: add room-level grouping, richer metadata,
-- and per-item detail (quantity, unit, unit_cost).
--
-- Strategy: ALTER existing tables non-destructively, then CREATE the
-- new estimate_rooms join table. Existing data is preserved — new
-- columns get sensible defaults so old rows remain valid.

-- ────────────────────────────────────────────────────────────────────
-- 1. estimates — add new columns, widen to support the richer schema
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Refurbishment Estimate',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add CHECK constraint for status values
ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_status_check
  CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'invoiced'));

-- Rename 'vat' to 'vat_amount' for clarity (matches target schema)
ALTER TABLE public.estimates RENAME COLUMN vat TO vat_amount;

-- ────────────────────────────────────────────────────────────────────
-- 2. estimate_rooms — new table linking estimates → rooms → items
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.estimate_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area_sqm NUMERIC(8,2),
  subtotal NUMERIC(12,2) DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_estimate ON public.estimate_rooms(estimate_id);

ALTER TABLE public.estimate_rooms ENABLE ROW LEVEL SECURITY;

-- RLS: users can manage rooms belonging to their own estimates
-- Idempotent wrapper for safe re-application of migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimate_rooms'
      AND policyname = 'Users can manage rooms on their own estimates'
  ) THEN
    CREATE POLICY "Users can manage rooms on their own estimates"
      ON public.estimate_rooms FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.estimates e
          WHERE e.id = estimate_rooms.estimate_id
          AND e.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.estimates e
          WHERE e.id = estimate_rooms.estimate_id
          AND e.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────────────
-- 3. estimate_items — add room_id FK and richer item columns
-- ────────────────────────────────────────────────────────────────────

-- Add room_id (nullable initially so existing rows aren't broken)
ALTER TABLE public.estimate_items
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.estimate_rooms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'item',
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_ai_suggested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Rename 'total' to 'total_cost' for clarity (matches target schema)
ALTER TABLE public.estimate_items RENAME COLUMN total TO total_cost;

CREATE INDEX IF NOT EXISTS idx_items_room ON public.estimate_items(room_id);

-- ────────────────────────────────────────────────────────────────────
-- 4. Backfill existing items: create a "General" room per estimate
--    and assign orphaned items to it so room_id is populated.
-- ────────────────────────────────────────────────────────────────────

-- Create one "General" room per existing estimate
INSERT INTO public.estimate_rooms (estimate_id, name, display_order)
SELECT DISTINCT e.id, 'General', 0
FROM public.estimates e
WHERE NOT EXISTS (
  SELECT 1 FROM public.estimate_rooms r WHERE r.estimate_id = e.id
);

-- Point existing items (room_id IS NULL) at the "General" room
UPDATE public.estimate_items ei
SET room_id = (
  SELECT r.id FROM public.estimate_rooms r
  WHERE r.estimate_id = ei.estimate_id
  AND r.name = 'General'
  LIMIT 1
)
WHERE ei.room_id IS NULL;

-- Backfill item name from category for existing rows
UPDATE public.estimate_items
SET name = category
WHERE name = '';

-- ────────────────────────────────────────────────────────────────────
-- 5. Admin read-access policy for estimate_rooms
-- ────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimate_rooms'
      AND policyname = 'estimate_rooms_select_admin'
  ) THEN
    CREATE POLICY "estimate_rooms_select_admin"
      ON public.estimate_rooms FOR SELECT
      USING (public.is_admin());
  END IF;
END
$$;
