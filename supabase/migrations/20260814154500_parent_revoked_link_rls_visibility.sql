begin;

drop policy if exists "parents can view own links" on public.parent_student_links;
create policy "parents can view own links" on public.parent_student_links
for select to authenticated
using (parent_id = auth.uid() and coalesce(access_level, 'full') <> 'none');

commit;
