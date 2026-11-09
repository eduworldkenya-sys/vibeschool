-- Ensure practice delivery and scoring use the same canonical learner identity.
-- Ambiguous linked students now fail closed via current_student_id(), not LIMIT 1.

CREATE OR REPLACE FUNCTION public.student_list_vibelearn_practice_questions(p_subject text DEFAULT NULL::text, p_topic text DEFAULT NULL::text, p_form text DEFAULT NULL::text, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_profile uuid := auth.uid();
  v_student uuid;
  v_limit integer := greatest(1, least(coalesce(p_limit,20),20));
  v_questions jsonb;
begin
  if v_profile is null then raise exception 'Authentication required'; end if;
  v_student := public.current_student_id();
  if v_student is null then raise exception 'Learner profile not found'; end if;

  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_questions
  from (
    select b.id, b.subject::text as subject, b.form::text as form,
           b.topic, b.difficulty::text as difficulty, b.question, b.options, b.hint
    from public.exam_question_bank b
    where b.status='active'
      and b.provenance_status in ('teacher_verified','publisher_verified','official_verified')
      and (nullif(btrim(p_subject),'') is null or lower(b.subject::text)=lower(btrim(p_subject)))
      and (nullif(btrim(p_topic),'') is null or lower(b.topic)=lower(btrim(p_topic)))
      and (nullif(btrim(p_form),'') is null or lower(b.form::text)=lower(btrim(p_form)))
    order by b.id
    limit v_limit
  ) q;
  return v_questions;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.student_record_vibelearn_practice_answer(p_exam_question_id uuid, p_selected_index integer, p_response_ms integer DEFAULT NULL::integer, p_session_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ declare v_user uuid:=auth.uid(); v_student uuid; q record; v_correct boolean; v_mistake uuid; v_prev integer:=0; v_next integer:=1; begin if v_user is null then raise exception 'Authentication required'; end if; if p_response_ms is not null and p_response_ms<0 then raise exception 'Invalid response time'; end if; v_student := public.current_student_id(); if v_student is null then raise exception 'Student profile not found'; end if; select id,subject::text subject,topic,difficulty::text difficulty,question,options,correct_index,explanation,hint into q from public.exam_question_bank where id=p_exam_question_id and status='active' and provenance_status in ('teacher_verified','publisher_verified','official_verified'); if q.id is null then raise exception 'Question not available'; end if; if p_selected_index<0 or p_selected_index>=jsonb_array_length(q.options) then raise exception 'Invalid answer option'; end if; v_correct:=p_selected_index=q.correct_index; insert into public.student_practice_attempts(student_id,exam_question_id,selected_index,correct_index,is_correct,subject,topic,difficulty,response_ms,session_id) values(v_student,q.id,p_selected_index,q.correct_index,v_correct,q.subject,q.topic,q.difficulty,p_response_ms,p_session_id); if not v_correct then insert into public.student_mistake_notebook(student_id,exam_question_id,subject,topic,prompt_snapshot,selected_index,correct_index,explanation_snapshot,hint_snapshot) values(v_student,q.id,q.subject,q.topic,q.question,p_selected_index,q.correct_index,q.explanation,q.hint) on conflict(student_id,exam_question_id) do update set selected_index=excluded.selected_index,repeat_count=public.student_mistake_notebook.repeat_count+1,status='open',last_missed_at=now(),resolved_at=null; select id into v_mistake from public.student_mistake_notebook where student_id=v_student and exam_question_id=q.id; insert into public.student_kcse_retest_schedule(student_id,subject,topic,source_mistake_id,due_date,interval_days,successful_retests,mastery_state,last_result,last_attempt_at,updated_at) values(v_student,q.subject,q.topic,v_mistake,current_date+1,1,0,'recovering',false,now(),now()) on conflict(student_id,subject,topic) do update set source_mistake_id=excluded.source_mistake_id,due_date=current_date+1,interval_days=1,successful_retests=0,mastery_state='recovering',last_result=false,last_attempt_at=now(),updated_at=now(); else select coalesce(successful_retests,0) into v_prev from public.student_kcse_retest_schedule where student_id=v_student and lower(subject)=lower(q.subject) and lower(topic)=lower(q.topic); if found then v_next:=case when v_prev<=0 then 3 when v_prev=1 then 7 when v_prev=2 then 14 else least(60,14+(v_prev-2)*7) end; update public.student_kcse_retest_schedule set successful_retests=successful_retests+1,interval_days=v_next,due_date=current_date+v_next,mastery_state=case when successful_retests+1>=3 then 'mastered' else 'stabilising' end,last_result=true,last_attempt_at=now(),updated_at=now() where student_id=v_student and lower(subject)=lower(q.subject) and lower(topic)=lower(q.topic); end if; end if; insert into public.student_learning_events(student_id,event_type,source_type,source_id,xp_awarded,occurred_at,metadata) values(v_student,'practice_answered','exam_question',q.id,case when v_correct then 2 else 1 end,now(),jsonb_build_object('subject',q.subject,'topic',q.topic,'correct',v_correct,'response_ms',p_response_ms,'session_id',p_session_id)); perform public.twin_record_verified_practice_effect(v_student,null,'exam_practice','exam_question:'||q.id::text,v_correct,p_response_ms,jsonb_build_object('source','student_record_vibelearn_practice_answer','subject',q.subject,'topic',q.topic,'difficulty',q.difficulty)); return jsonb_build_object('correct',v_correct,'explanation',q.explanation,'hint',q.hint,'mistake_id',v_mistake,'next_retest_days',case when v_correct then v_next else 1 end); end;$function$
;

revoke execute on function public.student_list_vibelearn_practice_questions(text,text,text,integer) from public,anon;
grant execute on function public.student_list_vibelearn_practice_questions(text,text,text,integer) to authenticated;
