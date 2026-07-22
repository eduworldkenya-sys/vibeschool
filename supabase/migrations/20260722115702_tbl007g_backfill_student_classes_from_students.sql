-- TBL-007G follow-up: 17 students carry students.class_id but have no
-- current student_classes row. The timetable_slots_student_read RLS policy
-- authorizes through student_classes (is_current = true), so each of these
-- students would see a blank timetable the moment they claim an account.
-- Backfill the junction from students.class_id.
--
-- Idempotent: ON CONFLICT (student_id, class_id) DO NOTHING; re-running
-- inserts zero rows. Transaction-safe: migrations run atomically.
-- school_id is taken from the class (verified: no classes.school_id NULLs).
-- Only rows with no existing current membership for that class are touched;
-- no existing row is updated or deleted.

insert into student_classes (school_id, student_id, class_id, is_current)
select c.school_id, st.id, st.class_id, true
from students st
join classes c on c.id = st.class_id
where st.class_id is not null
  and c.school_id is not null
  and not exists (
    select 1 from student_classes sc
    where sc.student_id = st.id
      and sc.class_id = st.class_id
      and sc.is_current = true
  )
on conflict (student_id, class_id) do nothing;
