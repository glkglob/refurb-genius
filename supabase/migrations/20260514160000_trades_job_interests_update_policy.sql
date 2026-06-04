-- Add missing update policy so job owners can accept/reject interests
-- Idempotent via IF NOT EXISTS (consistent pattern across migrations; avoids unnecessary drops)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_job_interests'
      AND policyname = 'interests: job owner can update status'
  ) THEN
    create policy "interests: job owner can update status"
      on public.trades_job_interests
      for update
      to authenticated
      using (
        job_id in (
          select id from public.trades_jobs where user_id = auth.uid()
        )
      )
      with check (
        job_id in (
          select id from public.trades_jobs where user_id = auth.uid()
        )
      );
  END IF;
END
$$;
