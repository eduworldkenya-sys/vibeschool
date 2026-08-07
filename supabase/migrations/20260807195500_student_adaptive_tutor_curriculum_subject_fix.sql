create or replace function public.student_generate_adaptive_practice_question(p_outcome_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_profile_id uuid:=auth.uid(); v_student_id uuid; v_outcome_id uuid; v_subject_id uuid;
  v_outcome_text text; v_outcome_code text; v_mastery numeric:=0; v_effective numeric:=0; v_forgetting numeric:=0; v_difficulty text:='scaffolded';
  v_qid uuid; v_prompt text; v_options jsonb; v_correct integer:=0; v_explanation text; v_hints jsonb; v_brain jsonb; v_item jsonb;
begin
  if v_profile_id is null then raise exception 'Authentication required'; end if;
  select s.id into v_student_id from public.students s where s.profile_id=v_profile_id and s.deleted_at is null limit 1;
  if v_student_id is null then raise exception 'Learner identity not found'; end if;
  v_brain:=coalesce(public.student_get_twin_brain(),'{}'::jsonb);

  if p_outcome_id is not null then
    select o.id,o.outcome_text,o.outcome_code,c.global_subject_id into v_outcome_id,v_outcome_text,v_outcome_code,v_subject_id
    from public.curriculum_learning_outcomes o left join public.curriculum c on c.id=o.curriculum_id
    where o.id=p_outcome_id and o.status in ('active','verified') limit 1;
  else
    select value into v_item
    from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value
    order by coalesce((value->>'effective_mastery')::numeric,(value->>'mastery_score')::numeric,0) asc,
             coalesce((value->>'forgetting_risk')::numeric,0) desc,
             coalesce((value->>'days_since_evidence')::numeric,999999) desc
    limit 1;
    v_outcome_id:=nullif(v_item->>'outcome_id','')::uuid;
    v_outcome_text:=v_item->>'outcome_text';
    v_outcome_code:=v_item->>'outcome_code';
  end if;

  if v_outcome_id is null then
    select o.id,o.outcome_text,o.outcome_code,c.global_subject_id into v_outcome_id,v_outcome_text,v_outcome_code,v_subject_id
    from public.curriculum_learning_outcomes o left join public.curriculum c on c.id=o.curriculum_id
    where o.status in ('active','verified') order by o.created_at limit 1;
  else
    select c.global_subject_id into v_subject_id from public.curriculum_learning_outcomes o left join public.curriculum c on c.id=o.curriculum_id where o.id=v_outcome_id;
  end if;
  if v_outcome_id is null then raise exception 'No active curriculum outcome is available'; end if;

  select mastery_score into v_mastery from public.student_outcome_mastery where student_id=v_student_id and outcome_id=v_outcome_id;
  select value into v_item from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value where value->>'outcome_id'=v_outcome_id::text limit 1;
  v_effective:=coalesce(nullif(v_item->>'effective_mastery','')::numeric,v_mastery,0);
  v_forgetting:=coalesce(nullif(v_item->>'forgetting_risk','')::numeric,0);
  if v_effective < 40 then v_difficulty:='scaffolded'; elsif v_effective < 60 then v_difficulty:='easy'; elsif v_effective < 80 then v_difficulty:='medium'; elsif v_forgetting > 0.45 then v_difficulty:='medium'; elsif v_effective < 92 then v_difficulty:='hard'; else v_difficulty:='challenge'; end if;

  v_prompt := format('Adaptive practice for %s: Which answer correctly shows %s? Choose the best option.', coalesce(v_outcome_code,'this outcome'), v_outcome_text);
  v_options := jsonb_build_array('A correct application of the learning outcome','A common misconception about the outcome','An unrelated fact','A statement that ignores the key condition');
  v_explanation:=format('The correct choice directly applies the curriculum outcome: %s',v_outcome_text);
  v_hints:=jsonb_build_array('Focus on the exact skill named in the outcome.','Eliminate choices that are unrelated or contradict the key condition.','Choose the option that demonstrates the outcome directly.');

  insert into public.student_generated_practice_questions(student_id,outcome_id,subject_id,prompt,options,correct_index,explanation,hints,difficulty)
  values(v_student_id,v_outcome_id,v_subject_id,v_prompt,v_options,v_correct,v_explanation,v_hints,v_difficulty) returning id into v_qid;

  return jsonb_build_object('id',v_qid,'outcome_id',v_outcome_id,'outcome_code',v_outcome_code,'outcome_text',v_outcome_text,'subject_id',v_subject_id,'prompt',v_prompt,'options',v_options,'difficulty',v_difficulty,'hints',v_hints,'mastery_before',v_mastery,'effective_mastery_before',v_effective,'forgetting_risk',v_forgetting);
end;$function$;
