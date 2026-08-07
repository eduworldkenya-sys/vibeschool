create or replace function public.student_get_adaptive_teaching_turn(p_outcome_id uuid,p_stage integer default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_intervention jsonb; v_stage integer:=greatest(0,least(3,coalesce(p_stage,0))); v_prompt text;
begin
  v_intervention:=public.student_get_adaptive_intervention(p_outcome_id);
  v_prompt:=case v_stage
    when 0 then 'Before I explain, tell me what part of the question you think matters most.'
    when 1 then 'Hint 1: identify the exact condition or concept in the learning outcome before choosing a method.'
    when 2 then 'Hint 2: break the problem into one small step and test that step against the outcome.'
    else 'Worked example: apply the outcome step by step, explain why each step is valid, then try a similar question yourself.'
  end;
  return jsonb_build_object('stage',v_stage,'mode',case when v_stage=0 then 'socratic_question' when v_stage<3 then 'hint' else 'worked_example' end,'prompt',v_prompt,'intervention',v_intervention,'next_stage',least(3,v_stage+1));
end;$function$;
revoke execute on function public.student_get_adaptive_teaching_turn(uuid,integer) from public,anon;
grant execute on function public.student_get_adaptive_teaching_turn(uuid,integer) to authenticated;

create or replace function public.student_mastery_band(p_score numeric)
returns text language sql immutable as $$
  select case when p_score is null then 'not_started' when p_score < 40 then 'beginning' when p_score < 60 then 'developing' when p_score < 80 then 'secure' when p_score < 92 then 'mastered' else 'automatic' end
$$;
grant execute on function public.student_mastery_band(numeric) to authenticated;

create or replace function public.student_get_adaptive_learning_path()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_uid uuid:=auth.uid(); v_student_id uuid; v_brain jsonb; v_path jsonb; v_revision_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  v_revision_count:=public.student_schedule_forgetting_revision();
  v_brain:=public.student_get_twin_brain();
  select coalesce(jsonb_agg(item order by priority asc),'[]'::jsonb) into v_path
  from (
    select jsonb_build_object('kind','outcome','outcome_id',x.outcome_id,'outcome_text',x.outcome_text,'effective_mastery',x.effective_mastery,'forgetting_risk',x.forgetting_risk,'mastery_band',public.student_mastery_band(x.effective_mastery),'prerequisites',public.student_get_prerequisite_status(x.outcome_id),'priority',x.priority) as item,x.priority
    from (
      select nullif(value->>'outcome_id','')::uuid as outcome_id,value->>'outcome_text' as outcome_text,coalesce((value->>'effective_mastery')::numeric,0) effective_mastery,coalesce((value->>'forgetting_risk')::numeric,0) forgetting_risk,
             row_number() over(order by coalesce((value->>'effective_mastery')::numeric,0) asc,coalesce((value->>'forgetting_risk')::numeric,0) desc)::int priority
      from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value
    ) x
  ) q;
  return jsonb_build_object('student_id',v_student_id,'now',v_brain #> '{decision,now}','next',v_brain #> '{decision,next}','path',v_path,'revision_items_created',v_revision_count,'rule','teacher obligations first; then unmet prerequisites; then weakest effective mastery; then forgetting risk');
end;$function$;
revoke execute on function public.student_get_adaptive_learning_path() from public,anon;
grant execute on function public.student_get_adaptive_learning_path() to authenticated;
