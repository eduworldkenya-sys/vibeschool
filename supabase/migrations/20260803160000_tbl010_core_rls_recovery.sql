begin;

-- TBL-010
-- Recover the authoritative final RLS contract for the four core timetable
-- tables during a clean rebuild.
--
-- This migration is intentionally convergent:
--   * RLS is enabled explicitly;
--   * every known historical policy name is dropped first;
--   * only the intended final policies are recreated;
--   * teacher_classes writes are school-admin controlled;
--   * teaching_occurrence writes remain RPC-controlled.

alter table public.timetable_slots enable row level security;
alter table public.teacher_classes enable row level security;
alter table public.teaching_occurrences enable row level security;
alter table public.school_periods enable row level security;

-- ---------------------------------------------------------------------------
-- timetable_slots
-- ---------------------------------------------------------------------------

drop policy if exists teachers_manage_own_slots
  on public.timetable_slots;

drop policy if exists timetable_slots_admin
  on public.timetable_slots;

drop policy if exists timetable_slots_student_read
  on public.timetable_slots;

create policy teachers_manage_own_slots
on public.timetable_slots
for all
to authenticated
using (
  teacher_id = (select auth.uid())
)
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1
    from public.teacher_classes tc
    where tc.teacher_id = (select auth.uid())
      and tc.school_id = timetable_slots.school_id
      and tc.class_id = timetable_slots.class_id
      and tc.subject_id = timetable_slots.subject_id
  )
);

create policy timetable_slots_admin
on public.timetable_slots
for all
to authenticated
using (
  public.is_school_admin(school_id)
)
with check (
  public.is_school_admin(school_id)
  and exists (
    select 1
    from public.teacher_classes tc
    where tc.teacher_id = timetable_slots.teacher_id
      and tc.school_id = timetable_slots.school_id
      and tc.class_id = timetable_slots.class_id
      and tc.subject_id = timetable_slots.subject_id
  )
);

create policy timetable_slots_student_read
on public.timetable_slots
for select
to authenticated
using (
  exists (
    select 1
    from public.student_classes sc
    join public.students s
      on s.id = sc.student_id
    where s.profile_id = (select auth.uid())
      and sc.class_id = timetable_slots.class_id
      and sc.school_id = timetable_slots.school_id
      and sc.is_current = true
  )
);

-- ---------------------------------------------------------------------------
-- teacher_classes
-- ---------------------------------------------------------------------------

drop policy if exists pol_teacher_classes_select
  on public.teacher_classes;

drop policy if exists pol_teacher_classes_insert
  on public.teacher_classes;

drop policy if exists pol_teacher_classes_update
  on public.teacher_classes;

drop policy if exists pol_teacher_classes_delete
  on public.teacher_classes;

drop policy if exists teacher_classes_admin_insert
  on public.teacher_classes;

drop policy if exists teacher_classes_admin_update
  on public.teacher_classes;

drop policy if exists teacher_classes_admin_delete
  on public.teacher_classes;

create policy pol_teacher_classes_select
on public.teacher_classes
for select
to authenticated
using (
  teacher_id = (select auth.uid())
  or public.is_school_admin(school_id)
);

create policy teacher_classes_admin_insert
on public.teacher_classes
for insert
to authenticated
with check (
  public.is_school_admin(school_id)
);

create policy teacher_classes_admin_update
on public.teacher_classes
for update
to authenticated
using (
  public.is_school_admin(school_id)
)
with check (
  public.is_school_admin(school_id)
);

create policy teacher_classes_admin_delete
on public.teacher_classes
for delete
to authenticated
using (
  public.is_school_admin(school_id)
);

-- ---------------------------------------------------------------------------
-- teaching_occurrences
-- ---------------------------------------------------------------------------

drop policy if exists teaching_occurrences_teacher_read
  on public.teaching_occurrences;

drop policy if exists teaching_occurrences_admin_read
  on public.teaching_occurrences;

drop policy if exists teaching_occurrences_teacher_write
  on public.teaching_occurrences;

drop policy if exists teaching_occurrences_teacher_update
  on public.teaching_occurrences;

drop policy if exists teaching_occurrences_no_delete
  on public.teaching_occurrences;

create policy teaching_occurrences_teacher_read
on public.teaching_occurrences
for select
to authenticated
using (
  teacher_id = (select auth.uid())
);

create policy teaching_occurrences_admin_read
on public.teaching_occurrences
for select
to authenticated
using (
  public.is_school_admin(school_id)
);

-- Explicitly preserve the no-direct-delete contract. Inserts and updates have
-- no authenticated table policies and therefore remain denied unless executed
-- through an authorized SECURITY DEFINER function or service role.
create policy teaching_occurrences_no_delete
on public.teaching_occurrences
for delete
to authenticated
using (false);

-- ---------------------------------------------------------------------------
-- school_periods
-- ---------------------------------------------------------------------------

drop policy if exists school_periods_teacher_read
  on public.school_periods;

drop policy if exists school_periods_admin_all
  on public.school_periods;

create policy school_periods_teacher_read
on public.school_periods
for select
to authenticated
using (
  exists (
    select 1
    from public.teacher_classes tc
    where tc.teacher_id = (select auth.uid())
      and tc.school_id = school_periods.school_id
  )
);

create policy school_periods_admin_all
on public.school_periods
for all
to authenticated
using (
  public.is_school_admin(school_id)
)
with check (
  public.is_school_admin(school_id)
);

commit;
