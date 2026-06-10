-- Re-ensure the project-photos bucket and its storage policies.
-- The original bucket creation (20260508155054) is recorded as applied on the
-- linked project but the bucket there was left private, so every
-- getPublicUrl() photo URL fails with "Bucket not found". Everything below is
-- idempotent.

insert into storage.buckets (id, name, public)
values ('project-photos', 'project-photos', true)
on conflict (id) do nothing;

-- The app renders photos via storage.getPublicUrl(), which only works when the
-- bucket is public (private buckets return "Bucket not found" on the public
-- object endpoint). The original migration created the bucket public; re-assert
-- it in case the flag was flipped out-of-band.
update storage.buckets set public = true
where id = 'project-photos' and public = false;

-- Owner-only read (20260508155119 replaced the public-read policy with this).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'project_photos_read_own'
  ) THEN
    create policy "project_photos_read_own"
    on storage.objects for select
    using (
      bucket_id = 'project-photos'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'project_photos_insert_own'
  ) THEN
    create policy "project_photos_insert_own"
    on storage.objects for insert
    with check (
      bucket_id = 'project-photos'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'project_photos_update_own'
  ) THEN
    create policy "project_photos_update_own"
    on storage.objects for update
    using (
      bucket_id = 'project-photos'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'project_photos_delete_own'
  ) THEN
    create policy "project_photos_delete_own"
    on storage.objects for delete
    using (
      bucket_id = 'project-photos'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;
