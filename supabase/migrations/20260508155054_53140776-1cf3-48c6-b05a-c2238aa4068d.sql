
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  company text,
  default_region text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profile_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profile_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profile_update_own" on public.profiles for update using (auth.uid() = id);

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text not null default '',
  postcode text not null default '',
  region text not null,
  property_type text not null,
  bedrooms int not null default 0,
  bathrooms int not null default 0,
  size_sqm numeric not null default 0,
  purchase_price numeric not null default 0,
  estimated_gdv numeric not null default 0,
  notes text not null default '',
  status text not null default 'Draft',
  photos_done boolean not null default false,
  analysis_done boolean not null default false,
  estimate_done boolean not null default false,
  report_done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "projects_all_own" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index projects_user_id_idx on public.projects(user_id, created_at desc);

-- Photos
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  url text not null,
  name text not null,
  size int not null default 0,
  uploaded_at timestamptz not null default now()
);
alter table public.photos enable row level security;
create policy "photos_all_own" on public.photos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index photos_project_idx on public.photos(project_id, uploaded_at);

-- Redesign concepts
create table public.redesign_concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  style text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.redesign_concepts enable row level security;
create policy "redesign_all_own" on public.redesign_concepts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index redesign_project_idx on public.redesign_concepts(project_id);

-- Estimates
create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  region text not null,
  condition_level text not null,
  finish_level text not null,
  labour_total numeric not null default 0,
  materials_total numeric not null default 0,
  subtotal numeric not null default 0,
  contingency numeric not null default 0,
  vat numeric not null default 0,
  mid_total numeric not null default 0,
  low_total numeric not null default 0,
  high_total numeric not null default 0,
  timeline_weeks numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table public.estimates enable row level security;
create policy "estimates_all_own" on public.estimates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index estimates_project_idx on public.estimates(project_id, created_at desc);

-- Estimate items
create table public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  labour numeric not null default 0,
  materials numeric not null default 0,
  total numeric not null default 0,
  weeks numeric not null default 0
);
alter table public.estimate_items enable row level security;
create policy "estimate_items_all_own" on public.estimate_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index estimate_items_estimate_idx on public.estimate_items(estimate_id);

-- Storage bucket for photos
insert into storage.buckets (id, name, public)
values ('project-photos', 'project-photos', true)
on conflict (id) do nothing;

create policy "project_photos_read_public"
on storage.objects for select
using (bucket_id = 'project-photos');

create policy "project_photos_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'project-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "project_photos_update_own"
on storage.objects for update
using (
  bucket_id = 'project-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "project_photos_delete_own"
on storage.objects for delete
using (
  bucket_id = 'project-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
