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

  perform public.twin_record_verified_practice_effect(v_uid,p_outcome_id,v_intervention_type,v_intervention_key,false,null,jsonb_build_object('source','adaptive_generated_practice','misconception_type',v_type,'generated_question_id',p_question_id));

  return jsonb_build_object('misconception_type',v_type,'claim',v_claim,'intervention_type',v_intervention_type,'intervention_key',v_intervention_key);
end;$function$;

revoke execute on function public.student_record_adaptive_misconception(uuid,uuid,uuid,integer,integer) from public,anon;
grant execute on function public.student_record_adaptive_misconception(uuid,uuid,uuid,integer,integer) to authenticated;

create or replace function public.student_get_adaptive_intervention(p_outcome_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_uid uuid:=auth.uid(); v_student_id uuid; v_effect record; v_claim record; v_type text; v_key text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  select * into v_effect from public.student_twin_intervention_effects
  where student_id=v_student_id and (outcome_id=p_outcome_id or outcome_id is null)
  order by case when outcome_id=p_outcome_id then 0 else 1 end, confidence desc, effectiveness_score desc, last_observed_at desc nulls last
  limit 1;
  if found and coalesce(v_effect.confidence,0)>=0.2 then
    return jsonb_build_object('intervention_type',v_effect.intervention_type,'intervention_key',v_effect.intervention_key,'source','learned_effectiveness','effectiveness_score',v_effect.effectiveness_score,'confidence',v_effect.confidence);
  end if;

  select * into v_claim from public.student_twin_memory_claims
  where student_id=v_student_id and outcome_id=p_outcome_id and memory_type='misconception' and status='active'
  order by confidence desc,last_confirmed_at desc limit 1;
  v_type:=coalesce(v_claim.source_summary->>'misconception_type','incorrect_application');
  v_key:=case v_type when 'concept_confusion' then 'worked_example' when 'condition_omission' then 'socratic_condition_check' else 'step_by_step_scaffold' end;
  return jsonb_build_object('intervention_type',case v_type when 'concept_confusion' then 'worked_example' when 'condition_omission' then 'guided_questioning' else 'scaffolded_practice' end,'intervention_key',v_key,'source','misconception_fallback','confidence',coalesce(v_claim.confidence,0));
end;$function$;

revoke execute on function public.student_get_adaptive_intervention(uuid) from public,anon;
grant execute on function public.student_get_adaptive_intervention(uuid) to authenticated;
