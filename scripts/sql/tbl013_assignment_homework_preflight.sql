-- Read only; aggregate evidence for the two original historical migrations.
-- No learner, teacher or homework identifiers leave the database.
with duplicate_assignments as (
 select 1 from public.teacher_classes
 group by school_id,teacher_id,class_id,subject_id having count(*)>1
), exact_plan_duplicates as (
 select 1 from public.lesson_plans
 where timetable_slot_id is not null and taught_date is not null
 group by timetable_slot_id,taught_date,school_id,teacher_id,class_id,subject_id
 having count(*)>1
), candidate_homework as (
 select h.id,count(distinct o.id) as matches
 from public.homework h
 join public.lesson_plans lp on lp.id=h.lesson_plan_id
 join public.teaching_occurrences o
   on o.timetable_slot_id=lp.timetable_slot_id
  and o.occurrence_date=lp.taught_date
  and o.school_id=lp.school_id and o.teacher_id=lp.teacher_id
  and o.class_id=lp.class_id and o.subject_id=lp.subject_id
  and o.lifecycle in ('in_progress','completed')
 where h.teaching_occurrence_id is null
   and h.school_id=o.school_id and h.teacher_id=o.teacher_id and h.class_id=o.class_id
 group by h.id
)
select (select count(*) from duplicate_assignments) as duplicate_assignment_groups,
       (select count(*) from exact_plan_duplicates) as duplicate_dated_plan_groups,
       (select count(*) from candidate_homework where matches>1) as ambiguous_homework_rows,
       (select count(*) from candidate_homework where matches=1) as exact_homework_backfill_rows;
