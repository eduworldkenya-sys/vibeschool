create or replace function public.student_get_twin_evidence()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_competency_count integer := 0;
  v_learning_event_count integer := 0;
  v_task_receipt_count integer := 0;
  v_calibration_count integer := 0;
  v_verified_calibration_count integer := 0;
  v_mean_absolute_error numeric := null;
  v_latest_evidence_at timestamptz := null;
  v_snapshot_generated_at timestamptz := null;
  v_state_confidence numeric := 0;
  v_recent jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  select count(*), max(observed_at) into v_competency_count,v_latest_evidence_at
  from public.competency_evidence_ledger where student_id=v_student_id;
  select count(*) into v_learning_event_count from public.student_learning_events where student_id=v_student_id;
  select count(*) into v_task_receipt_count from public.student_task_execution_receipts where student_id=v_student_id;
  select count(*) filter(where resolved_at is not null),
         count(*) filter(where resolved_at is not null and coalesce((metadata->>'authoritative')::boolean,false)),
         round(avg(absolute_error) filter(where resolved_at is not null and absolute_error is not null and coalesce((metadata->>'authoritative')::boolean,false))::numeric,3)
    into v_calibration_count,v_verified_calibration_count,v_mean_absolute_error
  from public.student_twin_calibration_events where student_id=v_student_id;
  select generated_at,confidence_score into v_snapshot_generated_at,v_state_confidence
  from public.student_twin_state_snapshots where student_id=v_student_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'prediction_type',q.prediction_type,'predicted_value',q.predicted_value,
    'actual_value',q.actual_value,'confidence',q.confidence_score,'absolute_error',q.absolute_error,
    'authoritative',q.authoritative,'source_type',q.source_type,'predicted_at',q.predicted_at,'resolved_at',q.resolved_at
  ) order by q.predicted_at desc),'[]'::jsonb)
  into v_recent
  from (
    select ce.id,ce.prediction_type,ce.predicted_value,ce.actual_value,ce.confidence_score,ce.absolute_error,
           coalesce((ce.metadata->>'authoritative')::boolean,false) authoritative,
           ce.source_type,ce.predicted_at,ce.resolved_at
    from public.student_twin_calibration_events ce
    where ce.student_id=v_student_id
    order by ce.predicted_at desc
    limit 10
  ) q;

  return jsonb_build_object(
    'student_id',v_student_id,
    'competency_evidence_count',v_competency_count,
    'learning_event_count',v_learning_event_count,
    'task_receipt_count',v_task_receipt_count,
    'calibration_count',v_calibration_count,
    'verified_calibration_count',v_verified_calibration_count,
    'mean_absolute_error',v_mean_absolute_error,
    'latest_evidence_at',v_latest_evidence_at,
    'snapshot_generated_at',v_snapshot_generated_at,
    'state_confidence',coalesce(v_state_confidence,0),
    'recent_calibrations',v_recent
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
  v_uid uuid:=auth.uid();
  v_student_id uuid;
  v_tasks jsonb:='[]'::jsonb;
  v_task jsonb;
  v_now jsonb;
  v_next jsonb:='[]'::jsonb;
  v_later jsonb:='[]'::jsonb;
  v_intervention jsonb;
  v_rec jsonb;
  v_reason text;
  v_reason_chain jsonb := '[]'::jsonb;
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

  if v_task is not null then
    v_reason := case v_task->>'status'
      when 'overdue' then 'This assigned task is overdue, so it has the highest immediate urgency.'
      when 'returned' then 'Your teacher returned this work for revision, so it should be corrected before starting new optional work.'
      when 'in_progress' then 'You already started this task, so finishing it preserves learning continuity.'
      else 'This is the highest-priority assigned task currently ready to do.' end;
    v_reason_chain := to_jsonb(array_remove(array[
      case v_task->>'status' when 'overdue' then 'Overdue' when 'returned' then 'Teacher returned' when 'in_progress' then 'Already started' else 'Ready now' end,
      case when v_task->>'priority'='urgent' then 'Urgent priority' when v_task->>'priority'='high' then 'High priority' else null end,
      case when nullif(v_task->>'due_at','') is not null then 'Deadline considered' else null end,
      case when nullif(v_task->>'subject','') is not null then v_task->>'subject' else null end
    ]::text[],null));
    v_now:=v_task||jsonb_build_object('decision_type','task','reason',v_reason,'reason_chain',v_reason_chain);
  end if;

  if v_now is null then
    select jsonb_build_object(
      'decision_type','intervention','id',ai.id,'title','Teacher priority','subject_id',ai.subject_id,'outcome_id',ai.outcome_id,
      'reason',ai.recommendation,'reason_chain',jsonb_build_array('Teacher priority',case ai.priority when 'urgent' then 'Urgent intervention' when 'high' then 'High-priority intervention' else 'Active intervention' end),
      'priority',ai.priority,'confidence',ai.confidence_score,'action_url','/student/vibelearn'
    ) into v_intervention
    from public.assessment_interventions ai
    where ai.student_id=v_student_id and ai.status in ('open','active','planned')
    order by case ai.priority when 'urgent' then 0 when 'high' then 1 else 2 end,ai.due_at nulls last limit 1;
    v_now:=v_intervention;
  end if;

  if v_now is null then
    perform public.student_refresh_personalized_path();
    select jsonb_build_object(
      'decision_type','recommendation','id',r.id,'title',r.title,'subject_id',r.subject_id,'outcome_id',r.outcome_id,
      'reason',r.reason,'reason_chain',jsonb_build_array('Evidence-based recommendation','Mastery and review timing considered'),
      'priority_score',r.priority_score,'confidence',r.confidence_score,'action_url','/student/vibelearn'
    ) into v_rec
    from public.student_learning_recommendations r
    where r.student_id=v_student_id and r.status='active'
    order by r.priority_score desc limit 1;
    v_now:=v_rec;
  end if;

  select coalesce(jsonb_agg(y),'[]'::jsonb) into v_next from (
    select x||jsonb_build_object('decision_type','task') y from jsonb_array_elements(v_tasks) x
    where coalesce(x->>'status','') in ('overdue','returned','in_progress','ready','upcoming')
      and (v_now is null or v_now->>'decision_type'<>'task' or x->>'task_id'<>v_now->>'task_id')
    order by case x->>'status' when 'overdue' then 0 when 'returned' then 1 when 'in_progress' then 2 when 'ready' then 3 else 4 end,
             nullif(x->>'due_at','')::timestamptz nulls last limit 3
  ) q;
  select coalesce(jsonb_agg(y),'[]'::jsonb) into v_later from (
    select x||jsonb_build_object('decision_type','task') y from jsonb_array_elements(v_tasks) x
    where coalesce(x->>'status','') in ('ready','upcoming')
    order by nullif(x->>'due_at','')::timestamptz nulls last limit 6
  ) q;

  return jsonb_build_object(
    'student_id',v_student_id,'now',v_now,'next',v_next,'later',v_later,
    'rule','deadline_then_revision_then_resume_then_teacher_intervention_then_mastery_recommendation'
  );
end;
$function$;

create or replace function public.student_get_twin_brain()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_state jsonb;
  v_mastery jsonb;
  v_prediction jsonb;
  v_priority jsonb;
  v_evidence jsonb;
  v_tutor jsonb;
  v_student_id uuid;
begin
  v_state := public.student_get_twin_state();
  v_mastery := public.student_get_twin_mastery();
  v_prediction := public.student_get_twin_prediction();
  v_priority := public.student_get_twin_priority();
  v_evidence := public.student_get_twin_evidence();
  v_student_id := nullif(v_state->>'student_id','')::uuid;

  v_tutor := jsonb_build_object(
    'mode','bounded','can_explain',true,'can_question',true,'can_hint',true,'can_generate_practice',true,
    'cannot_change_marks',true,'cannot_mark_verified_completion',true,'cannot_override_teacher_interventions',true,
    'cannot_claim_official_exam_prediction',true,'must_use_learner_evidence',true,'must_abstain_when_evidence_is_insufficient',true,
    'mastery',v_mastery,'prediction',v_prediction,'decision',v_priority,
    'interventions',coalesce(v_state->'interventions','[]'::jsonb),'curriculum',coalesce(v_state->'curriculum','{}'::jsonb)
  );

  v_state := v_state || jsonb_build_object('mastery',v_mastery,'prediction',v_prediction,'decision',v_priority,'evidence',v_evidence,'tutor',v_tutor);

  if v_student_id is not null then
    update public.student_twin_state_snapshots
       set state=v_state,
           confidence_score=coalesce((v_state->>'confidence')::numeric,confidence_score),
           evidence_count=coalesce((v_evidence->>'competency_evidence_count')::integer,evidence_count),
           generated_at=now(),updated_at=now()
     where student_id=v_student_id;
  end if;
  return v_state;
end;
$function$;

create or replace function public.student_get_twin_tutor_context()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_brain jsonb;
begin
  v_brain := public.student_get_twin_brain();
  return jsonb_build_object(
    'student_id',v_brain->'student_id','generated_at',v_brain->'generated_at','confidence',v_brain->'confidence',
    'curriculum',v_brain->'curriculum','mastery',v_brain->'mastery','interventions',v_brain->'interventions',
    'recommendations',v_brain->'recommendations','decision',v_brain->'decision','prediction',v_brain->'prediction',
    'evidence',v_brain->'evidence','exam',v_brain->'exam','study_time',v_brain->'study_time','guardrails',v_brain->'tutor'
  );
end;
$function$;

revoke all on function public.student_get_twin_evidence() from public,anon;
grant execute on function public.student_get_twin_evidence() to authenticated,service_role;
revoke all on function public.student_get_twin_priority() from public,anon;
grant execute on function public.student_get_twin_priority() to authenticated,service_role;
revoke all on function public.student_get_twin_brain() from public,anon;
grant execute on function public.student_get_twin_brain() to authenticated,service_role;
revoke all on function public.student_get_twin_tutor_context() from public,anon;
grant execute on function public.student_get_twin_tutor_context() to authenticated,service_role;
