create or replace function public.student_get_twin_mastery()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_outcomes jsonb := '[]'::jsonb;
  v_subjects jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_confidence numeric := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'outcome_id',q.outcome_id,'outcome_code',q.outcome_code,'outcome_text',q.outcome_text,
    'mastery_level',q.mastery_level,'mastery_score',q.mastery_score,'effective_mastery',q.effective_mastery,
    'evidence_count',q.evidence_count,'last_evidence_at',q.last_evidence_at,'days_since_evidence',q.days_since_evidence,
    'forgetting_risk',q.forgetting_risk,'confidence',q.confidence
  ) order by q.forgetting_risk desc, q.effective_mastery asc),'[]'::jsonb), count(*)
  into v_outcomes,v_total
  from (
    select som.outcome_id,clo.outcome_code,clo.outcome_text,som.mastery_level,som.mastery_score,som.evidence_count,som.last_evidence_at,
      case when som.last_evidence_at is null then null else floor(extract(epoch from (now()-som.last_evidence_at))/86400.0)::integer end days_since_evidence,
      round(least(1,greatest(0,coalesce(extract(epoch from (now()-som.last_evidence_at))/86400.0,30)/30.0 * case when coalesce(som.mastery_score,0)>=70 then 0.7 else 1 end))::numeric,3) forgetting_risk,
      round(least(1,greatest(0,som.evidence_count/5.0))::numeric,3) confidence,
      round((coalesce(som.mastery_score,0) * (1 - least(0.35,greatest(0,coalesce(extract(epoch from (now()-som.last_evidence_at))/86400.0,30)/120.0))))::numeric,1) effective_mastery
    from public.student_outcome_mastery som
    join public.curriculum_learning_outcomes clo on clo.id=som.outcome_id
    where som.student_id=v_student_id and clo.status in ('active','verified')
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object(
    'subject_id',ssp.subject_id,'subject_name',s.name,'completed_tasks',ssp.completed_tasks,'total_tasks',ssp.total_tasks,
    'average_score',ssp.average_score,'mastery_percentage',ssp.mastery_percentage,
    'confidence',round(least(1,greatest(0,ssp.total_tasks/8.0))::numeric,3)
  ) order by coalesce(ssp.mastery_percentage,ssp.average_score,0) asc),'[]'::jsonb)
  into v_subjects
  from public.student_subject_progress ssp join public.subjects s on s.id=ssp.subject_id
  where ssp.student_id=v_student_id;

  select round(least(1,greatest(0,coalesce(avg((x->>'confidence')::numeric),0)))::numeric,3)
  into v_confidence from jsonb_array_elements(v_outcomes) x;

  return jsonb_build_object('student_id',v_student_id,'outcomes',v_outcomes,'subjects',v_subjects,'outcome_count',v_total,'confidence',coalesce(v_confidence,0));
end;
$function$;

create or replace function public.student_get_twin_prediction()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_mastery jsonb;
  v_outcomes jsonb;
  v_avg numeric;
  v_risk numeric;
  v_conf numeric;
begin
  v_mastery := public.student_get_twin_mastery();
  v_outcomes := coalesce(v_mastery->'outcomes','[]'::jsonb);
  select round(avg((x->>'effective_mastery')::numeric),1), round(avg((x->>'forgetting_risk')::numeric),3)
  into v_avg,v_risk from jsonb_array_elements(v_outcomes) x;
  v_conf := coalesce((v_mastery->>'confidence')::numeric,0);
  return jsonb_build_object(
    'average_effective_mastery',v_avg,'average_forgetting_risk',coalesce(v_risk,0),'confidence',v_conf,
    'at_risk_outcomes',coalesce((select jsonb_agg(x) from (select x from jsonb_array_elements(v_outcomes) x where coalesce((x->>'forgetting_risk')::numeric,0)>=0.5 or coalesce((x->>'effective_mastery')::numeric,0)<55 order by coalesce((x->>'forgetting_risk')::numeric,0) desc,coalesce((x->>'effective_mastery')::numeric,0) asc limit 8) q),'[]'::jsonb),
    'basis','verified_mastery_and_evidence_recency',
    'disclaimer','Projection is based only on available Vibeschool evidence and is not an official examination prediction.'
  );
