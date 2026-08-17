-- Pilot Authority Chain: consequential exam-result writes must prove the full
-- teacher -> school -> class -> subject -> enrolled student -> exam context.
--
-- Blank-rebuild prelude: production already contained public.exam_results when
-- this production version ran, but no tracked CREATE TABLE exists. Keep the
-- structural prerequisite inside the already-applied production version so a
-- future production push sees no replay-only migration debt.
-- authorization-test: public.exam_results

create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  marks numeric not null check (marks >= 0),
  is_absent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id, subject_id)
);

create index if not exists idx_exam_results_exam_class on public.exam_results(exam_id,class_id);
create index if not exists idx_exam_results_exam_student on public.exam_results(exam_id,student_id);
create index if not exists idx_exam_results_student on public.exam_results(student_id);

create or replace function public.update_exam_results_timestamp()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;
revoke all on function public.update_exam_results_timestamp() from public, anon, authenticated;
grant execute on function public.update_exam_results_timestamp() to service_role;

drop trigger if exists exam_results_updated_at on public.exam_results;
create trigger exam_results_updated_at
before update on public.exam_results
for each row execute function public.update_exam_results_timestamp();

alter table public.exam_results enable row level security;
revoke all privileges on table public.exam_results from anon, authenticated;
grant select, insert, update, delete on table public.exam_results to authenticated;
grant all privileges on table public.exam_results to service_role;

-- Reconstruct pre-existing non-teacher policies. The broad member-read policy
-- is historical production state and is deliberately removed by the forward
-- 20260818013000 semantic repair because permissive RLS would otherwise bypass
-- class-scoped teacher/family/learner reads.
drop policy if exists exam_results_admin on public.exam_results;
create policy exam_results_admin
on public.exam_results for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists exam_results_member_read on public.exam_results;
create policy exam_results_member_read
on public.exam_results for select to authenticated
using (
  school_id in (
    select sm.school_id from public.school_members sm
    where sm.profile_id=(select auth.uid())
  )
);

drop policy if exists exam_results_parent_read on public.exam_results;
create policy exam_results_parent_read
on public.exam_results for select to authenticated
using (
  exists (
    select 1 from public.parent_student_links psl
    where psl.student_id=exam_results.student_id
      and psl.parent_id=(select auth.uid())
  )
);

drop policy if exists exam_results_student_read on public.exam_results;
create policy exam_results_student_read
on public.exam_results for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id=exam_results.student_id
      and s.profile_id=(select auth.uid())
      and s.deleted_at is null
  )
);

-- Recovered production teacher authority body.
drop policy if exists exam_results_teacher_insert on public.exam_results;
drop policy if exists exam_results_teacher_update on public.exam_results;
drop policy if exists exam_results_teacher_delete on public.exam_results;
drop policy if exists "Teachers view exam results for their classes" on public.exam_results;

create policy exam_results_teacher_insert
on public.exam_results for insert to authenticated
with check (
  teacher_id=(select auth.uid())
  and exists (select 1 from public.school_members sm where sm.profile_id=(select auth.uid()) and sm.school_id=exam_results.school_id and sm.role='teacher'::public.member_role)
  and exists (select 1 from public.teacher_classes tc where tc.teacher_id=(select auth.uid()) and tc.school_id=exam_results.school_id and tc.class_id=exam_results.class_id and tc.subject_id=exam_results.subject_id)
  and exists (select 1 from public.student_classes sc where sc.student_id=exam_results.student_id and sc.school_id=exam_results.school_id and sc.class_id=exam_results.class_id and sc.is_current=true)
  and exists (select 1 from public.exams e where e.id=exam_results.exam_id and e.school_id=exam_results.school_id and e.is_locked=false)
  and exists (select 1 from public.classes c where c.id=exam_results.class_id and c.school_id=exam_results.school_id)
  and exists (select 1 from public.subjects s where s.id=exam_results.subject_id and s.school_id=exam_results.school_id)
);

create policy exam_results_teacher_update
on public.exam_results for update to authenticated
using (
  teacher_id=(select auth.uid())
  and exists (select 1 from public.teacher_classes tc where tc.teacher_id=(select auth.uid()) and tc.school_id=exam_results.school_id and tc.class_id=exam_results.class_id and tc.subject_id=exam_results.subject_id)
  and exists (select 1 from public.exams e where e.id=exam_results.exam_id and e.school_id=exam_results.school_id and e.is_locked=false)
)
with check (
  teacher_id=(select auth.uid())
  and exists (select 1 from public.school_members sm where sm.profile_id=(select auth.uid()) and sm.school_id=exam_results.school_id and sm.role='teacher'::public.member_role)
  and exists (select 1 from public.teacher_classes tc where tc.teacher_id=(select auth.uid()) and tc.school_id=exam_results.school_id and tc.class_id=exam_results.class_id and tc.subject_id=exam_results.subject_id)
  and exists (select 1 from public.student_classes sc where sc.student_id=exam_results.student_id and sc.school_id=exam_results.school_id and sc.class_id=exam_results.class_id and sc.is_current=true)
  and exists (select 1 from public.exams e where e.id=exam_results.exam_id and e.school_id=exam_results.school_id and e.is_locked=false)
  and exists (select 1 from public.classes c where c.id=exam_results.class_id and c.school_id=exam_results.school_id)
  and exists (select 1 from public.subjects s where s.id=exam_results.subject_id and s.school_id=exam_results.school_id)
);

create policy exam_results_teacher_delete
on public.exam_results for delete to authenticated
using (
  teacher_id=(select auth.uid())
  and exists (select 1 from public.teacher_classes tc where tc.teacher_id=(select auth.uid()) and tc.school_id=exam_results.school_id and tc.class_id=exam_results.class_id and tc.subject_id=exam_results.subject_id)
  and exists (select 1 from public.exams e where e.id=exam_results.exam_id and e.school_id=exam_results.school_id and e.is_locked=false)
);

create policy "Teachers view exam results for their classes"
on public.exam_results for select to authenticated
using (
  exists (select 1 from public.teacher_classes tc where tc.teacher_id=(select auth.uid()) and tc.school_id=exam_results.school_id and tc.class_id=exam_results.class_id and tc.subject_id=exam_results.subject_id)
  and exists (select 1 from public.student_classes sc where sc.student_id=exam_results.student_id and sc.school_id=exam_results.school_id and sc.class_id=exam_results.class_id and sc.is_current=true)
);

do $$ begin
 if exists (
   select 1 from public.exam_results er
   where not (
     exists(select 1 from public.exams e where e.id=er.exam_id and e.school_id=er.school_id)
     and exists(select 1 from public.classes c where c.id=er.class_id and c.school_id=er.school_id)
     and exists(select 1 from public.subjects s where s.id=er.subject_id and s.school_id=er.school_id)
     and exists(select 1 from public.student_classes sc where sc.student_id=er.student_id and sc.class_id=er.class_id and sc.school_id=er.school_id and sc.is_current=true)
     and exists(select 1 from public.teacher_classes tc where tc.teacher_id=er.teacher_id and tc.class_id=er.class_id and tc.school_id=er.school_id and tc.subject_id=er.subject_id)
   )
 ) then raise exception 'exam_results contains cross-scope authority data'; end if;
end $$;
