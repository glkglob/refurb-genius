-- Feasibility studies foundation
-- Immutable studies via snapshot append-only records.

create extension if not exists pgcrypto;

create table if not exists public.feasibility_studies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'complete', 'shared', 'archived')),
  current_snapshot_version integer not null default 1,
  title text,
  last_computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feasibility_studies_project on public.feasibility_studies(project_id);
create index if not exists idx_feasibility_studies_user on public.feasibility_studies(user_id);
create index if not exists idx_feasibility_studies_status on public.feasibility_studies(status);

drop trigger if exists feasibility_studies_set_updated_at on public.feasibility_studies;
create trigger feasibility_studies_set_updated_at
  before update on public.feasibility_studies
  for each row execute function public.set_updated_at();

alter table public.feasibility_studies enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feasibility_studies'
      AND policyname = 'feasibility_studies_all_own'
  ) THEN
    CREATE POLICY "feasibility_studies_all_own" ON public.feasibility_studies FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "feasibility_studies_select_admin" ON public.feasibility_studies;
  CREATE POLICY "feasibility_studies_select_admin" ON public.feasibility_studies FOR SELECT
    USING (public.is_admin());
END
$$;

create table if not exists public.study_snapshots (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.feasibility_studies(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (study_id, version)
);

create index if not exists idx_study_snapshots_study on public.study_snapshots(study_id, version desc);

alter table public.study_snapshots enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'study_snapshots'
      AND policyname = 'study_snapshots_all_own'
  ) THEN
    CREATE POLICY "study_snapshots_all_own" ON public.study_snapshots FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.feasibility_studies fs
          WHERE fs.id = study_snapshots.study_id
            AND fs.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.feasibility_studies fs
          WHERE fs.id = study_snapshots.study_id
            AND fs.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "study_snapshots_select_admin" ON public.study_snapshots;
  CREATE POLICY "study_snapshots_select_admin" ON public.study_snapshots FOR SELECT
    USING (public.is_admin());
END
$$;

create table if not exists public.study_exports (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.feasibility_studies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  export_type text not null check (export_type in ('project-report', 'pitch-deck', 'feasibility-study')),
  status text not null default 'queued' check (status in ('queued', 'generating', 'completed', 'failed')),
  storage_path text,
  error_message text,
  queued_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_study_exports_study on public.study_exports(study_id, queued_at desc);
create index if not exists idx_study_exports_user on public.study_exports(user_id, queued_at desc);

alter table public.study_exports enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'study_exports'
      AND policyname = 'study_exports_all_own'
  ) THEN
    CREATE POLICY "study_exports_all_own" ON public.study_exports FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "study_exports_select_admin" ON public.study_exports;
  CREATE POLICY "study_exports_select_admin" ON public.study_exports FOR SELECT
    USING (public.is_admin());
END
$$;

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.feasibility_studies(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  access_role text not null default 'investor' check (access_role in ('investor', 'lender', 'jv')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_share_links_owner on public.share_links(owner_user_id, created_at desc);
create index if not exists idx_share_links_study on public.share_links(study_id, created_at desc);
create index if not exists idx_share_links_token on public.share_links(token);

alter table public.share_links enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'share_links'
      AND policyname = 'share_links_all_own'
  ) THEN
    CREATE POLICY "share_links_all_own" ON public.share_links FOR ALL
      USING (auth.uid() = owner_user_id)
      WITH CHECK (auth.uid() = owner_user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'share_links'
      AND policyname = 'share_links_public_token_read'
  ) THEN
    CREATE POLICY "share_links_public_token_read" ON public.share_links FOR SELECT
      USING (
        revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
        AND visibility = 'public'
      );
  END IF;
END
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "share_links_select_admin" ON public.share_links;
  CREATE POLICY "share_links_select_admin" ON public.share_links FOR SELECT
    USING (public.is_admin());
END
$$;
