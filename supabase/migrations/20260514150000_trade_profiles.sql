-- Trade profiles for tradespeople
create table if not exists public.trade_profiles (
  user_id          uuid        primary key references auth.users(id) on delete cascade,
  business_name    text        not null,
  contact_name     text        not null,
  phone            text,
  postcode         text,
  trade_categories text[]      not null default '{}',
  bio              text,
  insurance_status text        not null default 'unknown'
                               check (insurance_status in ('unknown', 'insured', 'not_insured')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trade_profiles_updated_at on public.trade_profiles;
create trigger trade_profiles_updated_at
  before update on public.trade_profiles
  for each row execute procedure public.set_updated_at();

-- Row Level Security
alter table public.trade_profiles enable row level security;

-- Any authenticated user can read profiles
create policy "Authenticated users can view trade profiles"
  on public.trade_profiles for select
  to authenticated
  using (true);

-- Users manage their own profile
create policy "Users can insert own trade profile"
  on public.trade_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own trade profile"
  on public.trade_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own trade profile"
  on public.trade_profiles for delete
  to authenticated
  using (auth.uid() = user_id);
