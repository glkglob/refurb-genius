-- Add missing update policy so job owners can accept/reject interests
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
