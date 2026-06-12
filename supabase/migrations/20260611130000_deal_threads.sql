-- Deal Copilot conversation threads (Phase 1.3 — text-only chat substrate).
--
-- Threads hang off deal_opportunities (NOT projects). Messages are scoped via
-- their parent thread's owner. `structured_output` is reserved for future
-- structured AI results in-thread; `metadata` for model/token diagnostics.
--
-- All statements are idempotent (CLAUDE.md migration rule).

create table if not exists public.deal_threads (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.deal_opportunities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.deal_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  structured_output jsonb,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_deal_threads_opportunity
  on public.deal_threads(opportunity_id, updated_at desc);
create index if not exists idx_deal_messages_thread
  on public.deal_messages(thread_id, created_at);

alter table public.deal_threads enable row level security;
alter table public.deal_messages enable row level security;

drop trigger if exists deal_threads_set_updated_at on public.deal_threads;
create trigger deal_threads_set_updated_at
  before update on public.deal_threads
  for each row execute function public.set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'deal_threads'
      AND policyname = 'deal_threads_all_own'
  ) THEN
    create policy "deal_threads_all_own" on public.deal_threads
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'deal_messages'
      AND policyname = 'deal_messages_select_own'
  ) THEN
    create policy "deal_messages_select_own" on public.deal_messages
      for select using (exists (
        select 1 from public.deal_threads t
        where t.id = deal_messages.thread_id and t.user_id = auth.uid()
      ));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'deal_messages'
      AND policyname = 'deal_messages_insert_own'
  ) THEN
    create policy "deal_messages_insert_own" on public.deal_messages
      for insert with check (exists (
        select 1 from public.deal_threads t
        where t.id = thread_id and t.user_id = auth.uid()
      ));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'deal_messages'
      AND policyname = 'deal_messages_delete_own'
  ) THEN
    create policy "deal_messages_delete_own" on public.deal_messages
      for delete using (exists (
        select 1 from public.deal_threads t
        where t.id = deal_messages.thread_id and t.user_id = auth.uid()
      ));
  END IF;
END
$$;
