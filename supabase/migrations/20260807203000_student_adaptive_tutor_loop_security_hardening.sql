create or replace function public.student_mastery_band(p_score numeric)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when p_score is null then 'not_started' when p_score < 40 then 'beginning' when p_score < 60 then 'developing' when p_score < 80 then 'secure' when p_score < 92 then 'mastered' else 'automatic' end
$$;
revoke execute on function public.student_mastery_band(numeric) from public, anon;
grant execute on function public.student_mastery_band(numeric) to authenticated;

create or replace function public.student_record_adaptive_misconception(
  p_outcome_id uuid,
  p_subject_id uuid,
  p_question_id uuid,
  p_selected_index integer,
  p_correct_index integer
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_uid uuid:=auth.uid(); v_student_id uuid; v_key text; v_type text; v_claim text; v_effect record; v_intervention_type text; v_intervention_key text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  v_type := case
    when p_selected_index = p_correct_index then 'none'
    when p_selected_index = 1 then 'concept_confusion'
    when p_selected_index = 2 then 'irrelevant_rule_selection'
    when p_selected_index = 3 then 'condition_omission'
    else 'incorrect_application'
  end;
  v_key := 'adaptive_misconception:'||p_outcome_id::text||':'||v_type;
  v_claim := case v_type
    when 'concept_confusion' then 'Learner may be confusing the target concept with a common misconception.'
    when 'irrelevant_rule_selection' then 'Learner may be selecting an unrelated rule or fact instead of applying the target outcome.'
    when 'condition_omission' then 'Learner may be overlooking a key condition in the learning outcome.'
    else 'Learner may be applying the target outcome incorrectly.'
  end;

  insert into public.student_twin_memory_claims(student_id,subject_id,outcome_id,memory_type,claim_key,claim_text,confidence,evidence_count,last_confirmed_at,status,source_summary,importance,learning_impact,memory_scope,permanence,relationship_refs,provenance)
  values(v_student_id,p_subject_id,p_outcome_id,'misconception',v_key,v_claim,0.45,1,now(),'active',jsonb_build_object('generated_question_id',p_question_id,'selected_index',p_selected_index,'correct_index',p_correct_index,'misconception_type',v_type),0.8,-0.7,'learner','adaptive',jsonb_build_object('outcome_id',p_outcome_id),jsonb_build_object('source','adaptive_generated_practice'))
  on conflict(student_id,memory_type,claim_key) do update set
    confidence=least(0.95,student_twin_memory_claims.confidence+0.1),
    evidence_count=student_twin_memory_claims.evidence_count+1,
    last_confirmed_at=now(),status='active',
    source_summary=student_twin_memory_claims.source_summary||excluded.source_summary,
    updated_at=now();

  select * into v_effect from public.student_twin_intervention_effects
  where student_id=v_student_id and (outcome_id=p_outcome_id or outcome_id is null)
  order by case when outcome_id=p_outcome_id then 0 else 1 end, confidence desc, effectiveness_score desc, last_observed_at desc nulls last
  limit 1;

  if found and coalesce(v_effect.confidence,0)>=0.2 then
    v_intervention_type:=v_effect.intervention_type;
    v_intervention_key:=v_effect.intervention_key;
  else
    v_intervention_type:=case v_type when 'concept_confusion' then 'worked_example' when 'condition_omission' then 'guided_questioning' else 'scaffolded_practice' end;
    v_intervention_key:=case v_type when 'concept_confusion' then 'worked_example' when 'condition_omission' then 'socratic_condition_check' else 'step_by_step_scaffold' end;
  end if;

  return jsonb_build_object('misconception_type',v_type,'claim',v_claim,'intervention_type',v_intervention_type,'intervention_key',v_intervention_key);
end;$function$;

create or replace function public.student_answer_adaptive_practice_question(p_question_id uuid,p_selected_index integer,p_response_ms integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_profile_id uuid:=auth.uid(); v_student_id uuid; v_q public.student_generated_practice_questions%rowtype; v_correct boolean; v_event_id uuid; v_evidence_id uuid; v_mistake_id uuid; v_mastery_after numeric; v_effective_after numeric; v_forgetting_after numeric; v_brain jsonb; v_item jsonb; v_misconception jsonb:='{}'::jsonb; v_intervention jsonb:='{}'::jsonb; v_intervention_type text; v_intervention_key text;
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
    insert into public.student_mistake_notebook(student_id,exam_question_id,subject,topic,prompt_snapshot,selected_index,correct_index,explanation_snapshot,hint_snapshot,repeat_count,status,first_missed_at,last_missed_at,outcome_id,generated_question_id)
    values(v_profile_id,null,coalesce((select name from public.subjects where id=v_q.subject_id),'General'),coalesce((select outcome_code from public.curriculum_learning_outcomes where id=v_q.outcome_id),'Adaptive practice'),v_q.prompt,p_selected_index,v_q.correct_index,v_q.explanation,coalesce(v_q.hints->>0,'Review the learning outcome and retry.'),1,'open',now(),now(),v_q.outcome_id,v_q.id)
    on conflict (student_id,generated_question_id) where generated_question_id is not null do update set repeat_count=student_mistake_notebook.repeat_count+1,status='open',last_missed_at=now(),resolved_at=null,selected_index=excluded.selected_index,correct_index=excluded.correct_index,explanation_snapshot=excluded.explanation_snapshot,hint_snapshot=excluded.hint_snapshot
    returning id into v_mistake_id;
    v_misconception:=public.student_record_adaptive_misconception(v_q.outcome_id,v_q.subject_id,v_q.id,p_selected_index,v_q.correct_index);
    v_intervention:=v_misconception;
  else
    update public.student_mistake_notebook set status='resolved',resolved_at=now(),last_correct_at=now()
    where student_id=v_profile_id and outcome_id=v_q.outcome_id and generated_question_id is not null and status<>'resolved';
    v_intervention:=public.student_get_adaptive_intervention(v_q.outcome_id);
  end if;

  v_intervention_type:=coalesce(v_intervention->>'intervention_type','scaffolded_practice');
  v_intervention_key:=coalesce(v_intervention->>'intervention_key','step_by_step_scaffold');
  perform public.twin_record_verified_practice_effect(v_profile_id,v_q.outcome_id,v_intervention_type,v_intervention_key,v_correct,p_response_ms,jsonb_build_object('source','adaptive_generated_practice','generated_question_id',v_q.id,'difficulty',v_q.difficulty,'misconception',v_misconception));

  update public.student_generated_practice_questions set status='answered',answered_at=now() where id=v_q.id;
  select mastery_score into v_mastery_after from public.student_outcome_mastery where student_id=v_student_id and outcome_id=v_q.outcome_id;
  v_brain:=coalesce(public.student_get_twin_brain(),'{}'::jsonb);
  select value into v_item from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value where value->>'outcome_id'=v_q.outcome_id::text limit 1;
  v_effective_after:=coalesce(nullif(v_item->>'effective_mastery','')::numeric,v_mastery_after);
  v_forgetting_after:=coalesce(nullif(v_item->>'forgetting_risk','')::numeric,0);

  return jsonb_build_object('ok',true,'correct',v_correct,'correct_index',v_q.correct_index,'explanation',v_q.explanation,'learning_event_id',v_event_id,'evidence_id',v_evidence_id,'mistake_id',v_mistake_id,'misconception',v_misconception,'intervention',v_intervention,'mastery_after',v_mastery_after,'effective_mastery_after',v_effective_after,'forgetting_risk_after',v_forgetting_after,'next_question',public.student_generate_adaptive_practice_question(v_q.outcome_id));
end;$function$;
