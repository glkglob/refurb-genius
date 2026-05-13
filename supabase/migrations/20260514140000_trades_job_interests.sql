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

-- Users can insert their own interest
create policy "interests: insert own"
  on public.trades_job_interests
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can view their own interests
create policy "interests: select own"
  on public.trades_job_interests
  for select
  to authenticated
  using (user_id = auth.uid());

-- Job owners can view interests for their jobs
create policy "interests: job owner can view"
  on public.trades_job_interests
  for select
  to authenticated
  using (
    job_id in (
      select id from public.trades_jobs where user_id = auth.uid()
    )
  );
