
-- Ensure transition from public-read to owner-only read for project photos (historical intent of this migration).
-- Drop is idempotent; the create of replacement is guarded.
DROP POLICY IF EXISTS "project_photos_read_public" ON storage.objects;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
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

revoke execute on function public.handle_new_user() from public, anon, authenticated;
