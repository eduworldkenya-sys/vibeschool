-- Optional Mini Lesson voice. Legacy photo-only rows are unchanged.
alter table public.mini_lessons
  add column audio_path text,
  add column audio_sha256 text,
  add constraint mini_voice_path_owned check (
    audio_path is null or (
      split_part(audio_path,'/',1)=creator_id::text
      and audio_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.wav$'
    )
  ),
  add constraint mini_voice_hash_valid check (
    audio_sha256 is null or (audio_path is not null and audio_sha256 ~ '^[a-f0-9]{64}$')
  ),
  add constraint mini_voice_approved_scanned check (
    status <> 'approved' or audio_path is null or audio_sha256 is not null
  );
create unique index mini_voice_unique_path on public.mini_lessons(audio_path) where audio_path is not null;
-- Creator can attach exactly once at insertion; cannot update either field.
grant insert(audio_path) on public.mini_lessons to authenticated;
revoke insert(audio_sha256), update(audio_path,audio_sha256) on public.mini_lessons from anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mini-voice','mini-voice',false,1920044,array['audio/wav']);
create policy mini_voice_owner_upload on storage.objects for insert to authenticated
with check (bucket_id='mini-voice' and split_part(name,'/',1)=(select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.wav$'
 and public.mini_creator_can_submit((select auth.uid())));
create policy mini_voice_read on storage.objects for select to anon,authenticated
using (bucket_id='mini-voice' and (
 split_part(name,'/',1)=(select auth.uid())::text
 or exists(select 1 from public.mini_lessons m
   where m.audio_path=storage.objects.name and m.status='approved'
   and m.audio_sha256 is not null and public.mini_creator_public(m.creator_id))
));
create policy mini_voice_remove_unused on storage.objects for delete to authenticated
using (bucket_id='mini-voice' and split_part(name,'/',1)=(select auth.uid())::text
 and not exists(select 1 from public.mini_lessons m where m.audio_path=storage.objects.name));
-- No client UPDATE policy: scanned objects are immutable.
comment on column public.mini_lessons.audio_sha256 is 'Service-only hash of the exact immutable bytes that passed automated speech and text screening.';
