-- Map optional company from signup user metadata into profiles.company.
-- AuthExperience stores the field as raw_user_meta_data.company_name.
--
-- Ensure the column exists before any reference. The initial baseline migration
-- defines company on clean replay, but production/preview clones have drifted
-- (profiles lacked company). ADD COLUMN IF NOT EXISTS is idempotent with the
-- live direct repair and with clean migration history that already has company.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, company, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    nullif(
      trim(
        coalesce(
          new.raw_user_meta_data->>'company_name',
          new.raw_user_meta_data->>'company',
          ''
        )
      ),
      ''
    ),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Best-effort backfill for users who already signed up with company_name in metadata.
-- Only fills NULL company; preserves existing non-null values. Blank metadata ignored.
update public.profiles p
set company = nullif(
  trim(
    coalesce(
      u.raw_user_meta_data->>'company_name',
      u.raw_user_meta_data->>'company',
      ''
    )
  ),
  ''
)
from auth.users u
where p.id = u.id
  and p.company is null
  and nullif(
    trim(
      coalesce(
        u.raw_user_meta_data->>'company_name',
        u.raw_user_meta_data->>'company',
        ''
      )
    ),
    ''
  ) is not null;
