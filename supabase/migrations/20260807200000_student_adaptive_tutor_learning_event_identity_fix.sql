create or replace function public.student_answer_adaptive_practice_question(p_question_id uuid,p_selected_index integer,p_response_ms integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_profile_id uuid:=auth.uid(); v_student_id uuid; v_q public.student_generated_practice_questions%rowtype; v_correct boolean; v_event_id uuid; v_evidence_id uuid; v_mistake_id uuid; v_mastery_after numeric; v_effective_after numeric; v_forgetting_after numeric; v_brain jsonb; v_item jsonb;
begin
  if v_profile_id is null then raise exception 'Authentication required'; end if;
  select id into v_student_id from public.students where profile_id=v_profile_id and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'Learner identity not found'; end if;
  select * into v_q from public.student_generated_practice_questions where id=p_question_id and student_id=v_student_id and status='active';
  if not found then raise exception 'Adaptive practice question not available'; end if;
  if p_selected_index<0 or p_selected_index>=jsonb_array_length(v_q.options) then raise exception 'Invalid answer option'; end if;
  if p_response_ms is not null and p_response_ms<0 then raise exception 'Invalid response time'; end if;
  v_correct:=p_selected_index=v_q.correct_index;

  insert into public.student_learning_events(student_id,event_type,source_type,source_id,subject_id,xp_awarded,occurred_at,metadata)
  values(v_student_id,'practice_answered','adaptive_generated_question',v_q.id,v_q.subject_id,case when v_correct then 2 else 1 end,now(),jsonb_build_object('outcome_id',v_q.outcome_id,'correct',v_correct,'selected_index',p_selected_index,'correct_index',v_q.correct_index,'difficulty',v_q.difficulty,'response_ms',p_response_ms,'generation_source',v_q.generation_source)) returning id into v_event_id;

  insert into public.competency_evidence_ledger(student_id,outcome_id,evidence_source,evidence_id,score,max_score,proficiency,observed_by,observed_at,notes,weight,subject_id)
  values(v_student_id,v_q.outcome_id,'quiz',v_event_id,case when v_correct then 1 else 0 end,1,case when v_correct then 'meeting' else 'needs_intervention' end,v_profile_id,now(),'Adaptive generated practice question',1,v_q.subject_id) returning id into v_evidence_id;

  if not v_correct then
    insert into public.student_mistake_notebook(student_id,exam_question_id,subject,topic,prompt_snapshot,selected_index,correct_index,explanation_snapshot,hint_snapshot,repeat_count,status,first_missed_at,last_missed_at,outcome_id)
    values(v_student_id,null,coalesce((select name from public.subjects where id=v_q.subject_id),'General'),coalesce((select outcome_code from public.curriculum_learning_outcomes where id=v_q.outcome_id),'Adaptive practice'),v_q.prompt,p_selected_index,v_q.correct_index,v_q.explanation,coalesce(v_q.hints->>0,'Review the learning outcome and retry.'),1,'open',now(),now(),v_q.outcome_id)
    returning id into v_mistake_id;
  end if;

  update public.student_generated_practice_questions set status='answered',answered_at=now() where id=v_q.id;
  select mastery_score into v_mastery_after from public.student_outcome_mastery where student_id=v_student_id and outcome_id=v_q.outcome_id;
  v_brain:=coalesce(public.student_get_twin_brain(),'{}'::jsonb);
  select value into v_item from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value where value->>'outcome_id'=v_q.outcome_id::text limit 1;
  v_effective_after:=coalesce(nullif(v_item->>'effective_mastery','')::numeric,v_mastery_after);
  v_forgetting_after:=coalesce(nullif(v_item->>'forgetting_risk','')::numeric,0);

  return jsonb_build_object('ok',true,'correct',v_correct,'correct_index',v_q.correct_index,'explanation',v_q.explanation,'learning_event_id',v_event_id,'evidence_id',v_evidence_id,'mistake_id',v_mistake_id,'mastery_after',v_mastery_after,'effective_mastery_after',v_effective_after,'forgetting_risk_after',v_forgetting_after,'next_question',public.student_generate_adaptive_practice_question(v_q.outcome_id));
end;$function$;
