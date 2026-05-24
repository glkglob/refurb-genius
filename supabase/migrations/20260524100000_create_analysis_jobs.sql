-- Create analysis_jobs table for async Railway FastAPI + CrewAI property analysis jobs.
-- Jobs are created from the frontend via VITE_API_BASE_URL.
-- The Railway backend (service role) updates status and results.
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
create policy "Users can view their own analysis jobs"
  on public.analysis_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own analysis jobs"
  on public.analysis_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own analysis jobs"
  on public.analysis_jobs for update
  using (auth.uid() = user_id);

-- Optional: allow delete for the owner (cleanup)
create policy "Users can delete their own analysis jobs"
  on public.analysis_jobs for delete
  using (auth.uid() = user_id);

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

comment on table public.analysis_jobs is 'Async job tracking for property intelligence / refurb analysis executed on Railway backend';
comment on column public.analysis_jobs.input_payload is 'Frontend-supplied deal/property details (address, price, condition, etc.)';
comment on column public.analysis_jobs.result_payload is 'Structured AI result (report, breakdown, recommendations, etc.)';