end;
$function$;

create or replace function public.student_get_twin_priority()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid:=auth.uid(); v_student_id uuid; v_tasks jsonb:='[]'::jsonb; v_task jsonb; v_now jsonb; v_next jsonb:='[]'::jsonb; v_later jsonb:='[]'::jsonb; v_intervention jsonb; v_rec jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  select coalesce(public.student_list_my_tasks()->'tasks','[]'::jsonb) into v_tasks;

  select x into v_task from jsonb_array_elements(v_tasks) x
  where coalesce(x->>'status','') in ('overdue','returned','in_progress','ready')
  order by case x->>'status' when 'overdue' then 0 when 'returned' then 1 when 'in_progress' then 2 else 3 end,
           case x->>'priority' when 'urgent' then 0 when 'high' then 1 else 2 end,
           nullif(x->>'due_at','')::timestamptz nulls last limit 1;
  if v_task is not null then v_now:=v_task||jsonb_build_object('decision_type','task'); end if;

  if v_now is null then
    select jsonb_build_object('decision_type','intervention','id',ai.id,'title','Teacher priority','subject_id',ai.subject_id,'outcome_id',ai.outcome_id,'reason',ai.recommendation,'priority',ai.priority,'confidence',ai.confidence_score,'action_url','/student/vibelearn')
    into v_intervention from public.assessment_interventions ai where ai.student_id=v_student_id and ai.status in ('open','active','planned') order by case ai.priority when 'urgent' then 0 when 'high' then 1 else 2 end,ai.due_at nulls last limit 1;
    v_now:=v_intervention;
  end if;

  if v_now is null then
    perform public.student_refresh_personalized_path();
    select jsonb_build_object('decision_type','recommendation','id',r.id,'title',r.title,'subject_id',r.subject_id,'outcome_id',r.outcome_id,'reason',r.reason,'priority_score',r.priority_score,'confidence',r.confidence_score,'action_url','/student/vibelearn')
    into v_rec from public.student_learning_recommendations r where r.student_id=v_student_id and r.status='active' order by r.priority_score desc limit 1;
    v_now:=v_rec;
  end if;

  select coalesce(jsonb_agg(y),'[]'::jsonb) into v_next from (
    select x||jsonb_build_object('decision_type','task') y from jsonb_array_elements(v_tasks) x
    where coalesce(x->>'status','') in ('overdue','returned','in_progress','ready','upcoming')
      and (v_now is null or v_now->>'decision_type'<>'task' or x->>'task_id'<>v_now->>'task_id')
    order by case x->>'status' when 'overdue' then 0 when 'returned' then 1 when 'in_progress' then 2 when 'ready' then 3 else 4 end,nullif(x->>'due_at','')::timestamptz nulls last limit 3
  ) q;
  select coalesce(jsonb_agg(y),'[]'::jsonb) into v_later from (
    select x||jsonb_build_object('decision_type','task') y from jsonb_array_elements(v_tasks) x
    where coalesce(x->>'status','') in ('ready','upcoming') order by nullif(x->>'due_at','')::timestamptz nulls last limit 6
  ) q;
  return jsonb_build_object('student_id',v_student_id,'now',v_now,'next',v_next,'later',v_later,'rule','deadline_then_revision_then_resume_then_teacher_intervention_then_mastery_recommendation');
end;
$function$;

revoke all on function public.student_get_twin_mastery() from public,anon;
revoke all on function public.student_get_twin_prediction() from public,anon;
revoke all on function public.student_get_twin_priority() from public,anon;
grant execute on function public.student_get_twin_mastery() to authenticated,service_role;
grant execute on function public.student_get_twin_prediction() to authenticated,service_role;
grant execute on function public.student_get_twin_priority() to authenticated,service_role;
