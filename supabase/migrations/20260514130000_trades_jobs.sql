create table if not exists public.trades_jobs (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users(id) on delete cascade,
  title              text        not null,
  property_address   text,
  postcode           text,
  property_type      text,
  job_category       text        not null,
  description        text        not null,
  budget_min         numeric,
  budget_max         numeric,
  desired_start_date date,
  status             text        not null default 'draft',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint trades_jobs_status_check check (status in ('draft', 'posted', 'closed'))
);

alter table public.trades_jobs enable row level security;

-- Idempotent policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_jobs'
      AND policyname = 'Users can select their own trades jobs'
  ) THEN
    create policy "Users can select their own trades jobs"
      on public.trades_jobs for select
      using (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_jobs'
      AND policyname = 'Users can insert their own trades jobs'
  ) THEN
    create policy "Users can insert their own trades jobs"
      on public.trades_jobs for insert
      with check (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_jobs'
      AND policyname = 'Users can update their own trades jobs'
  ) THEN
    create policy "Users can update their own trades jobs"
      on public.trades_jobs for update
      using (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trades_jobs'
      AND policyname = 'Users can delete their own trades jobs'
  ) THEN
    create policy "Users can delete their own trades jobs"
      on public.trades_jobs for delete
      using (auth.uid() = user_id);
  END IF;
END
$$;
