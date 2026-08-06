create or replace function public.exq_get_marking_centre_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_teacher uuid := auth.uid();
  v_payload jsonb;
begin
  if v_teacher is null then
    raise exception 'Authentication required';
  end if;

  select jsonb_build_object(
    'counts', jsonb_build_object(
      'submitted_attempts', count(*) filter (where aa.status in ('submitted','teacher_review')),
      'partially_marked_attempts', count(*) filter (where aa.result_status = 'partially_marked'),
      'marked_attempts', count(*) filter (where aa.status = 'marked' and aa.result_status <> 'released'),
      'released_attempts', count(*) filter (where aa.result_status = 'released'),
      'pending_moderations', coalesce((
        select count(*)
        from public.assessment_moderation_requests mr
        join public.assessment_attempts ma on ma.id = mr.attempt_id
        join public.assessment_assignments mas on mas.id = ma.assignment_id
        where mas.teacher_id = v_teacher and mr.status = 'pending'
      ), 0)
    ),
    'workload', coalesce(jsonb_agg(jsonb_build_object(
      'assignment_id', a.id,
      'assessment_id', d.id,
      'assessment_title', d.title,
      'assessment_type', d.assessment_type,
      'class_id', a.class_id,
      'class_name', c.name,
      'class_stream', c.stream,
      'submitted_count', stats.submitted_count,
      'unresolved_attempts', stats.unresolved_attempts,
      'marked_count', stats.marked_count,
      'released_count', stats.released_count,
      'average_turnaround_hours', stats.average_turnaround_hours,
      'oldest_unmarked_at', stats.oldest_unmarked_at
    ) order by stats.unresolved_attempts desc, stats.oldest_unmarked_at nulls last), '[]'::jsonb)
  )
  into v_payload
  from public.assessment_assignments a
  join public.assessment_definitions d on d.id = a.assessment_id
  join public.classes c on c.id = a.class_id
  cross join lateral (
    select
      count(*) filter (where att.status in ('submitted','teacher_review','marked','released'))::int as submitted_count,
      count(*) filter (where att.status in ('submitted','teacher_review') or att.result_status = 'partially_marked')::int as unresolved_attempts,
      count(*) filter (where att.status = 'marked' and att.result_status <> 'released')::int as marked_count,
      count(*) filter (where att.result_status = 'released')::int as released_count,
      round(avg(extract(epoch from (att.teacher_reviewed_at - att.submitted_at)) / 3600.0) filter (where att.teacher_reviewed_at is not null and att.submitted_at is not null), 2) as average_turnaround_hours,
      min(att.submitted_at) filter (where att.status in ('submitted','teacher_review') or att.result_status = 'partially_marked') as oldest_unmarked_at
    from public.assessment_attempts att
    where att.assignment_id = a.id
  ) stats
  where a.teacher_id = v_teacher;

  return coalesce(v_payload, jsonb_build_object('counts', jsonb_build_object(), 'workload', '[]'::jsonb));
end;
$$;

revoke all on function public.exq_get_marking_centre_summary() from public, anon;
grant execute on function public.exq_get_marking_centre_summary() to authenticated;

create or replace function public.exq_get_teacher_assessment_intelligence()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_teacher uuid := auth.uid();
  v_payload jsonb;
