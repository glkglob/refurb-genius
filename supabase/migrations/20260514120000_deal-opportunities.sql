create table if not exists public.deal_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  listing_url text,
  postcode text,
  property_type text,
  bedrooms integer,
  purchase_price numeric,
  estimated_gdv numeric,
  expected_monthly_rent numeric,
  refurb_budget numeric,
  target_exit_strategy text,
  status text not null default 'sourced' check (
    status in ('sourced', 'underwriting', 'watchlist', 'offer', 'won', 'lost', 'rejected')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deal_opportunities enable row level security;

-- Idempotent policy creation (DO $$ IF NOT EXISTS via pg_policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deal_opportunities'
      AND policyname = 'deal_opps_all_own'
  ) THEN
    create policy "deal_opps_all_own" on public.deal_opportunities
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deal_opportunities'
      AND policyname = 'deal_opps_select_admin'
  ) THEN
    create policy "deal_opps_select_admin"
      on public.deal_opportunities for select
      using (public.is_admin());
  END IF;
END
$$;

create index if not exists deal_opportunities_user_id_created_at_idx
  on public.deal_opportunities(user_id, created_at desc);
