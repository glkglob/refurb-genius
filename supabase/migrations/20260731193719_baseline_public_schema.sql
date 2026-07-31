-- Issue #90 — Baseline remote-only public tables for local migration reproducibility.
--
-- Creates five public tables already represented in
-- packages/supabase/src/database.types.ts but missing from a clean
-- `supabase db reset` chain:
--   analysis_jobs
--   scope_analyses
--   scope_analysis_rooms
--   scope_analysis_issues
--   scope_analysis_items
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + scoped constraint guards.
-- Does not DROP, mutate, or seed data. No RLS, grants, triggers, or indexes.
-- Local development only; do not apply to production without schema-owner review.

-- ────────────────────────────────────────────────────────────────────
-- analysis_jobs
-- Relationships: none (no public FK declared in database.types.ts)
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_payload jsonb NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  failed_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────
-- scope_analyses
-- Relationships: scope_analyses_property_id_fkey → projects(id)
-- property_id is NOT NULL in the canonical Row/Insert contract.
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scope_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id uuid NOT NULL,
  overall_score numeric NOT NULL DEFAULT 0,
  region text NULL,
  notes text NULL,
  summary text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.scope_analyses') IS NOT NULL
     AND to_regclass('public.projects') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'scope_analyses_property_id_fkey'
         AND conrelid = 'public.scope_analyses'::regclass
     )
  THEN
    ALTER TABLE public.scope_analyses
      ADD CONSTRAINT scope_analyses_property_id_fkey
      FOREIGN KEY (property_id)
      REFERENCES public.projects(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────────────
-- scope_analysis_rooms
-- Relationships: scope_analysis_rooms_scope_analysis_id_fkey → scope_analyses(id)
-- Cascade required: application deletes analysis and expects rooms to follow.
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scope_analysis_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_analysis_id uuid NOT NULL,
  room_name text NOT NULL,
  area_sqm numeric NULL,
  condition_summary text NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.scope_analysis_rooms') IS NOT NULL
     AND to_regclass('public.scope_analyses') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'scope_analysis_rooms_scope_analysis_id_fkey'
         AND conrelid = 'public.scope_analysis_rooms'::regclass
     )
  THEN
    ALTER TABLE public.scope_analysis_rooms
      ADD CONSTRAINT scope_analysis_rooms_scope_analysis_id_fkey
      FOREIGN KEY (scope_analysis_id)
      REFERENCES public.scope_analyses(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────────────
-- scope_analysis_issues
-- Relationships: scope_analysis_issues_room_id_fkey → scope_analysis_rooms(id)
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scope_analysis_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  description text NOT NULL,
  category text NULL,
  severity text NULL,
  recommended_action text NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.scope_analysis_issues') IS NOT NULL
     AND to_regclass('public.scope_analysis_rooms') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'scope_analysis_issues_room_id_fkey'
         AND conrelid = 'public.scope_analysis_issues'::regclass
     )
  THEN
    ALTER TABLE public.scope_analysis_issues
      ADD CONSTRAINT scope_analysis_issues_room_id_fkey
      FOREIGN KEY (room_id)
      REFERENCES public.scope_analysis_rooms(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────────────
-- scope_analysis_items
-- Relationships: scope_analysis_items_room_id_fkey → scope_analysis_rooms(id)
-- base_unit_cost / quantity are NOT NULL with defaults (optional on Insert).
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scope_analysis_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  name text NOT NULL,
  category text NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NULL,
  base_unit_cost numeric NOT NULL DEFAULT 0,
  notes text NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.scope_analysis_items') IS NOT NULL
     AND to_regclass('public.scope_analysis_rooms') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'scope_analysis_items_room_id_fkey'
         AND conrelid = 'public.scope_analysis_items'::regclass
     )
  THEN
    ALTER TABLE public.scope_analysis_items
      ADD CONSTRAINT scope_analysis_items_room_id_fkey
      FOREIGN KEY (room_id)
      REFERENCES public.scope_analysis_rooms(id)
      ON DELETE CASCADE;
  END IF;
END
$$;
