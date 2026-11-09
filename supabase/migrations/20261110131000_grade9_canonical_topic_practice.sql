-- Route Grade 9 Topic Practice through canonical EXQ assessment assignments.
-- No parallel exam item, response, score or attempt store is introduced.
create or replace function public.student_list_canonical_topic_practice(p_grade text)
returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare
  v_student uuid;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_student := public.current_student_id();
  if v_student is null then raise exception 'learner_identity_not_found'; end if;
  if nullif(btrim(p_grade),'') is null then raise exception 'grade_required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id',q.assignment_id,'subject',q.subject,'topic',q.topic,
    'question_count',q.question_count,'in_progress',q.in_progress,
    'completed_attempts',q.completed_attempts,'max_attempts',q.max_attempts
  ) order by q.subject,q.topic),'[]'::jsonb) into v_result
  from (
    select aa.id as assignment_id,coalesce(s.name,'Mathematics') as subject,
      ad.generation_metadata->>'topic' as topic,
      count(distinct ai.id)::integer as question_count,
      exists(select 1 from public.assessment_attempts at
        where at.assignment_id=aa.id and at.student_id=v_student and at.status='in_progress') as in_progress,
      (select count(*) from public.assessment_attempts at
        where at.assignment_id=aa.id and at.student_id=v_student and at.status<>'in_progress')::integer as completed_attempts,
      aa.max_attempts
    from public.assessment_assignments aa
    join public.assessment_definitions ad on ad.id=aa.assessment_id
    left join public.subjects s on s.id=ad.subject_id
    join public.assessment_items ai on ai.assessment_id=ad.id
      and ai.status='approved' and ai.auto_marking_mode='option_match'
      and ai.question_type='multiple_choice'
    where aa.audience='public_practice' and aa.status='open'
      and aa.school_id is null and aa.class_id is null and aa.target_group_id is null
      and aa.time_limit_minutes is null
      and (aa.opens_at is null or aa.opens_at<=now())
      and (aa.closes_at is null or aa.closes_at>now())
      and ad.assessment_type='practice' and ad.published_at is not null
      and ad.status in ('approved','assigned','open')
      and ad.generation_metadata->>'topic_practice'='true'
      and lower(ad.generation_metadata->>'grade')=lower(btrim(p_grade))
      and nullif(btrim(ad.generation_metadata->>'topic'),'') is not null
      and public.exq_public_practice_eligible(aa.audience_grade)
    group by aa.id,ad.id,s.name
    having count(distinct ai.id)=5
  ) q;
  return v_result;
end;
$$;
revoke all on function public.student_list_canonical_topic_practice(text) from public,anon;
grant execute on function public.student_list_canonical_topic_practice(text) to authenticated;

-- Feedback is read only. EXQ save_response and submit_attempt remain
-- the authoritative response and marking transactions.
create or replace function public.student_get_canonical_topic_practice_feedback(p_attempt_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare
  v_student uuid;
  v_attempt public.assessment_attempts%rowtype;
  v_items jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_student := public.current_student_id();
  if v_student is null then raise exception 'learner_identity_not_found'; end if;
  select * into v_attempt from public.assessment_attempts at
   where at.id=p_attempt_id and at.student_id=v_student;
  if not found then raise exception 'attempt_not_owned'; end if;
  if not exists(
    select 1 from public.assessment_assignments aa
    join public.assessment_definitions ad on ad.id=aa.assessment_id
    where aa.id=v_attempt.assignment_id and ad.id=v_attempt.assessment_id
      and aa.audience='public_practice' and ad.assessment_type='practice'
      and ad.generation_metadata->>'topic_practice'='true'
      and aa.show_score_policy='immediate'
  ) then raise exception 'topic_practice_not_authorized'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id',ai.id,
    'skipped',ar.response_value='null'::jsonb,
    'correct',case when ar.response_value='null'::jsonb then null
      else ar.response_value=ai.correct_answer end,
    'selected',case when ar.response_value='null'::jsonb then null else ar.response_value#>>'{}' end,
    'correct_answer',case when ar.response_value<>'null'::jsonb or v_attempt.status<>'in_progress'
      then ai.correct_answer#>>'{}' else null end,
    'explanation',case when ar.response_value<>'null'::jsonb or v_attempt.status<>'in_progress'
      then ai.explanation else null end
  )),'[]'::jsonb) into v_items
  from public.assessment_responses ar
  join public.assessment_items ai on ai.id=ar.assessment_item_id
    and ai.assessment_id=v_attempt.assessment_id
  where ar.attempt_id=v_attempt.id;
  return v_items;
end;
$$;
revoke all on function public.student_get_canonical_topic_practice_feedback(uuid) from public,anon;
grant execute on function public.student_get_canonical_topic_practice_feedback(uuid) to authenticated;
