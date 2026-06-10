-- Converge public_gallery_projects with the schema the app expects.
--
-- The live table was created out-of-band with `is_published` (plus slug /
-- summary / location columns) before 20260605123000_feature_foundation's
-- CREATE TABLE IF NOT EXISTS ran, so the app's queries against `is_public`,
-- `featured` and `view_count` fail with "column does not exist" and the
-- public gallery page renders empty.
--
-- Adds the missing columns, backfills is_public from is_published where that
-- legacy column exists, and re-points the public read policy at is_public.
-- Idempotent throughout.

ALTER TABLE public.public_gallery_projects
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Backfill from the legacy flag when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_gallery_projects'
      AND column_name = 'is_published'
  ) THEN
    UPDATE public.public_gallery_projects
    SET is_public = is_published
    WHERE is_public IS DISTINCT FROM is_published;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_public_gallery_projects_public
  ON public.public_gallery_projects(is_public, featured);

-- Public read must follow is_public (what the app reads and writes).
DO $$
BEGIN
  DROP POLICY IF EXISTS "public_gallery_projects_public_read" ON public.public_gallery_projects;
  CREATE POLICY "public_gallery_projects_public_read"
    ON public.public_gallery_projects FOR SELECT
    USING (is_public = true);
END
$$;
