-- Canonical learner-owned Topic Practice progress: assessment_attempts remains the sole authority.
-- Separate active attempt from previously released results. Never expose formal exam scores.
create or replace function public.student_topic_practice_progress_history(p_grade text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_student uuid;
  v_topics jsonb;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_student := public.current_student_id();
  if v_student is null then raise exception 'learner_identity_not_found'; end if;
  -- Uses the existing published five-item canonical topic discovery/grade eligibility.
  v_topics := public.student_list_canonical_topic_practice(p_grade);
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id',t.assignment_id,
    'subject',t.subject,
    'topic',t.topic,
    'completed_attempts',coalesce(h.completed_attempts,0),
    'active_attempt',h.active_attempt,
    'attempts',coalesce(h.attempts,'[]'::jsonb)
  ) order by t.subject,t.topic),'[]'::jsonb)
  into v_result
  from jsonb_to_recordset(v_topics) as t(
    assignment_id uuid,subject text,topic text,
    question_count integer,in_progress boolean,completed_attempts integer,max_attempts integer
  )
  join public.assessment_assignments aa on aa.id=t.assignment_id
  join public.assessment_definitions ad on ad.id=aa.assessment_id
  left join lateral (
    select
      count(*) filter (where a.submitted_at is not null and a.status<>'in_progress')::integer as completed_attempts,
      coalesce(jsonb_agg(jsonb_build_object(
        'attempt_id',a.id,
        'attempt_number',a.attempt_number,
        'submitted_at',a.submitted_at,
        'result_available', (a.result_status='released' or
          (ad.assessment_type='practice' and aa.show_score_policy='immediate' and a.result_status='marked')),
        'score',case when a.result_status='released' or
          (ad.assessment_type='practice' and aa.show_score_policy='immediate' and a.result_status='marked')
          then a.score else null end,
        'max_score',case when a.result_status='released' or
          (ad.assessment_type='practice' and aa.show_score_policy='immediate' and a.result_status='marked')
          then a.max_score else null end,
        'percentage',case when a.result_status='released' or
          (ad.assessment_type='practice' and aa.show_score_policy='immediate' and a.result_status='marked')
          then a.percentage else null end
      ) order by a.attempt_number desc) filter (
        where a.status<>'in_progress' and a.submitted_at is not null
      ),'[]'::jsonb) as attempts,
      (
        select jsonb_build_object(
          'attempt_id',active.id,'attempt_number',active.attempt_number,
          'saved_answers',(select count(distinct r.assessment_item_id)::integer
            from public.assessment_responses r where r.attempt_id=active.id),
          'total_questions',t.question_count
        )
        from public.assessment_attempts active
        where active.assignment_id=t.assignment_id and active.student_id=v_student
          and active.status='in_progress'
        order by active.attempt_number desc limit 1
      ) as active_attempt
    from public.assessment_attempts a
    where a.assignment_id=t.assignment_id and a.student_id=v_student
  ) h on true;
  return v_result;
end $$;
revoke all on function public.student_topic_practice_progress_history(text) from public, anon;
grant execute on function public.student_topic_practice_progress_history(text) to authenticated;
