
drop policy if exists "project_photos_read_public" on storage.objects;
create policy "project_photos_read_own"
on storage.objects for select
using (
  bucket_id = 'project-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

revoke execute on function public.handle_new_user() from public, anon, authenticated;
