-- Teachers assigned to a class (any subject, not just the class teacher) can read
-- that class's full attendance history — not only rows they personally marked.
-- Needed for class-level and student-level attendance history views in the teacher app.
create policy attendance_teacher_class_read
  on public.attendance
  for select
  using (
    exists (
      select 1 from public.teacher_classes tc
      where tc.teacher_id = auth.uid()
        and tc.class_id = attendance.class_id
        and tc.school_id = attendance.school_id
    )
  );
