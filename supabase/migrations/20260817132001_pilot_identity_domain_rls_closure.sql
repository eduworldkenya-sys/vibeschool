-- Close remaining proven RLS identity-domain mismatches where student_id references public.students(id).

drop policy if exists join_requests_student_insert on public.class_join_requests;
drop policy if exists join_requests_student_read on public.class_join_requests;
create policy join_requests_student_insert on public.class_join_requests for insert to authenticated
with check (exists (select 1 from public.students s where s.id=class_join_requests.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null));
create policy join_requests_student_read on public.class_join_requests for select to authenticated
using (exists (select 1 from public.students s where s.id=class_join_requests.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null));

drop policy if exists project_submissions_student_insert on public.project_submissions;
drop policy if exists project_submissions_student_read on public.project_submissions;
create policy project_submissions_student_insert on public.project_submissions for insert to authenticated
with check (exists (select 1 from public.students s where s.id=project_submissions.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null));
create policy project_submissions_student_read on public.project_submissions for select to authenticated
using (exists (select 1 from public.students s where s.id=project_submissions.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null));

drop policy if exists "Students view their class homework" on public.homework;
create policy "Students view their class homework" on public.homework for select to authenticated
using (exists (
  select 1 from public.students s
  join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
  where s.profile_id=(select auth.uid()) and s.deleted_at is null and sc.class_id=homework.class_id
));

do $$
begin
 if exists (
   select 1 from pg_policies p
   where p.schemaname='public'
     and p.tablename <> 'vibelearn_content_saves'
     and (coalesce(p.qual,'') ilike '%student_id = auth.uid()%'
          or coalesce(p.with_check,'') ilike '%student_id = auth.uid()%')
 ) then
   raise exception 'student/profile identity-domain RLS mismatch remains';
 end if;
end $$;
