-- Add missing columns to the projects table.
--
-- These columns (property details) were included in the original CREATE TABLE
-- (see 20260508155054_... .sql) but may be absent in some development / test
-- Supabase instances due to the timing of when the migration was applied vs.
-- when the create-table script was updated, or after schema resets.
--
-- Using ADD COLUMN IF NOT EXISTS + defaults is safe, non-destructive, and
-- idempotent. Existing rows get the defaults for any missing columns.
--
-- This fixes the "Could not find the 'bathrooms' column of 'projects' in the
-- schema cache" error (PostgREST schema introspection fails for unknown columns
-- during .select('*') or typed inserts).
--
-- After applying this migration, run `supabase gen types typescript --local > packages/supabase/src/database.types.ts`
-- (or the equivalent) to refresh client types if they were out of sync.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS property_type text NOT NULL DEFAULT 'Terraced',
  ADD COLUMN IF NOT EXISTS bedrooms int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bathrooms int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS size_sqm numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_gdv numeric NOT NULL DEFAULT 0;

-- Ensure any pre-existing rows that might have had nulls (from older partial schemas)
-- are backfilled. The ADD ... DEFAULT should have handled new rows, but this is belt-and-suspenders.
UPDATE public.projects
SET
  property_type = COALESCE(property_type, 'Terraced'),
  bedrooms = COALESCE(bedrooms, 0),
  bathrooms = COALESCE(bathrooms, 0),
  size_sqm = COALESCE(size_sqm, 0),
  purchase_price = COALESCE(purchase_price, 0),
  estimated_gdv = COALESCE(estimated_gdv, 0)
WHERE
  property_type IS NULL
  OR bedrooms IS NULL
  OR bathrooms IS NULL
  OR size_sqm IS NULL
  OR purchase_price IS NULL
  OR estimated_gdv IS NULL;

-- Add indexes if useful for common filters (non-breaking).
CREATE INDEX IF NOT EXISTS projects_property_type_idx ON public.projects(property_type);
CREATE INDEX IF NOT EXISTS projects_bedrooms_bathrooms_idx ON public.projects(bedrooms, bathrooms);
