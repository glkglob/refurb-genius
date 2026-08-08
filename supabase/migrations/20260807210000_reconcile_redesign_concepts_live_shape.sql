-- IA-4-R3 — Reconcile redesign_concepts to the live product schema.
--
-- Root cause (evidence-backed):
--   20260508155054 creates redesign_concepts as:
--     (id, project_id, user_id, style, payload jsonb, created_at)
--   Production / verification live shape (no repository migration) is:
--     (id, user_id, project_id, photo_id, title, description, style,
--      image_url, created_at, updated_at)
--   IA-4 R1/R2 and application code require the live shape.
--   No committed migration previously performed the transition.
--
-- Classification: production received schema evolution not represented in
-- repository migration history (manual/dashboard DDL or uncaptured remote
-- change). Remote schema_migrations still stores the original CREATE with
-- payload; the live table has no payload column.
--
-- This migration is fully idempotent:
--   A) historical payload schema  → convert to live shape
--   B) already-live title schema  → no-op (production after drift)
--   C) partial intermediate state → ensure missing columns
--
-- Ordered BEFORE IA-4 R1 (20260807220000) so clean zero-to-current succeeds.
-- Safe when applied later against production that already has R1/R2: only
-- additive IF NOT EXISTS / conditional conversion; no data loss.
--
-- Does NOT rewrite 20260508155054 or IA-4 R1/R2 files.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Convert legacy payload shape → live product columns (when needed)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  has_payload boolean;
  has_title boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'redesign_concepts'
      AND column_name = 'payload'
  ) INTO has_payload;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'redesign_concepts'
      AND column_name = 'title'
  ) INTO has_title;

  -- Path A: legacy CREATE shape only (payload, no title)
  IF has_payload AND NOT has_title THEN
    ALTER TABLE public.redesign_concepts
      ADD COLUMN photo_id uuid,
      ADD COLUMN title text,
      ADD COLUMN description text,
      ADD COLUMN image_url text,
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

    -- style may be NOT NULL already; presentation fields from payload JSON.
    UPDATE public.redesign_concepts
    SET
      title = left(
        coalesce(
          nullif(trim(payload ->> 'tagline'), ''),
          nullif(trim(style), ''),
          'Concept'
        ),
        200
      ),
      description = payload::text,
      image_url = nullif(trim(payload ->> 'afterImageUrl'), ''),
      updated_at = coalesce(created_at, now());

    ALTER TABLE public.redesign_concepts
      ALTER COLUMN title SET NOT NULL;

    -- Drop legacy payload after presentation is preserved in description.
    ALTER TABLE public.redesign_concepts
      DROP COLUMN payload;

    -- style was NOT NULL in legacy; live allows null. Keep NOT NULL if present.
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Ensure live columns exist (idempotent; production already-live path)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.redesign_concepts
  ADD COLUMN IF NOT EXISTS photo_id uuid;

ALTER TABLE public.redesign_concepts
  ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.redesign_concepts
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.redesign_concepts
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.redesign_concepts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- title must be non-null for product inserts; backfill any nulls then enforce.
UPDATE public.redesign_concepts
SET title = left(coalesce(nullif(trim(style), ''), 'Concept'), 200)
WHERE title IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'redesign_concepts'
      AND column_name = 'title'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.redesign_concepts
      ALTER COLUMN title SET NOT NULL;
  END IF;
END;
$$;

-- style: live is nullable; leave as-is (legacy NOT NULL remains safe).

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Indexes + FK matching live product surface (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS redesign_concepts_project_id_idx
  ON public.redesign_concepts (project_id);

CREATE INDEX IF NOT EXISTS redesign_concepts_user_id_idx
  ON public.redesign_concepts (user_id);

CREATE INDEX IF NOT EXISTS idx_redesign_concepts_photo_id
  ON public.redesign_concepts (photo_id);

-- photo_id FK when photos table exists and constraint missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'photos'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'redesign_concepts_photo_id_fkey'
  ) THEN
    ALTER TABLE public.redesign_concepts
      ADD CONSTRAINT redesign_concepts_photo_id_fkey
      FOREIGN KEY (photo_id) REFERENCES public.photos (id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- updated_at maintenance (shared set_updated_at if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_redesign_concepts_updated_at'
      AND tgrelid = 'public.redesign_concepts'::regclass
  ) THEN
    CREATE TRIGGER set_redesign_concepts_updated_at
      BEFORE UPDATE ON public.redesign_concepts
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

COMMENT ON TABLE public.redesign_concepts IS
  'Redesign concept candidates. Live presentation columns: title/description/style/image_url. Authority columns added by IA-4 R1.';
