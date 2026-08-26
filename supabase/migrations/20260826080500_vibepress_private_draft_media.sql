-- Private staging for VibePress media. Draft assets are never publicly readable.
-- Published assets continue to use the existing public buckets so current URLs stay valid.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vibe-publication-drafts',
  'vibe-publication-drafts',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vibe_publication_drafts_owner_select" on storage.objects;
drop policy if exists "vibe_publication_drafts_owner_insert" on storage.objects;
drop policy if exists "vibe_publication_drafts_owner_update" on storage.objects;
drop policy if exists "vibe_publication_drafts_owner_delete" on storage.objects;

create policy "vibe_publication_drafts_owner_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vibe-publication-drafts'
  and owner = (select auth.uid())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "vibe_publication_drafts_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vibe-publication-drafts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "vibe_publication_drafts_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vibe-publication-drafts'
  and owner = (select auth.uid())
)
with check (
  bucket_id = 'vibe-publication-drafts'
  and owner = (select auth.uid())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "vibe_publication_drafts_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vibe-publication-drafts'
  and owner = (select auth.uid())
);
