-- Task 3: Student teacher-boundary semantic closure.
-- Every learner-domain authorization resolves through public.students.id.
-- A teacher assignment is valid only while the caller is also a live teacher
-- member of the school. Account/profile UUIDs are never compared to student_id.

create or replace function public.is_live_teacher_class(p_school_id uuid,p_class_id uuid)
returns boolean
language sql stable security definer
set search_path=public,pg_temp
as $function$
  select exists(
    select 1
    from public.teacher_classes tc
    join public.school_members sm
      on sm.profile_id=tc.teacher_id
     and sm.school_id=tc.school_id
     and sm.role='teacher'
    where tc.teacher_id=auth.uid()
      and tc.school_id=p_school_id
      and tc.class_id=p_class_id
  );
$function$;
revoke all on function public.is_live_teacher_class(uuid,uuid) from public,anon;
grant execute on function public.is_live_teacher_class(uuid,uuid) to authenticated,service_role;

create or replace function public.is_live_teacher_subject(p_school_id uuid,p_class_id uuid,p_subject_id uuid)
returns boolean
language sql stable security definer
set search_path=public,pg_temp
as $function$
  select exists(
    select 1
    from public.teacher_classes tc
    join public.school_members sm
      on sm.profile_id=tc.teacher_id
     and sm.school_id=tc.school_id
     and sm.role='teacher'
    where tc.teacher_id=auth.uid()
      and tc.school_id=p_school_id
      and tc.class_id=p_class_id
      and (p_subject_id is null or tc.subject_id=p_subject_id)
  );
$function$;
revoke all on function public.is_live_teacher_subject(uuid,uuid,uuid) from public,anon;
grant execute on function public.is_live_teacher_subject(uuid,uuid,uuid) to authenticated,service_role;

-- Canonical roster boundary.
drop policy if exists teacher_read on public.students;
create policy teacher_read on public.students
for select to authenticated using(public.is_teacher_of_student(id));

-- student_profiles.profile_id is account identity. Resolve it to students.id before
-- parent/teacher learner authorization.
drop policy if exists pol_student_profiles_select on public.student_profiles;
drop policy if exists student_profiles_parent_read on public.student_profiles;
drop policy if exists student_profiles_teacher_read on public.student_profiles;
create policy pol_student_profiles_select on public.student_profiles
for select to authenticated
using(
  profile_id=auth.uid()
  or public.is_school_admin(school_id)
  or exists(select 1 from public.students s where s.profile_id=student_profiles.profile_id and s.deleted_at is null and public.is_parent_of_student(s.id))
  or exists(select 1 from public.students s where s.profile_id=student_profiles.profile_id and s.deleted_at is null and public.is_teacher_of_student(s.id))
);

-- Attendance.
drop policy if exists attendance_teacher_class_read on public.attendance;
drop policy if exists attendance_teacher_read on public.attendance;
drop policy if exists attendance_teacher_write on public.attendance;
drop policy if exists attendance_teacher_update on public.attendance;
create policy attendance_teacher_read on public.attendance
for select to authenticated
using(public.is_live_teacher_class(school_id,class_id) and public.is_teacher_of_student(student_id));
create policy attendance_teacher_write on public.attendance
for insert to authenticated
with check(
  teacher_id=auth.uid()
  and public.is_live_teacher_class(school_id,class_id)
  and exists(
    select 1 from public.student_classes sc
    join public.students s on s.id=sc.student_id and s.deleted_at is null
    where sc.student_id=attendance.student_id
      and sc.school_id=attendance.school_id
      and sc.class_id=attendance.class_id
      and sc.is_current=true
  )
);
create policy attendance_teacher_update on public.attendance
for update to authenticated
using(teacher_id=auth.uid() and public.is_live_teacher_class(school_id,class_id) and public.is_teacher_of_student(student_id))
with check(
  teacher_id=auth.uid()
  and public.is_live_teacher_class(school_id,class_id)
  and exists(select 1 from public.student_classes sc where sc.student_id=attendance.student_id and sc.school_id=attendance.school_id and sc.class_id=attendance.class_id and sc.is_current=true)
);

