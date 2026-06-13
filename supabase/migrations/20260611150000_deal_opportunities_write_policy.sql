-- Add write (INSERT / UPDATE / DELETE) policy for deal_opportunities.
--
-- Prod previously only had a SELECT policy, which blocked all saves.
-- This migration adds the missing ALL policy idempotently so it is safe
-- to re-run on any environment.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND   tablename  = 'deal_opportunities'
    AND   policyname = 'Users can manage own deal opportunities'
  ) THEN
    CREATE POLICY "Users can manage own deal opportunities"
      ON public.deal_opportunities
      FOR ALL
      USING     (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;
