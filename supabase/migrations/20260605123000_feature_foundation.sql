-- Feature Foundation Migration: Supabase schema for 5 features
-- 3D Floorplan, Trades Marketplace, Photo Analysis, Pitch Deck, Public Gallery
-- UUIDv7 PKs, FKs, indexes, created/updated_at, RLS (auth + public for gallery), storage

-- 1. UUIDv7 generator (requires pgcrypto, usually enabled)
-- Provides time-sortable UUIDv7 primary keys for new feature tables.
-- Compatible with Postgres 15/16 on Supabase. Existing tables continue to use gen_random_uuid().
create extension if not exists pgcrypto;

create or replace function public.uuid_v7()
returns uuid
language plpgsql
as $$
declare
  unix_ts_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  uuid_bytes bytea := substring(int8send(unix_ts_ms) from 3 for 6) || gen_random_bytes(10);
begin
  -- version 7 in the high nibble of byte 6 (0-indexed: position 6)
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
  -- variant 10 in high bits of byte 8
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);
  return encode(uuid_bytes, 'hex')::uuid;
end;
$$;

-- Ensure set_updated_at function exists (from prior migrations)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================
-- MARKETPLACE: tradespeople etc
-- ============================================

create table if not exists public.tradespeople (
  id uuid primary key default public.uuid_v7(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  contact_name text not null,
  phone text,
  email text,
  postcode text,
  bio text,
  insurance_status text not null default 'unknown'
    check (insurance_status in ('unknown', 'insured', 'not_insured')),
  rating numeric(3,2) default 0.0,
  review_count integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tradespeople_user_id on public.tradespeople(user_id);

drop trigger if exists tradespeople_set_updated_at on public.tradespeople;
create trigger tradespeople_set_updated_at
  before update on public.tradespeople
  for each row execute function public.set_updated_at();

alter table public.tradespeople enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tradespeople'
      AND policyname = 'tradespeople_all_own'
  ) THEN
    create policy "tradespeople_all_own" on public.tradespeople for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "tradespeople_select_admin" ON public.tradespeople;
  CREATE POLICY "tradespeople_select_admin" ON public.tradespeople FOR SELECT USING (public.is_admin());
END
$$;

-- trade_specialties (junction)
create table if not exists public.trade_specialties (
  id uuid primary key default public.uuid_v7(),
  tradesperson_id uuid not null references public.tradespeople(id) on delete cascade,
  specialty text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_trade_specialties on public.trade_specialties (tradesperson_id, specialty);
create index if not exists idx_trade_specialties_tradesperson on public.trade_specialties(tradesperson_id);

drop trigger if exists trade_specialties_set_updated_at on public.trade_specialties;
create trigger trade_specialties_set_updated_at
  before update on public.trade_specialties
  for each row execute function public.set_updated_at();

alter table public.trade_specialties enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trade_specialties'
      AND policyname = 'trade_specialties_all_own'
  ) THEN
    create policy "trade_specialties_all_own" on public.trade_specialties for all
    using (exists (select 1 from public.tradespeople t where t.id = trade_specialties.tradesperson_id and t.user_id = auth.uid()))
    with check (exists (select 1 from public.tradespeople t where t.id = trade_specialties.tradesperson_id and t.user_id = auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "trade_specialties_select_admin" ON public.trade_specialties;
  CREATE POLICY "trade_specialties_select_admin" ON public.trade_specialties FOR SELECT USING (public.is_admin());
END
$$;

-- trade_favorites
create table if not exists public.trade_favorites (
  id uuid primary key default public.uuid_v7(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tradesperson_id uuid not null references public.tradespeople(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_trade_favorites on public.trade_favorites(user_id, tradesperson_id);
create index if not exists idx_trade_favorites_user on public.trade_favorites(user_id);

alter table public.trade_favorites enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trade_favorites'
      AND policyname = 'trade_favorites_all_own'
  ) THEN
    create policy "trade_favorites_all_own" on public.trade_favorites for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
  END IF;
END
$$;

-- quote_requests
create table if not exists public.quote_requests (
  id uuid primary key default public.uuid_v7(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tradesperson_id uuid not null references public.tradespeople(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'quoted', 'accepted', 'rejected', 'cancelled')),
  message text,
  proposed_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quote_requests_project on public.quote_requests(project_id);
create index if not exists idx_quote_requests_tradesperson on public.quote_requests(tradesperson_id);
create index if not exists idx_quote_requests_user on public.quote_requests(user_id);

drop trigger if exists quote_requests_set_updated_at on public.quote_requests;
create trigger quote_requests_set_updated_at
  before update on public.quote_requests
  for each row execute function public.set_updated_at();

alter table public.quote_requests enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quote_requests'
      AND policyname = 'quote_requests_all_own'
  ) THEN
    create policy "quote_requests_all_own" on public.quote_requests for all
    using (
      auth.uid() = user_id
      or exists (select 1 from public.tradespeople t where t.id = quote_requests.tradesperson_id and t.user_id = auth.uid())
    )
    with check (
      auth.uid() = user_id
      or exists (select 1 from public.tradespeople t where t.id = quote_requests.tradesperson_id and t.user_id = auth.uid())
    );
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "quote_requests_select_admin" ON public.quote_requests;
  CREATE POLICY "quote_requests_select_admin" ON public.quote_requests FOR SELECT USING (public.is_admin());
END
$$;

-- trade_messages
create table if not exists public.trade_messages (
  id uuid primary key default public.uuid_v7(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_trade_messages_quote_request on public.trade_messages(quote_request_id);

alter table public.trade_messages enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trade_messages'
      AND policyname = 'trade_messages_all_own'
  ) THEN
    create policy "trade_messages_all_own" on public.trade_messages for all
    using (
      exists (
        select 1 from public.quote_requests q
        where q.id = trade_messages.quote_request_id
          and (q.user_id = auth.uid() or exists (select 1 from public.tradespeople t where t.id = q.tradesperson_id and t.user_id = auth.uid()))
      )
    )
    with check (
      exists (
        select 1 from public.quote_requests q
        where q.id = trade_messages.quote_request_id
          and (q.user_id = auth.uid() or exists (select 1 from public.tradespeople t where t.id = q.tradesperson_id and t.user_id = auth.uid()))
      )
    );
  END IF;
END
$$;

-- ============================================
-- 3D FLOORPLAN
-- ============================================

create table if not exists public.floorplan_models (
  id uuid primary key default public.uuid_v7(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Floorplan',
  model_url text,
  metadata jsonb default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'processing', 'ready', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_floorplan_models_project on public.floorplan_models(project_id);
create index if not exists idx_floorplan_models_user on public.floorplan_models(user_id);

drop trigger if exists floorplan_models_set_updated_at on public.floorplan_models;
create trigger floorplan_models_set_updated_at
  before update on public.floorplan_models
  for each row execute function public.set_updated_at();

alter table public.floorplan_models enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'floorplan_models'
      AND policyname = 'floorplan_models_all_own'
  ) THEN
    create policy "floorplan_models_all_own" on public.floorplan_models for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "floorplan_models_select_admin" ON public.floorplan_models;
  CREATE POLICY "floorplan_models_select_admin" ON public.floorplan_models FOR SELECT USING (public.is_admin());
END
$$;

-- floorplan_annotations
create table if not exists public.floorplan_annotations (
  id uuid primary key default public.uuid_v7(),
  model_id uuid not null references public.floorplan_models(id) on delete cascade,
  annotation_type text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_floorplan_annotations_model on public.floorplan_annotations(model_id);

drop trigger if exists floorplan_annotations_set_updated_at on public.floorplan_annotations;
create trigger floorplan_annotations_set_updated_at
  before update on public.floorplan_annotations
  for each row execute function public.set_updated_at();

alter table public.floorplan_annotations enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'floorplan_annotations'
      AND policyname = 'floorplan_annotations_all_own'
  ) THEN
    create policy "floorplan_annotations_all_own" on public.floorplan_annotations for all
    using (exists (select 1 from public.floorplan_models m where m.id = floorplan_annotations.model_id and m.user_id = auth.uid()))
    with check (exists (select 1 from public.floorplan_models m where m.id = floorplan_annotations.model_id and m.user_id = auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "floorplan_annotations_select_admin" ON public.floorplan_annotations;
  CREATE POLICY "floorplan_annotations_select_admin" ON public.floorplan_annotations FOR SELECT USING (public.is_admin());
END
$$;

-- floorplan_measurements
create table if not exists public.floorplan_measurements (
  id uuid primary key default public.uuid_v7(),
  model_id uuid not null references public.floorplan_models(id) on delete cascade,
  measurement_type text not null,
  value numeric not null,
  unit text not null default 'm',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_floorplan_measurements_model on public.floorplan_measurements(model_id);

drop trigger if exists floorplan_measurements_set_updated_at on public.floorplan_measurements;
create trigger floorplan_measurements_set_updated_at
  before update on public.floorplan_measurements
  for each row execute function public.set_updated_at();

alter table public.floorplan_measurements enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'floorplan_measurements'
      AND policyname = 'floorplan_measurements_all_own'
  ) THEN
    create policy "floorplan_measurements_all_own" on public.floorplan_measurements for all
    using (exists (select 1 from public.floorplan_models m where m.id = floorplan_measurements.model_id and m.user_id = auth.uid()))
    with check (exists (select 1 from public.floorplan_models m where m.id = floorplan_measurements.model_id and m.user_id = auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "floorplan_measurements_select_admin" ON public.floorplan_measurements;
  CREATE POLICY "floorplan_measurements_select_admin" ON public.floorplan_measurements FOR SELECT USING (public.is_admin());
END
$$;

-- ============================================
-- PHOTO ANALYSIS
-- ============================================

create table if not exists public.photo_analysis_results (
  id uuid primary key default public.uuid_v7(),
  project_id uuid not null references public.projects(id) on delete cascade,
  photo_id uuid references public.photos(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_data jsonb not null default '{}',
  confidence numeric(5,2),
  source text not null default 'ai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_photo_analysis_results_project on public.photo_analysis_results(project_id);
create index if not exists idx_photo_analysis_results_photo on public.photo_analysis_results(photo_id);

drop trigger if exists photo_analysis_results_set_updated_at on public.photo_analysis_results;
create trigger photo_analysis_results_set_updated_at
  before update on public.photo_analysis_results
  for each row execute function public.set_updated_at();

alter table public.photo_analysis_results enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'photo_analysis_results'
      AND policyname = 'photo_analysis_results_all_own'
  ) THEN
    create policy "photo_analysis_results_all_own" on public.photo_analysis_results for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "photo_analysis_results_select_admin" ON public.photo_analysis_results;
  CREATE POLICY "photo_analysis_results_select_admin" ON public.photo_analysis_results FOR SELECT USING (public.is_admin());
END
$$;

-- ============================================
-- PITCH DECK
-- ============================================

create table if not exists public.pitch_deck_exports (
  id uuid primary key default public.uuid_v7(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  export_url text,
  format text not null default 'pdf',
  file_size_bytes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pitch_deck_exports_project on public.pitch_deck_exports(project_id);
create index if not exists idx_pitch_deck_exports_user on public.pitch_deck_exports(user_id);

drop trigger if exists pitch_deck_exports_set_updated_at on public.pitch_deck_exports;
create trigger pitch_deck_exports_set_updated_at
  before update on public.pitch_deck_exports
  for each row execute function public.set_updated_at();

alter table public.pitch_deck_exports enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pitch_deck_exports'
      AND policyname = 'pitch_deck_exports_all_own'
  ) THEN
    create policy "pitch_deck_exports_all_own" on public.pitch_deck_exports for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "pitch_deck_exports_select_admin" ON public.pitch_deck_exports;
  CREATE POLICY "pitch_deck_exports_select_admin" ON public.pitch_deck_exports FOR SELECT USING (public.is_admin());
END
$$;

-- ============================================
-- PUBLIC GALLERY + LEADS
-- ============================================

create table if not exists public.public_gallery_projects (
  id uuid primary key default public.uuid_v7(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  is_public boolean not null default false,
  featured boolean not null default false,
  title text,
  description text,
  cover_image_url text,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_public_gallery_projects_public on public.public_gallery_projects(is_public, featured);
create index if not exists idx_public_gallery_projects_project on public.public_gallery_projects(project_id);

drop trigger if exists public_gallery_projects_set_updated_at on public.public_gallery_projects;
create trigger public_gallery_projects_set_updated_at
  before update on public.public_gallery_projects
  for each row execute function public.set_updated_at();

alter table public.public_gallery_projects enable row level security;

-- Public read for gallery (even anon)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'public_gallery_projects'
      AND policyname = 'public_gallery_projects_public_read'
  ) THEN
    create policy "public_gallery_projects_public_read" on public.public_gallery_projects for select
    using (is_public);
  END IF;
END
$$;

-- Owners can manage their gallery entries (via project ownership)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'public_gallery_projects'
      AND policyname = 'public_gallery_projects_owner_manage'
  ) THEN
    create policy "public_gallery_projects_owner_manage" on public.public_gallery_projects for all
    using (auth.uid() = (select p.user_id from public.projects p where p.id = public_gallery_projects.project_id))
    with check (auth.uid() = (select p.user_id from public.projects p where p.id = public_gallery_projects.project_id));
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "public_gallery_projects_select_admin" ON public.public_gallery_projects;
  CREATE POLICY "public_gallery_projects_select_admin" ON public.public_gallery_projects FOR SELECT USING (public.is_admin());
END
$$;

-- investor_leads (from gallery, public can submit)
create table if not exists public.investor_leads (
  id uuid primary key default public.uuid_v7(),
  gallery_project_id uuid not null references public.public_gallery_projects(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_investor_leads_gallery on public.investor_leads(gallery_project_id);

alter table public.investor_leads enable row level security;

-- Public/anon can insert leads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'investor_leads'
      AND policyname = 'investor_leads_insert_public'
  ) THEN
    create policy "investor_leads_insert_public" on public.investor_leads for insert
    with check (true);
  END IF;
END
$$;

-- Owners (via gallery project) can view leads for their projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'investor_leads'
      AND policyname = 'investor_leads_select_owner'
  ) THEN
    create policy "investor_leads_select_owner" on public.investor_leads for select
    using (
      exists (
        select 1
        from public.public_gallery_projects g
        join public.projects p on p.id = g.project_id
        where g.id = investor_leads.gallery_project_id
          and p.user_id = auth.uid()
      )
    );
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "investor_leads_select_admin" ON public.investor_leads;
  CREATE POLICY "investor_leads_select_admin" ON public.investor_leads FOR SELECT USING (public.is_admin());
END
$$;

-- ============================================
-- STORAGE BUCKETS AND POLICIES
-- ============================================

-- Buckets (idempotent)
insert into storage.buckets (id, name, public)
values
  ('floorplans', 'floorplans', false),
  ('pitch-decks', 'pitch-decks', false),
  ('gallery', 'gallery', true)
on conflict (id) do nothing;

-- floorplans bucket (private, owner scoped folders e.g. {user_id}/{project_id}/...)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'floorplans_select_own'
  ) THEN
    create policy "floorplans_select_own" on storage.objects for select
    using (
      bucket_id = 'floorplans'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'floorplans_insert_own'
  ) THEN
    create policy "floorplans_insert_own" on storage.objects for insert
    with check (
      bucket_id = 'floorplans'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'floorplans_delete_own'
  ) THEN
    create policy "floorplans_delete_own" on storage.objects for delete
    using (
      bucket_id = 'floorplans'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;

-- pitch-decks bucket (private)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'pitch_decks_select_own'
  ) THEN
    create policy "pitch_decks_select_own" on storage.objects for select
    using (
      bucket_id = 'pitch-decks'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'pitch_decks_insert_own'
  ) THEN
    create policy "pitch_decks_insert_own" on storage.objects for insert
    with check (
      bucket_id = 'pitch-decks'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'pitch_decks_delete_own'
  ) THEN
    create policy "pitch_decks_delete_own" on storage.objects for delete
    using (
      bucket_id = 'pitch-decks'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;

-- gallery bucket (public read, owner write)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'gallery_select_public'
  ) THEN
    create policy "gallery_select_public" on storage.objects for select
    using (bucket_id = 'gallery');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'gallery_insert_own'
  ) THEN
    create policy "gallery_insert_own" on storage.objects for insert
    with check (
      bucket_id = 'gallery'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'gallery_delete_own'
  ) THEN
    create policy "gallery_delete_own" on storage.objects for delete
    using (
      bucket_id = 'gallery'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;

-- Note: Admin can be added similarly if needed via is_admin() but storage policies usually owner focused.

-- End of migration