begin
  if v_teacher is null then
    raise exception 'Authentication required';
  end if;

  with owned_assignments as (
    select a.id, a.assessment_id, a.class_id, d.subject_id, d.title, d.assessment_type
    from public.assessment_assignments a
    join public.assessment_definitions d on d.id = a.assessment_id
    where a.teacher_id = v_teacher
  ), released_attempts as (
    select att.*
    from public.assessment_attempts att
    join owned_assignments oa on oa.id = att.assignment_id
    where att.result_status = 'released'
  ), question_stats as (
    select
      ai.id as assessment_item_id,
      ai.prompt,
      ai.question_type,
      ai.difficulty,
      ai.bloom_level,
      count(ar.id)::int as response_count,
      round(avg(case when ar.max_score > 0 and ar.final_score is not null then (ar.final_score / ar.max_score) * 100 end), 2) as average_percentage,
      count(*) filter (where ar.final_score = 0)::int as zero_score_count,
      count(*) filter (where ar.final_score is not null and ar.max_score > 0 and (ar.final_score / ar.max_score) * 100 < 50)::int as below_50_count
    from public.assessment_items ai
    join owned_assignments oa on oa.assessment_id = ai.assessment_id
    left join public.assessment_responses ar on ar.assessment_item_id = ai.id
    left join released_attempts rat on rat.id = ar.attempt_id
    where rat.id is not null
    group by ai.id, ai.prompt, ai.question_type, ai.difficulty, ai.bloom_level
  ), outcome_stats as (
    select
      clo.id as outcome_id,
      clo.outcome_code,
      clo.outcome_text,
      count(ar.id)::int as response_count,
      round(avg(case when ar.max_score > 0 and ar.final_score is not null then (ar.final_score / ar.max_score) * 100 end), 2) as average_percentage,
      count(*) filter (where ar.final_score is not null and ar.max_score > 0 and (ar.final_score / ar.max_score) * 100 < 50)::int as learners_below_50
    from public.assessment_item_outcomes aio
    join public.curriculum_learning_outcomes clo on clo.id = aio.outcome_id
    join public.assessment_items ai on ai.id = aio.assessment_item_id
    join owned_assignments oa on oa.assessment_id = ai.assessment_id
    left join public.assessment_responses ar on ar.assessment_item_id = ai.id
    left join released_attempts rat on rat.id = ar.attempt_id
    where rat.id is not null
    group by clo.id, clo.outcome_code, clo.outcome_text
  ), intervention_stats as (
    select
      count(*) filter (where i.status in ('open','planned','in_progress'))::int as active_interventions,
      count(*) filter (where i.priority = 'high' and i.status in ('open','planned','in_progress'))::int as high_priority_interventions,
      round(avg(i.mastery_change) filter (where i.mastery_change is not null), 2) as average_mastery_change
    from public.assessment_interventions i
    where i.teacher_id = v_teacher
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'assessment_count', (select count(*) from owned_assignments),
      'released_attempt_count', (select count(*) from released_attempts),
      'average_percentage', (select round(avg(percentage), 2) from released_attempts where percentage is not null),
      'active_interventions', coalesce((select active_interventions from intervention_stats), 0),
      'high_priority_interventions', coalesce((select high_priority_interventions from intervention_stats), 0),
      'average_mastery_change', (select average_mastery_change from intervention_stats)
    ),
    'weak_questions', coalesce((select jsonb_agg(jsonb_build_object(
      'assessment_item_id', assessment_item_id,
      'prompt', prompt,
      'question_type', question_type,
      'difficulty', difficulty,
      'bloom_level', bloom_level,
      'response_count', response_count,
      'average_percentage', average_percentage,
      'zero_score_count', zero_score_count,
      'below_50_count', below_50_count
    ) order by average_percentage asc nulls last) from (select * from question_stats where response_count > 0 order by average_percentage asc nulls last limit 10) q), '[]'::jsonb),
    'outcomes', coalesce((select jsonb_agg(jsonb_build_object(
      'outcome_id', outcome_id,
      'outcome_code', outcome_code,
      'outcome_text', outcome_text,
      'response_count', response_count,
      'average_percentage', average_percentage,
      'learners_below_50', learners_below_50
    ) order by average_percentage asc nulls last) from outcome_stats), '[]'::jsonb),
    'assessment_trends', coalesce((select jsonb_agg(jsonb_build_object(
      'assignment_id', oa.id,
      'title', oa.title,
      'assessment_type', oa.assessment_type,
      'class_id', oa.class_id,
      'released_count', x.released_count,
      'average_percentage', x.average_percentage,
      'highest_percentage', x.highest_percentage,
      'lowest_percentage', x.lowest_percentage
    ) order by oa.title) from owned_assignments oa cross join lateral (
      select count(*)::int as released_count, round(avg(ra.percentage),2) as average_percentage, max(ra.percentage) as highest_percentage, min(ra.percentage) as lowest_percentage
      from released_attempts ra where ra.assignment_id = oa.id
    ) x), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$$;

revoke all on function public.exq_get_teacher_assessment_intelligence() from public, anon;
grant execute on function public.exq_get_teacher_assessment_intelligence() to authenticated;
