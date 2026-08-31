insert into public.teaching_resource_links (
  resource_id,
  target_type,
  lesson_plan_id,
  usage_role,
  sequence,
  page_start,
  page_end,
  section_refs,
  exercise_refs,
  created_by
)
select
  sl.resource_id,
  'lesson_plan',
  lp.id,
  case lower(coalesce(sl.resource_role, 'source'))
    when 'primary' then 'source'
    when 'secondary' then 'reference'
    when 'teacher' then 'teacher_notes'
    when 'source' then 'source'
    when 'reference' then 'reference'
    when 'before_class' then 'before_class'
    when 'in_class' then 'in_class'
    when 'after_class' then 'after_class'
    when 'learner_reading' then 'learner_reading'
    when 'teacher_notes' then 'teacher_notes'
    when 'homework_source' then 'homework_source'
    when 'question_source' then 'question_source'
    when 'project_brief' then 'project_brief'
    when 'assessment_source' then 'assessment_source'
    when 'revision_source' then 'revision_source'
    else 'source'
  end,
  greatest(coalesce(sl.sequence, 1), 1),
  sl.page_start,
  sl.page_end,
  '[]'::jsonb,
  coalesce(sl.exercise_refs, '[]'::jsonb),
  lp.teacher_id
from public.lesson_plans lp
join public.scheme_lesson_resource_links sl
  on sl.scheme_lesson_id = lp.scheme_id
left join public.teaching_resource_links trl
  on trl.lesson_plan_id = lp.id
 and trl.resource_id = sl.resource_id
where lp.scheme_id is not null
  and trl.id is null;
