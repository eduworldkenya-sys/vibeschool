-- Harden public VibePress media without changing public read behavior.
-- Writers keep direct authenticated uploads, but both cover and article media
-- are constrained to the writer's own top-level folder.

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']::text[]
where id in ('vibe-publication-images','vibe-publication-covers');

drop policy if exists "Authenticated upload vibe covers" on storage.objects;
drop policy if exists "vibe_publication_covers_authenticated_insert" on storage.objects;
drop policy if exists "vibe_publication_covers_owner_update" on storage.objects;
drop policy if exists "vibe_publication_covers_owner_delete" on storage.objects;

create policy "vibe_publication_covers_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vibe-publication-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "vibe_publication_covers_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vibe-publication-covers'
  and owner = (select auth.uid())
)
with check (
  bucket_id = 'vibe-publication-covers'
  and owner = (select auth.uid())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "vibe_publication_covers_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vibe-publication-covers'
  and owner = (select auth.uid())
);
