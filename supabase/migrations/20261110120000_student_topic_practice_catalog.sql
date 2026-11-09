-- Read-only topic catalog over the existing verified practice bank.
-- Questions, answer keys, scoring and attempt receipts stay in their existing services.
create or replace function public.student_list_topic_practice_topics(p_form text)
returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare
  v_student uuid;
  v_topics jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_student := public.current_student_id();
  if v_student is null then raise exception 'learner_identity_not_found'; end if;
  if nullif(btrim(p_form),'') is null then raise exception 'grade_required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('subject',subject,'topic',topic,'count',question_count) order by subject,topic),'[]'::jsonb)
  into v_topics
  from (
    select b.subject::text as subject, b.topic::text as topic, count(distinct b.id) as question_count
    from public.exam_question_bank b
    where b.status='active'
      and b.provenance_status in ('teacher_verified','publisher_verified','official_verified')
      and lower(b.form::text)=lower(btrim(p_form))
      and nullif(btrim(b.topic),'') is not null
    group by b.subject::text,b.topic::text
    having count(distinct b.id)>=5
  ) ready;
  return v_topics;
end;
$$;
revoke all on function public.student_list_topic_practice_topics(text) from public,anon;
grant execute on function public.student_list_topic_practice_topics(text) to authenticated;

-- Never reveal a correct answer until the authenticated learner has an
-- existing canonical scored attempt for this exact question/session.
create or replace function public.student_get_topic_practice_feedback(
  p_exam_question_id uuid, p_session_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare
  v_student uuid;
  v_correct integer;
  v_explanation text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_student := public.current_student_id();
  if v_student is null then raise exception 'learner_identity_not_found'; end if;
  if p_exam_question_id is null or p_session_id is null then raise exception 'invalid_practice_identity'; end if;
  if not exists (
    select 1 from public.student_practice_attempts a
    where a.student_id=v_student and a.exam_question_id=p_exam_question_id
      and a.session_id=p_session_id
  ) then raise exception 'feedback_not_yet_available'; end if;
  select b.correct_index,b.explanation into v_correct,v_explanation
  from public.exam_question_bank b
  where b.id=p_exam_question_id and b.status='active'
    and b.provenance_status in ('teacher_verified','publisher_verified','official_verified');
  if not found then raise exception 'question_not_available'; end if;
  return jsonb_build_object('correct_index',v_correct,'explanation',v_explanation);
end;
$$;
revoke all on function public.student_get_topic_practice_feedback(uuid,uuid) from public,anon;
grant execute on function public.student_get_topic_practice_feedback(uuid,uuid) to authenticated;