-- CBC assessments.
drop policy if exists cbc_teacher_read on public.cbc_assessments;
drop policy if exists pol_cbc_insert on public.cbc_assessments;
drop policy if exists pol_cbc_update on public.cbc_assessments;
create policy cbc_teacher_read on public.cbc_assessments
for select to authenticated
using(public.is_live_teacher_subject(school_id,class_id,subject_id) and public.is_teacher_of_student(student_id));
create policy pol_cbc_insert on public.cbc_assessments
for insert to authenticated
with check(
  teacher_id=auth.uid()
  and public.is_live_teacher_subject(school_id,class_id,subject_id)
  and exists(
    select 1 from public.student_classes sc
    join public.students s on s.id=sc.student_id and s.deleted_at is null
    where sc.student_id=cbc_assessments.student_id
      and sc.school_id=cbc_assessments.school_id
      and sc.class_id=cbc_assessments.class_id
      and sc.is_current=true
  )
);
create policy pol_cbc_update on public.cbc_assessments
for update to authenticated
using(
  public.is_school_admin(school_id)
  or (teacher_id=auth.uid() and public.is_live_teacher_subject(school_id,class_id,subject_id) and public.is_teacher_of_student(student_id))
)
with check(
  exists(
    select 1 from public.student_classes sc
    join public.students s on s.id=sc.student_id and s.deleted_at is null
    where sc.student_id=cbc_assessments.student_id
      and sc.school_id=cbc_assessments.school_id
      and sc.class_id=cbc_assessments.class_id
      and sc.is_current=true
  )
  and (public.is_school_admin(school_id) or (teacher_id=auth.uid() and public.is_live_teacher_subject(school_id,class_id,subject_id)))
);

-- Exam results.
drop policy if exists "Teachers view exam results for their classes" on public.exam_results;
drop policy if exists exam_results_teacher_insert on public.exam_results;
drop policy if exists exam_results_teacher_update on public.exam_results;
drop policy if exists exam_results_teacher_delete on public.exam_results;
create policy "Teachers view exam results for their classes" on public.exam_results
for select to authenticated
using(public.is_live_teacher_subject(school_id,class_id,subject_id) and public.is_teacher_of_student(student_id));
create policy exam_results_teacher_insert on public.exam_results
for insert to authenticated
with check(
  teacher_id=auth.uid()
  and public.is_live_teacher_subject(school_id,class_id,subject_id)
  and exists(select 1 from public.student_classes sc where sc.student_id=exam_results.student_id and sc.school_id=exam_results.school_id and sc.class_id=exam_results.class_id and sc.is_current=true)
  and exists(select 1 from public.exams e where e.id=exam_results.exam_id and e.school_id=exam_results.school_id and e.is_locked=false)
  and exists(select 1 from public.classes c where c.id=exam_results.class_id and c.school_id=exam_results.school_id)
  and exists(select 1 from public.subjects s where s.id=exam_results.subject_id and s.school_id=exam_results.school_id)
);
create policy exam_results_teacher_update on public.exam_results
for update to authenticated
using(
  teacher_id=auth.uid()
  and public.is_live_teacher_subject(school_id,class_id,subject_id)
  and public.is_teacher_of_student(student_id)
  and exists(select 1 from public.exams e where e.id=exam_results.exam_id and e.school_id=exam_results.school_id and e.is_locked=false)
)
with check(
  teacher_id=auth.uid()
  and public.is_live_teacher_subject(school_id,class_id,subject_id)
  and exists(select 1 from public.student_classes sc where sc.student_id=exam_results.student_id and sc.school_id=exam_results.school_id and sc.class_id=exam_results.class_id and sc.is_current=true)
  and exists(select 1 from public.exams e where e.id=exam_results.exam_id and e.school_id=exam_results.school_id and e.is_locked=false)
  and exists(select 1 from public.classes c where c.id=exam_results.class_id and c.school_id=exam_results.school_id)
  and exists(select 1 from public.subjects s where s.id=exam_results.subject_id and s.school_id=exam_results.school_id)
);
create policy exam_results_teacher_delete on public.exam_results
for delete to authenticated
using(
  teacher_id=auth.uid()
  and public.is_live_teacher_subject(school_id,class_id,subject_id)
  and public.is_teacher_of_student(student_id)
  and exists(select 1 from public.exams e where e.id=exam_results.exam_id and e.school_id=exam_results.school_id and e.is_locked=false)
);

