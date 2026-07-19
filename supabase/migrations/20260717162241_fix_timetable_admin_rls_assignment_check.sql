-- RECONSTRUCTED 2026-07-19 from live pg_policy definitions (file lost from
-- repo). Policies enforce teacher_classes as the assignment truth on every
-- timetable_slots write, for both teachers and school admins.

drop policy if exists teachers_manage_own_slots on public.timetable_slots;
create policy teachers_manage_own_slots on public.timetable_slots for all
  using (teacher_id = auth.uid())
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1 from public.teacher_classes tc
      where tc.teacher_id = auth.uid()
        and tc.class_id = timetable_slots.class_id
        and tc.subject_id = timetable_slots.subject_id
        and tc.school_id = timetable_slots.school_id
    )
  );

drop policy if exists timetable_slots_admin on public.timetable_slots;
create policy timetable_slots_admin on public.timetable_slots for all
  using (public.is_school_admin(school_id))
  with check (
    public.is_school_admin(school_id)
    and exists (
      select 1 from public.teacher_classes tc
      where tc.teacher_id = timetable_slots.teacher_id
        and tc.class_id = timetable_slots.class_id
        and tc.subject_id = timetable_slots.subject_id
        and tc.school_id = timetable_slots.school_id
    )
  );
