-- Create trades_job_interests table
create table if not exists public.trades_job_interests (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.trades_jobs(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  message       text,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'rejected')),
  created_at    timestamptz not null default now(),
  constraint trades_job_interests_job_user_unique unique (job_id, user_id)
);

-- Index for fast lookups per job and per user
create index if not exists trades_job_interests_job_id_idx
  on public.trades_job_interests (job_id);

create index if not exists trades_job_interests_user_id_idx
  on public.trades_job_interests (user_id);

-- Enable RLS
alter table public.trades_job_interests enable row level security;

-- Idempotent policies (note: one update policy lives in 20260514160000_... which already used DROP IF)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_job_interests'
      AND policyname = 'interests: insert own'
  ) THEN
    create policy "interests: insert own"
      on public.trades_job_interests
      for insert
      to authenticated
      with check (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_job_interests'
      AND policyname = 'interests: select own'
  ) THEN
    create policy "interests: select own"
      on public.trades_job_interests
      for select
      to authenticated
      using (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_job_interests'
      AND policyname = 'interests: job owner can view'
  ) THEN
    create policy "interests: job owner can view"
      on public.trades_job_interests
      for select
      to authenticated
      using (
        job_id in (
          select id from public.trades_jobs where user_id = auth.uid()
        )
      );
  END IF;
END
$$;
