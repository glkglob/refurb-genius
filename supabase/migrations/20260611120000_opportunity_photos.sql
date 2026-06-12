-- Photos attached directly to a Deal Copilot opportunity.
--
-- Design: opportunities are NOT linked to projects, so they cannot reuse the
-- `photos` table (which FKs project_id -> projects). This table mirrors `photos`
-- but FKs `opportunity_id -> deal_opportunities`.
--
-- Storage: we REUSE the existing public `project-photos` bucket. Its storage RLS
-- policies scope ownership by the leading folder (auth.uid() = foldername[1]),
-- so an object path of `{user_id}/opp/{opportunityId}/{uuid}.{ext}` passes the
-- existing insert/read/delete policies with no new storage policy required.
--
-- All statements are idempotent (CLAUDE.md migration rule).

create table if not exists public.opportunity_photos (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.deal_opportunities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  url text not null,
  name text not null,
  size int not null default 0,
  uploaded_at timestamptz not null default now()
);

alter table public.opportunity_photos enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opportunity_photos'
      AND policyname = 'opportunity_photos_all_own'
  ) THEN
    create policy "opportunity_photos_all_own" on public.opportunity_photos
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  END IF;
END
$$;

create index if not exists opportunity_photos_idx
  on public.opportunity_photos(opportunity_id, uploaded_at);