-- Assessment attempts.
drop policy if exists assessment_attempts_teacher_read on public.assessment_attempts;
create policy assessment_attempts_teacher_read on public.assessment_attempts
for select to authenticated
using(
  public.is_teacher_of_student(student_id)
  and exists(
    select 1 from public.assessment_assignments aa
    where aa.id=assessment_attempts.assignment_id
      and aa.teacher_id=auth.uid()
      and public.is_live_teacher_class(aa.school_id,aa.class_id)
  )
);

-- Homework submissions.
drop policy if exists homework_submissions_teacher on public.homework_submissions;
create policy homework_submissions_teacher on public.homework_submissions
for all to authenticated
using(
  public.is_teacher_of_student(student_id)
  and exists(select 1 from public.homework h where h.id=homework_submissions.homework_id and h.teacher_id=auth.uid() and public.is_live_teacher_class(h.school_id,h.class_id))
)
with check(
  public.is_teacher_of_student(student_id)
  and exists(select 1 from public.homework h where h.id=homework_submissions.homework_id and h.teacher_id=auth.uid() and public.is_live_teacher_class(h.school_id,h.class_id))
);

-- Lesson evidence has no school_id. Derive the school from canonical current enrollment.
drop policy if exists "teacher manages own lesson evidence" on public.lesson_evidence;
create policy "teacher manages own lesson evidence" on public.lesson_evidence
for all to authenticated
using(
  teacher_id=auth.uid()
  and public.is_teacher_of_student(student_id)
  and exists(
    select 1 from public.student_classes sc
    where sc.student_id=lesson_evidence.student_id
      and sc.class_id=lesson_evidence.class_id
      and sc.is_current=true
      and public.is_live_teacher_class(sc.school_id,sc.class_id)
  )
)
with check(
  teacher_id=auth.uid()
  and public.is_teacher_of_student(student_id)
  and exists(
    select 1 from public.student_classes sc
    where sc.student_id=lesson_evidence.student_id
      and sc.class_id=lesson_evidence.class_id
      and sc.is_current=true
      and public.is_live_teacher_class(sc.school_id,sc.class_id)
  )
);

drop policy if exists "teacher manages own lesson interventions" on public.lesson_interventions;
create policy "teacher manages own lesson interventions" on public.lesson_interventions
for all to authenticated
using(teacher_id=auth.uid() and public.is_teacher_of_student(student_id))
with check(teacher_id=auth.uid() and public.is_teacher_of_student(student_id));

-- Exercise/project submissions.
drop policy if exists "teacher manages own exercise_submissions" on public.exercise_submissions;
create policy "teacher manages own exercise_submissions" on public.exercise_submissions
for all to authenticated
using(
  public.is_teacher_of_student(student_id)
  and exists(select 1 from public.exercises e where e.id=exercise_submissions.exercise_id and e.teacher_id=auth.uid() and public.is_live_teacher_class(e.school_id,e.class_id))
)
with check(
  public.is_teacher_of_student(student_id)
  and exists(select 1 from public.exercises e where e.id=exercise_submissions.exercise_id and e.teacher_id=auth.uid() and public.is_live_teacher_class(e.school_id,e.class_id))
);

