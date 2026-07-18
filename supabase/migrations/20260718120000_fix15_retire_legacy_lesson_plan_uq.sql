-- Fix 15B: retire the legacy lesson-plan uniqueness constraint.
--
-- uq_lesson_plan UNIQUE (teacher_id, class_id, subject_id, week_start, day_of_week)
-- predates the timetable_slot_id/taught_date occurrence model introduced in
-- Fix 14 (see lesson_plans_slot_taught_date_key). It blocks a legitimate
-- double period: two timetable_slots for the same teacher/class/subject on
-- the same day but different times, which now map to two distinct
-- lesson_plans rows (different timetable_slot_id, same taught_date).
--
-- Fix 15A audited and repaired every active write path
-- (app/teacher/scheme/generate/page.tsx, components/teacher/LessonPlanModal.tsx)
-- so all inserts now populate timetable_slot_id, day_of_week, and taught_date.
-- lesson_plans_slot_taught_date_key UNIQUE (timetable_slot_id, taught_date)
-- is the sole identity going forward.
alter table public.lesson_plans
drop constraint if exists uq_lesson_plan;
