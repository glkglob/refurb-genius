-- Create analysis_jobs table (legacy async job tracking, originally for former Railway FastAPI backend).
-- Table and RLS left in place for DB history / potential future queue use. No longer referenced by application code after Railway decommissioning.
-- (Previously populated via VITE_API_BASE_URL + service role from removed backend/main.py.)
-- Users can only see their own jobs via RLS.

create table if not exists public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  status text not null default 'pending',
  input_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  error_message text,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Status constraint
alter table public.analysis_jobs
  add constraint analysis_jobs_status_check
  check (status in ('pending', 'processing', 'completed', 'failed'));

-- Indexes for common queries (status polling + user history)
create index if not exists idx_analysis_jobs_user on public.analysis_jobs(user_id);
create index if not exists idx_analysis_jobs_status on public.analysis_jobs(status);
create index if not exists idx_analysis_jobs_created on public.analysis_jobs(created_at desc);

-- Enable RLS
alter table public.analysis_jobs enable row level security;

-- RLS Policies: users can manage only their own analysis jobs
-- Idempotent wrappers (DO $$ + pg_policies check) for safe re-runs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'analysis_jobs'
      AND policyname = 'Users can view their own analysis jobs'
  ) THEN
    CREATE POLICY "Users can view their own analysis jobs"
      ON public.analysis_jobs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'analysis_jobs'
      AND policyname = 'Users can insert their own analysis jobs'
  ) THEN
    CREATE POLICY "Users can insert their own analysis jobs"
      ON public.analysis_jobs FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'analysis_jobs'
      AND policyname = 'Users can update their own analysis jobs'
  ) THEN
    CREATE POLICY "Users can update their own analysis jobs"
      ON public.analysis_jobs FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Optional: allow delete for the owner (cleanup)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'analysis_jobs'
      AND policyname = 'Users can delete their own analysis jobs'
  ) THEN
    CREATE POLICY "Users can delete their own analysis jobs"
      ON public.analysis_jobs FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Simple updated_at trigger (defensive; backend also sets it)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_analysis_jobs_updated_at
  before update on public.analysis_jobs
  for each row execute function public.set_updated_at();

comment on table public.analysis_jobs is 'Legacy async job tracking (former Railway backend experiment; table retained for history).';
comment on column public.analysis_jobs.input_payload is 'Frontend-supplied deal/property details (address, price, condition, etc.).';
comment on column public.analysis_jobs.result_payload is 'Structured AI result (report, breakdown, recommendations, etc.).';
