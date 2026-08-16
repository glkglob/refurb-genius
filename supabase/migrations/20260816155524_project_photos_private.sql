-- R1F: project-photos visibility cutover.
-- Owner Storage policies, gallery bucket, objects, and photos rows are unchanged.

update storage.buckets
set public = false
where id = 'project-photos';
