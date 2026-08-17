-- Pilot Authority Chain: consequential exam-result writes must prove the full
-- teacher -> school -> class -> subject -> enrolled student -> exam context.

alter table public.exam_results enable row level security;

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
