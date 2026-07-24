-- Map optional company from signup user metadata into profiles.company.
-- AuthExperience stores the field as raw_user_meta_data.company_name;
-- profiles.company already exists but handle_new_user never populated it.

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