drop policy if exists "teacher manages own project_submissions" on public.project_submissions;
create policy "teacher manages own project_submissions" on public.project_submissions
for all to authenticated
using(
  public.is_teacher_of_student(student_id)
  and exists(select 1 from public.projects p where p.id=project_submissions.project_id and p.teacher_id=auth.uid() and public.is_live_teacher_subject(p.school_id,p.class_id,p.subject_id))
)
with check(
  public.is_teacher_of_student(student_id)
  and exists(select 1 from public.projects p where p.id=project_submissions.project_id and p.teacher_id=auth.uid() and public.is_live_teacher_subject(p.school_id,p.class_id,p.subject_id))
);

-- Parent relationship/communication teacher boundary.
drop policy if exists psl_teacher_read on public.parent_student_links;
create policy psl_teacher_read on public.parent_student_links
for select to authenticated using(public.is_teacher_of_student(student_id));

drop policy if exists pol_parent_messages_insert on public.parent_messages;
drop policy if exists pol_parent_messages_update on public.parent_messages;
drop policy if exists pol_parent_messages_select on public.parent_messages;
create policy pol_parent_messages_insert on public.parent_messages
for insert to authenticated
with check(
  teacher_id=auth.uid()
  and public.is_teacher_of_student(student_id)
  and exists(select 1 from public.student_classes sc where sc.student_id=parent_messages.student_id and sc.school_id=parent_messages.school_id and sc.is_current=true)
);
create policy pol_parent_messages_update on public.parent_messages
for update to authenticated
using(teacher_id=auth.uid() and public.is_teacher_of_student(student_id))
with check(
  teacher_id=auth.uid()
  and public.is_teacher_of_student(student_id)
  and exists(select 1 from public.student_classes sc where sc.student_id=parent_messages.student_id and sc.school_id=parent_messages.school_id and sc.is_current=true)
);
create policy pol_parent_messages_select on public.parent_messages
for select to authenticated
using(
  (teacher_id=auth.uid() and public.is_teacher_of_student(student_id))
  or public.is_parent_of_student(student_id)
  or public.is_school_admin(school_id)
);

drop policy if exists pol_parent_profiles_select on public.parent_profiles;
create policy pol_parent_profiles_select on public.parent_profiles
for select to authenticated
using(
  profile_id=auth.uid()
  or exists(select 1 from public.parent_student_links psl where psl.parent_id=parent_profiles.profile_id and public.is_teacher_of_student(psl.student_id))
  or exists(select 1 from public.parent_student_links psl where psl.parent_id=parent_profiles.profile_id and public.is_school_admin(psl.school_id))
);

-- Claim codes, mastery and learner outcomes.
drop policy if exists claim_codes_teacher on public.student_claim_codes;
create policy claim_codes_teacher on public.student_claim_codes
for all to authenticated
using(public.is_teacher_of_student(student_id))
with check(public.is_teacher_of_student(student_id));

drop policy if exists mastery_teacher_read on public.student_outcome_mastery;
create policy mastery_teacher_read on public.student_outcome_mastery
for select to authenticated using(public.is_teacher_of_student(student_id));

drop policy if exists "teacher can manage learner outcomes" on public.learner_outcomes;
create policy "teacher can manage learner outcomes" on public.learner_outcomes
for all to authenticated
using(public.is_teacher_of_student(student_id))
with check(public.is_teacher_of_student(student_id));

-- Fail closed on the exact profile/student policy confusion discovered by Task 3.
do $block$
declare v_bad integer;
begin
  select count(*) into v_bad
  from pg_policies
  where schemaname='public'
    and tablename='student_profiles'
    and (
      coalesce(qual,'') ilike '%student_id = student_profiles.profile_id%'
      or coalesce(with_check,'') ilike '%student_id = student_profiles.profile_id%'
    );
  if v_bad>0 then raise exception 'task3_profile_student_policy_confusion:%',v_bad; end if;
end;
$block$;
