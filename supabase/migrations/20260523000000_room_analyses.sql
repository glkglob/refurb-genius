create table if not exists room_analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null,
  photo_id uuid references photos(id) on delete set null,
  photo_url text not null,
  photo_name text not null,
  room_type text not null,
  condition_level text not null,
  refurbishment_level text not null,
  visible_issues jsonb not null default '[]',
  recommended_works jsonb not null default '[]',
  ai_summary text not null default '',
  confidence_score real not null default 0,
  created_at timestamptz not null default now()
);

alter table room_analyses enable row level security;

-- Idempotent policy creation (prevents "policy already exists" errors on re-apply,
-- db resets, supabase db push, or partial state recovery). Safe for prod + dev.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'room_analyses'
      AND policyname = 'Users can view their own analyses'
  ) THEN
    CREATE POLICY "Users can view their own analyses"
      ON public.room_analyses FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'room_analyses'
      AND policyname = 'Users can insert their own analyses'
  ) THEN
    CREATE POLICY "Users can insert their own analyses"
      ON public.room_analyses FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'room_analyses'
      AND policyname = 'Users can delete their own analyses'
  ) THEN
    CREATE POLICY "Users can delete their own analyses"
      ON public.room_analyses FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

create index idx_room_analyses_project on room_analyses(project_id);
