-- 1. Add role column to profiles with constrained values
alter table public.profiles
  add column role text not null default 'user'
  check (role in ('user', 'admin'));

-- 2. Backfill any existing profiles (default covers new rows; explicit for safety)
update public.profiles set role = 'user' where role <> 'admin';

-- 3. Update new-user trigger to explicitly insert role = 'user'
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 4. Security-definer helper: returns true when the calling user has role = 'admin'
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 5. Admin read-only RLS policies for all user-owned tables
--    Admins can SELECT any row; existing own-row policies still cover writes.
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

create policy "projects_select_admin"
  on public.projects for select
  using (public.is_admin());

create policy "photos_select_admin"
  on public.photos for select
  using (public.is_admin());

create policy "redesign_select_admin"
  on public.redesign_concepts for select
  using (public.is_admin());

create policy "estimates_select_admin"
  on public.estimates for select
  using (public.is_admin());

create policy "estimate_items_select_admin"
  on public.estimate_items for select
  using (public.is_admin());
