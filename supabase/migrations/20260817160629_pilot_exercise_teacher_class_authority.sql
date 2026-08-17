-- Exercises do not carry subject_id; enforce the strongest representable authority:
-- current teacher membership plus an authorized assignment to the exercise class/school.
drop policy if exists "teachers manage own exercises" on public.exercises;
create policy "teachers manage own exercises" on public.exercises for all to authenticated
using (
 teacher_id=(select auth.uid())
 and exists(select 1 from public.classes c where c.id=exercises.class_id and c.school_id=exercises.school_id)
 and exists(select 1 from public.school_members sm where sm.profile_id=(select auth.uid()) and sm.school_id=exercises.school_id and sm.role='teacher'::public.member_role)
 and exists(select 1 from public.teacher_classes tc where tc.teacher_id=(select auth.uid()) and tc.school_id=exercises.school_id and tc.class_id=exercises.class_id)
)
with check (
 teacher_id=(select auth.uid())
 and exists(select 1 from public.classes c where c.id=exercises.class_id and c.school_id=exercises.school_id)
 and exists(select 1 from public.school_members sm where sm.profile_id=(select auth.uid()) and sm.school_id=exercises.school_id and sm.role='teacher'::public.member_role)
 and exists(select 1 from public.teacher_classes tc where tc.teacher_id=(select auth.uid()) and tc.school_id=exercises.school_id and tc.class_id=exercises.class_id)
);

drop policy if exists "teacher manages own exercise_submissions" on public.exercise_submissions;
create policy "teacher manages own exercise_submissions" on public.exercise_submissions for all to authenticated
using (exists (
 select 1 from public.exercises e
 join public.teacher_classes tc on tc.teacher_id=(select auth.uid()) and tc.school_id=e.school_id and tc.class_id=e.class_id
 join public.student_classes sc on sc.student_id=exercise_submissions.student_id and sc.school_id=e.school_id and sc.class_id=e.class_id and sc.is_current=true
 where e.id=exercise_submissions.exercise_id and e.teacher_id=(select auth.uid())
))
with check (exists (
 select 1 from public.exercises e
 join public.teacher_classes tc on tc.teacher_id=(select auth.uid()) and tc.school_id=e.school_id and tc.class_id=e.class_id
 join public.student_classes sc on sc.student_id=exercise_submissions.student_id and sc.school_id=e.school_id and sc.class_id=e.class_id and sc.is_current=true
 where e.id=exercise_submissions.exercise_id and e.teacher_id=(select auth.uid())
));
