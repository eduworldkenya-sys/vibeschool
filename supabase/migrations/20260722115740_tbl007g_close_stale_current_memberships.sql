-- TBL-007G follow-up 2: close current student_classes memberships that
-- contradict students.class_id when a correct current membership exists.
-- Found live: one claimed student with two is_current rows (old class +
-- real class), which lets them read two classes' timetables through RLS.
--
-- Idempotent: closed rows no longer match the predicate. Only rows that
-- disagree with students.class_id AND are shadowed by a correct current
-- row are closed; nothing is deleted. left_at = now() satisfies
-- chk_left_after_joined and chk_left_at_current.

update student_classes sc
set is_current = false,
    left_at = now()
from students st
where st.id = sc.student_id
  and sc.is_current = true
  and st.class_id is not null
  and sc.class_id <> st.class_id
  and exists (
    select 1 from student_classes sc2
    where sc2.student_id = sc.student_id
      and sc2.class_id = st.class_id
      and sc2.is_current = true
  );
