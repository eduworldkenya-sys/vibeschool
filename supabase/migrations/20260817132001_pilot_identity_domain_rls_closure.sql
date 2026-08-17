-- Close remaining proven RLS identity-domain mismatches.
--
-- Blank-rebuild prelude: production already contained class_join_requests when
-- this version ran, but no tracked CREATE TABLE exists. Keep the prerequisite
-- inside this already-applied production migration version so GitHub can replay
-- production without creating a future production-push obligation.
-- authorization-test: public.class_join_requests

create table if not exists public.class_join_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  class_id uuid not null references public.classes(id),
  parent_id uuid not null references public.profiles(id),
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.class_join_requests enable row level security;
revoke all privileges on table public.class_join_requests from anon, authenticated;
grant select, insert, update on table public.class_join_requests to authenticated;
grant all privileges on table public.class_join_requests to service_role;

-- Reconstruct the non-learner policies that predated the recovered closure.
drop policy if exists join_requests_admin on public.class_join_requests;
create policy join_requests_admin
on public.class_join_requests
for all to authenticated
using (
  exists (
    select 1 from public.classes c
    where c.id=class_join_requests.class_id
      and public.is_school_admin(c.school_id)
  )
)
with check (
  exists (
    select 1 from public.classes c
    where c.id=class_join_requests.class_id
      and public.is_school_admin(c.school_id)
  )
);

drop policy if exists join_requests_parent_insert on public.class_join_requests;
create policy join_requests_parent_insert
on public.class_join_requests
for insert to authenticated
with check (parent_id=(select auth.uid()));

drop policy if exists join_requests_parent_read on public.class_join_requests;
create policy join_requests_parent_read
on public.class_join_requests
for select to authenticated
using (parent_id=(select auth.uid()));

-- Transitional compatibility: production still has 40 legacy class.teacher_id
-- assignments but only 6 equivalent teacher_classes.is_class_teacher rows.
-- Retain the legacy class-teacher authority until a separately certified
-- assignment backfill can replace it without locking real teachers out.
drop policy if exists join_requests_teacher on public.class_join_requests;
create policy join_requests_teacher
on public.class_join_requests
for all to authenticated
using (
  exists (
    select 1 from public.classes c
    where c.id=class_join_requests.class_id
      and c.teacher_id=(select auth.uid())
      and exists (
        select 1 from public.school_members sm
        where sm.school_id=c.school_id
          and sm.profile_id=(select auth.uid())
          and sm.role in ('teacher','owner','admin')
      )
  )
)
with check (
  exists (
    select 1 from public.classes c
    where c.id=class_join_requests.class_id
      and c.teacher_id=(select auth.uid())
      and exists (
        select 1 from public.school_members sm
        where sm.school_id=c.school_id
          and sm.profile_id=(select auth.uid())
          and sm.role in ('teacher','owner','admin')
      )
  )
);

-- Reconstruction bridge: 20260812082409 rewrote this auth.users(id)-keyed
-- table through public.students(id). Production later reached the intended
-- direct-owner shape through untracked drift. Restore that shape here before
-- this migration's historical bare-comparator assertion runs.
drop policy if exists student_exam_readiness_select_own on public.student_exam_readiness_state;
create policy student_exam_readiness_select_own
on public.student_exam_readiness_state
for select to authenticated
using (student_id=(select auth.uid()));

drop policy if exists student_exam_readiness_update_own on public.student_exam_readiness_state;
create policy student_exam_readiness_update_own
on public.student_exam_readiness_state
for update to authenticated
using (student_id=(select auth.uid()))
with check (student_id=(select auth.uid()));

drop policy if exists student_exam_readiness_insert_own on public.student_exam_readiness_state;
create policy student_exam_readiness_insert_own
on public.student_exam_readiness_state
for insert to authenticated
with check (student_id=(select auth.uid()));

-- Recovered production closure body: student_id really is public.students(id)
-- on the following learner-facing tables.
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
