-- TRADES-PRIVACY-R1B — Public job data boundary (MODEL C)
--
-- Owner-only base-table SELECT for trades_jobs.
-- Anonymous / non-owner posted-job browse via SECURITY DEFINER RPCs with:
--   SET search_path = ''
--   explicit column whitelist
--   status = 'posted' hard filter
--   outward postcode only (never full postcode / property_address / user_id)
--
-- No table split. No destructive scrub of historical address/postcode values.

-- ---------------------------------------------------------------------------
-- 1. Outward postcode helper (IMMUTABLE; not SECURITY DEFINER)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trades_job_outward_postcode(p_postcode text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
  SELECT CASE
    WHEN p_postcode IS NULL OR btrim(p_postcode) = '' THEN NULL
    WHEN position(' ' in upper(btrim(regexp_replace(p_postcode, '\s+', ' ', 'g')))) > 0
      THEN split_part(upper(btrim(regexp_replace(p_postcode, '\s+', ' ', 'g'))), ' ', 1)
    WHEN upper(btrim(p_postcode)) ~ '^[A-Z]{1,2}[0-9]{1,2}[A-Z]?'
      THEN (regexp_match(upper(btrim(p_postcode)), '^[A-Z]{1,2}[0-9]{1,2}[A-Z]?'))[1]
    ELSE NULL
  END;
$fn$;

COMMENT ON FUNCTION public.trades_job_outward_postcode(text) IS
  'TRADES-PRIVACY-R1B: derive UK outward postcode for public display; never returns full unit postcode on parse failure.';

REVOKE ALL ON FUNCTION public.trades_job_outward_postcode(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trades_job_outward_postcode(text) TO anon;
GRANT EXECUTE ON FUNCTION public.trades_job_outward_postcode(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trades_job_outward_postcode(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Public list RPC (optional category + optional id batch for My Interests)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_public_posted_trades_jobs(
  p_category text DEFAULT NULL,
  p_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  job_category text,
  budget_min numeric,
  budget_max numeric,
  desired_start_date date,
  property_type text,
  created_at timestamptz,
  outward_postcode text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT
    j.id,
    j.title,
    j.description,
    j.job_category,
    j.budget_min,
    j.budget_max,
    j.desired_start_date,
    j.property_type,
    j.created_at,
    public.trades_job_outward_postcode(j.postcode) AS outward_postcode
  FROM public.trades_jobs j
  WHERE j.status = 'posted'
    AND (p_category IS NULL OR j.job_category = p_category)
    AND (p_ids IS NULL OR j.id = ANY (p_ids))
  ORDER BY j.created_at DESC;
$fn$;

COMMENT ON FUNCTION public.list_public_posted_trades_jobs(text, uuid[]) IS
  'TRADES-PRIVACY-R1B: public-safe posted job list; whitelist only; outward postcode; no address/full postcode/user_id.';

REVOKE ALL ON FUNCTION public.list_public_posted_trades_jobs(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_posted_trades_jobs(text, uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.list_public_posted_trades_jobs(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_posted_trades_jobs(text, uuid[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Public detail RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_posted_trades_job(p_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  job_category text,
  budget_min numeric,
  budget_max numeric,
  desired_start_date date,
  property_type text,
  created_at timestamptz,
  outward_postcode text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT
    j.id,
    j.title,
    j.description,
    j.job_category,
    j.budget_min,
    j.budget_max,
    j.desired_start_date,
    j.property_type,
    j.created_at,
    public.trades_job_outward_postcode(j.postcode) AS outward_postcode
  FROM public.trades_jobs j
  WHERE j.id = p_id
    AND j.status = 'posted';
$fn$;

COMMENT ON FUNCTION public.get_public_posted_trades_job(uuid) IS
  'TRADES-PRIVACY-R1B: public-safe posted job detail; whitelist only; outward postcode.';

REVOKE ALL ON FUNCTION public.get_public_posted_trades_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_posted_trades_job(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_posted_trades_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_posted_trades_job(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Base-table RLS: owner-only SELECT (all statuses for owner)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "trades_jobs_select_posted_anon" ON public.trades_jobs;
DROP POLICY IF EXISTS "trades_jobs_select_authenticated" ON public.trades_jobs;
DROP POLICY IF EXISTS "trades_jobs_select_posted" ON public.trades_jobs;
DROP POLICY IF EXISTS "Users can select their own trades jobs" ON public.trades_jobs;

CREATE POLICY "trades_jobs_select_own"
  ON public.trades_jobs
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Write policies already owner-scoped; ensure they remain.
-- (No rewrite; recreate only if missing after prior consolidations.)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_jobs'
      AND policyname = 'trades_jobs_insert_own'
  ) THEN
    CREATE POLICY "trades_jobs_insert_own"
      ON public.trades_jobs
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_jobs'
      AND policyname = 'trades_jobs_update_own'
  ) THEN
    CREATE POLICY "trades_jobs_update_own"
      ON public.trades_jobs
      FOR UPDATE
      TO authenticated
      USING (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_jobs'
      AND policyname = 'trades_jobs_delete_own'
  ) THEN
    CREATE POLICY "trades_jobs_delete_own"
      ON public.trades_jobs
      FOR DELETE
      TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 5. Table grant tightening
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.trades_jobs FROM anon;
REVOKE ALL ON TABLE public.trades_jobs FROM authenticated;
REVOKE ALL ON TABLE public.trades_jobs FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trades_jobs TO authenticated;
GRANT ALL ON TABLE public.trades_jobs TO service_role;
GRANT ALL ON TABLE public.trades_jobs TO postgres;
