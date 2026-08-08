create or replace function public.student_plan_adaptive_session(
  p_pace_override text default null,
  p_mode text default 'practice'
) returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_existing public.student_adaptive_learning_sessions%rowtype;
  v_brain jsonb;
  v_item jsonb;
  v_outcome_id uuid;
  v_effective numeric := 0;
  v_forgetting numeric := 0;
  v_confidence numeric := 0;
  v_base_minutes integer := 25;
  v_recommended text := 'steady';
  v_chosen text;
  v_minutes integer;
  v_reason text;
  v_evidence integer := 0;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_mode not in ('explain','practice','homework','revision','exam','challenge') then raise exception 'Unsupported session mode'; end if;
  if p_pace_override is not null and p_pace_override not in ('gentle','steady','fast') then raise exception 'Unsupported pace'; end if;

  select s.id into v_student_id from public.students s where s.profile_id=v_uid and s.deleted_at is null limit 1;
  if v_student_id is null then raise exception 'Learner identity not found'; end if;

  if p_pace_override is null then
    select * into v_existing
    from public.student_adaptive_learning_sessions
    where student_id=v_student_id and status='active' and created_at > now()-interval '12 hours'
    order by created_at desc limit 1;
    if v_existing.id is not null then
      return jsonb_build_object(
        'id',v_existing.id,'focus_outcome_id',v_existing.focus_outcome_id,'mode',v_existing.mode,
        'recommended_pace',v_existing.recommended_pace,'chosen_pace',v_existing.chosen_pace,
        'planned_minutes',v_existing.planned_minutes,'reason',v_existing.reason,'status',v_existing.status,
        'mastery_before',v_existing.mastery_before,'forgetting_risk_before',v_existing.forgetting_risk_before,
        'evidence_count_before',v_existing.evidence_count_before,'resumed',true
      );
    end if;
  end if;

  v_brain := coalesce(public.student_get_twin_brain(),'{}'::jsonb);
  v_confidence := coalesce(nullif(v_brain->>'confidence','')::numeric,0);
  v_base_minutes := greatest(10, least(90, coalesce(nullif(v_brain #>> '{study_time,session_minutes}','')::integer,25)));
  v_evidence := coalesce(nullif(v_brain #>> '{evidence,competency_evidence_count}','')::integer,0);

  select value into v_item
  from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value
  order by coalesce((value->>'effective_mastery')::numeric,(value->>'mastery_score')::numeric,0) asc,
           coalesce((value->>'forgetting_risk')::numeric,0) desc
  limit 1;

  v_outcome_id := nullif(v_item->>'outcome_id','')::uuid;
  v_effective := coalesce(nullif(v_item->>'effective_mastery','')::numeric,nullif(v_item->>'mastery_score','')::numeric,0);
  v_forgetting := coalesce(nullif(v_item->>'forgetting_risk','')::numeric,0);

  if v_effective < 50 or v_forgetting >= 0.60 then
    v_recommended := 'gentle';
    v_reason := 'Twin recommends a gentler session because this skill needs more support or is at higher forgetting risk.';
  elsif v_effective >= 80 and v_forgetting < 0.25 and v_confidence >= 0.65 then
    v_recommended := 'fast';
    v_reason := 'Twin recommends a faster session because the skill is secure and the evidence is reasonably confident.';
  else
    v_recommended := 'steady';
    v_reason := 'Twin recommends a steady session to balance explanation, practice and recall.';
  end if;

  v_chosen := coalesce(p_pace_override,v_recommended);
  v_minutes := case v_chosen when 'gentle' then greatest(10,round(v_base_minutes*0.90)::integer) when 'fast' then greatest(10,round(v_base_minutes*0.75)::integer) else v_base_minutes end;

  update public.student_adaptive_learning_sessions set status='abandoned',updated_at=now()
  where student_id=v_student_id and status='planned';

  insert into public.student_adaptive_learning_sessions(
    student_id,profile_id,focus_outcome_id,mode,recommended_pace,chosen_pace,planned_minutes,reason,
    mastery_before,forgetting_risk_before,evidence_count_before,plan
  ) values (
    v_student_id,v_uid,v_outcome_id,p_mode,v_recommended,v_chosen,v_minutes,v_reason,
    v_effective,v_forgetting,v_evidence,
    jsonb_build_object('brain_confidence',v_confidence,'base_minutes',v_base_minutes,'learner_override',p_pace_override is not null)
  ) returning id into v_id;

  return jsonb_build_object(
    'id',v_id,'focus_outcome_id',v_outcome_id,'mode',p_mode,'recommended_pace',v_recommended,
    'chosen_pace',v_chosen,'planned_minutes',v_minutes,'reason',v_reason,'status','planned',
    'mastery_before',v_effective,'forgetting_risk_before',v_forgetting,'evidence_count_before',v_evidence,'resumed',false
  );
end;
$function$;

revoke all on function public.student_plan_adaptive_session(text,text) from public, anon;
grant execute on function public.student_plan_adaptive_session(text,text) to authenticated;
