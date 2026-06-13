-- Restore: this migration version was applied to the remote DB.
-- All statements are idempotent so re-applying on db reset is safe.

create table if not exists public.trades_job_interests (
  id         uuid        primary key default gen_random_uuid(),
  job_id     uuid        not null references public.trades_jobs(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  message    text,
  status     text        not null default 'pending',
  created_at timestamptz not null default now(),
  constraint trades_job_interests_status_check check (status in ('pending', 'accepted', 'rejected')),
  constraint trades_job_interests_unique_user_job unique (job_id, user_id)
);

alter table public.trades_job_interests enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_job_interests'
      AND policyname = 'Users can insert own interest'
  ) THEN
    create policy "Users can insert own interest"
      on public.trades_job_interests for insert
      to authenticated
      with check (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_job_interests'
      AND policyname = 'Users can view own interests'
  ) THEN
    create policy "Users can view own interests"
      on public.trades_job_interests for select
      to authenticated
      using (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_job_interests'
      AND policyname = 'Job owners can view interests for their jobs'
  ) THEN
    create policy "Job owners can view interests for their jobs"
      on public.trades_job_interests for select
      to authenticated
      using (
        exists (
          select 1 from public.trades_jobs
          where id = trades_job_interests.job_id
            and user_id = auth.uid()
        )
      );
  END IF;
END
$$;
