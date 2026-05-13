create table public.trades_job_interests (
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

-- Tradespeople can register their own interest
create policy "Users can insert own interest"
  on public.trades_job_interests for insert
  with check (auth.uid() = user_id);

-- Tradespeople can view their own interests
create policy "Users can view own interests"
  on public.trades_job_interests for select
  using (auth.uid() = user_id);

-- Job owners can view all interests for their jobs
create policy "Job owners can view interests for their jobs"
  on public.trades_job_interests for select
  using (
    exists (
      select 1 from public.trades_jobs
      where id = trades_job_interests.job_id
        and user_id = auth.uid()
    )
  );
