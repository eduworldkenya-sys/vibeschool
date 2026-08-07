create or replace function public.student_get_evidence_learning_preferences()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_uid uuid:=auth.uid(); v_student_id uuid; v_fast numeric; v_slow numeric; v_strategy jsonb; v_pref text; v_conf numeric;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  select avg((metadata->>'response_ms')::numeric) filter (where coalesce((metadata->>'correct')::boolean,false)=true),
         avg((metadata->>'response_ms')::numeric) filter (where coalesce((metadata->>'correct')::boolean,false)=false)
    into v_fast,v_slow
  from public.student_learning_events
  where student_id=v_student_id and source_type='adaptive_generated_question' and metadata ? 'response_ms' and metadata->>'response_ms' is not null;
  select public.student_get_adaptive_intervention((select outcome_id from public.student_outcome_mastery where student_id=v_student_id order by mastery_score asc limit 1)) into v_strategy;
  v_pref:=case when coalesce(v_fast,0)>0 and coalesce(v_slow,0)>v_fast*1.5 then 'slower_scaffolded_pacing' when coalesce(v_strategy->>'intervention_key','')<>'' then v_strategy->>'intervention_key' else 'evidence_building' end;
  v_conf:=least(0.9,0.15 + 0.05*(select count(*) from public.student_learning_events where student_id=v_student_id and source_type='adaptive_generated_question'));
  return jsonb_build_object('preference',v_pref,'confidence',v_conf,'correct_response_ms',v_fast,'incorrect_response_ms',v_slow,'strategy',v_strategy,'rule','Derived from observed learner performance; declared preferences are fallback only.');
end;$function$;
revoke execute on function public.student_get_evidence_learning_preferences() from public,anon;
grant execute on function public.student_get_evidence_learning_preferences() to authenticated;

create or replace function public.student_get_adaptive_reading_coach()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_uid uuid:=auth.uid(); v_student_id uuid; v_brain jsonb; v_weak jsonb; v_continue jsonb; v_prompt text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  v_brain:=public.student_get_twin_brain();
  select value into v_weak from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value order by coalesce((value->>'effective_mastery')::numeric,0) asc limit 1;
  begin select public.get_continue_reading() into v_continue; exception when others then v_continue:='[]'::jsonb; end;
  v_prompt:=case when v_weak is null then 'Read a short section, summarize it in your own words, then answer one retrieval question.' else format('While reading, look for ideas connected to: %s. Pause after a short section and explain the idea in your own words.',v_weak->>'outcome_text') end;
  return jsonb_build_object('focus_outcome_id',v_weak->>'outcome_id','focus_outcome',v_weak->>'outcome_text','effective_mastery',v_weak->>'effective_mastery','prompt',v_prompt,'continue_reading',coalesce(v_continue,'[]'::jsonb),'method','read-explain-retrieve-review');
end;$function$;
revoke execute on function public.student_get_adaptive_reading_coach() from public,anon;
grant execute on function public.student_get_adaptive_reading_coach() to authenticated;

create or replace function public.student_get_adaptive_reflection_coach(p_outcome_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_uid uuid:=auth.uid(); v_student_id uuid; v_brain jsonb; v_outcome jsonb; v_memory jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  v_brain:=public.student_get_twin_brain();
  if p_outcome_id is null then select value into v_outcome from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value order by coalesce((value->>'effective_mastery')::numeric,0) asc limit 1;
  else select value into v_outcome from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value where value->>'outcome_id'=p_outcome_id::text limit 1; end if;
  select coalesce(jsonb_agg(jsonb_build_object('claim',claim_text,'confidence',confidence,'type',memory_type) order by confidence desc),'[]'::jsonb) into v_memory from public.student_twin_memory_claims where student_id=v_student_id and (p_outcome_id is null or outcome_id=p_outcome_id) and status='active';
  return jsonb_build_object('outcome',v_outcome,'prompts',jsonb_build_array('What did you understand better this time?','Where did you hesitate or make a mistake?','Which hint or strategy helped most?','What will you do first when you see a similar problem again?'),'memory_context',v_memory,'purpose','metacognition_and_next_strategy');
end;$function$;
revoke execute on function public.student_get_adaptive_reflection_coach(uuid) from public,anon;
grant execute on function public.student_get_adaptive_reflection_coach(uuid) to authenticated;

create or replace function public.student_get_adaptive_project_coach(p_project_title text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_uid uuid:=auth.uid(); v_brain jsonb; v_now jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_brain:=public.student_get_twin_brain(); v_now:=v_brain #> '{decision,now}';
  return jsonb_build_object('title',coalesce(nullif(trim(p_project_title),''),'My project'),'steps',jsonb_build_array('Define the question or product','List what you already know','Find curriculum-linked evidence or resources','Make a small plan','Create the first draft or prototype','Check it against the task requirements','Reflect and improve'),'current_twin_priority',v_now,'guardrail','Project coaching supports planning and reasoning; it does not fabricate teacher approval, marks or completion.');
end;$function$;
revoke execute on function public.student_get_adaptive_project_coach(text) from public,anon;
grant execute on function public.student_get_adaptive_project_coach(text) to authenticated;

create or replace function public.student_explain_twin_choice(p_outcome_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_brain jsonb; v_outcome jsonb; v_intervention jsonb; v_memory jsonb;
begin
  v_brain:=public.student_get_twin_brain();
  if p_outcome_id is null then select value into v_outcome from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value order by coalesce((value->>'effective_mastery')::numeric,0) asc limit 1;
  else select value into v_outcome from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value where value->>'outcome_id'=p_outcome_id::text limit 1; end if;
  if v_outcome is not null then v_intervention:=public.student_get_adaptive_intervention((v_outcome->>'outcome_id')::uuid); else v_intervention:='{}'::jsonb; end if;
  v_memory:=coalesce(v_brain #> '{adaptation,memory}','{}'::jsonb);
  return jsonb_build_object('now',v_brain #> '{decision,now}','outcome',v_outcome,'intervention',v_intervention,'memory',v_memory,'explanation',format('Twin selected this path using teacher priority first, then effective mastery, forgetting risk, prerequisite readiness, learner memory, and observed intervention effectiveness.'));
end;$function$;
revoke execute on function public.student_explain_twin_choice(uuid) from public,anon;
grant execute on function public.student_explain_twin_choice(uuid) to authenticated;
