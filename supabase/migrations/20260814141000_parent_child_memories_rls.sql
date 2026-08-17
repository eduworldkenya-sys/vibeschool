begin;

alter table public.child_media enable row level security;

create policy parent_child_media_select on public.child_media for select to authenticated
using (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_media.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_child_media_insert on public.child_media for insert to authenticated
with check (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_media.student_id and coalesce(psl.access_level,'full') = 'full'));

create policy parent_child_media_update on public.child_media for update to authenticated
using (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_media.student_id and coalesce(psl.access_level,'full') = 'full'))
with check (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_media.student_id and coalesce(psl.access_level,'full') = 'full'));

commit;
