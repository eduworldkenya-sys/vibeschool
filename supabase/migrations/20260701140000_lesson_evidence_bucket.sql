insert into storage.buckets (id, name, public)
values ('lesson-evidence', 'lesson-evidence', true)
on conflict (id) do nothing;

drop policy if exists "teacher uploads own evidence photos" on storage.objects;
create policy "teacher uploads own evidence photos"
  on storage.objects for insert
  with check (
    bucket_id = 'lesson-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "teacher updates own evidence photos" on storage.objects;
create policy "teacher updates own evidence photos"
  on storage.objects for update
  using (
    bucket_id = 'lesson-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "anyone reads evidence photos" on storage.objects;
create policy "anyone reads evidence photos"
  on storage.objects for select
  using (bucket_id = 'lesson-evidence');
