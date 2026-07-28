-- Behavioral fix 3 (audit F-13): lesson_plans allowed day_of_week 1-5 while
-- timetable_slots allows 1-7 AND live data has Saturday (6) and Sunday (7)
-- slots. LessonPlanModal writes day_of_week from the slot, so weekend slots
-- could never get a plan and start_teaching_occurrence could never run for
-- them. One definition of the week, matching timetable_slots.
alter table public.lesson_plans
  drop constraint if exists lesson_plans_day_of_week_check;

alter table public.lesson_plans
  add constraint lesson_plans_day_of_week_check
  check (day_of_week >= 1 and day_of_week <= 7);
