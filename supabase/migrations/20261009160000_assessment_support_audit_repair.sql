-- Prepared repair; connected activation requires verified backup and database change approval.
-- No table, result model, RLS policy or canonical completion threshold is replaced.
begin;

-- The audit remains inside the canonical record. Refresh/evaluation operations cannot
-- erase or replace prior lifecycle history when they replace evidence_snapshot.
create or replace function public.exq_preserve_intervention_history()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
declare history jsonb;
begin
  history:=coalesce(old.evidence_snapshot->'lifecycle_history','[]'::jsonb);
  if jsonb_typeof(history)<>'array' then raise exception 'intervention_history_invalid'; end if;
  if new.status is distinct from old.status or new.completion_note is distinct from old.completion_note
    or new.due_at is distinct from old.due_at or new.evaluated_at is distinct from old.evaluated_at
    or new.remedial_assessment_id is distinct from old.remedial_assessment_id
    or new.remedial_assignment_id is distinct from old.remedial_assignment_id then
    history:=history||jsonb_build_array(jsonb_build_object(
      'at',now(),'actor_id',auth.uid(),'from_status',old.status,'to_status',new.status,
      'note',new.completion_note,'due_at',new.due_at,'evaluated_at',new.evaluated_at,
      'assessment_id',new.remedial_assessment_id,'assignment_id',new.remedial_assignment_id));
  end if;
  new.evidence_snapshot:=coalesce(new.evidence_snapshot,'{}'::jsonb)||jsonb_build_object('lifecycle_history',history);
  return new;
end;
$$;
revoke all on function public.exq_preserve_intervention_history() from public,anon,authenticated;
drop trigger if exists exq_intervention_history on public.assessment_interventions;
create trigger exq_intervention_history before update on public.assessment_interventions
for each row execute function public.exq_preserve_intervention_history();
create or replace function public.exq_update_intervention(
  p_intervention_id uuid,
  p_status text,
  p_completion_note text default null,
  p_due_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  caller uuid:=auth.uid();
  row_data public.assessment_interventions%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_status is null or p_status not in ('open','in_progress','completed','dismissed','escalated') then raise exception 'invalid_intervention_status'; end if;
  select * into row_data from public.assessment_interventions where id=p_intervention_id for update;
  if not found then raise exception 'intervention_not_found'; end if;
  if row_data.teacher_id is distinct from caller then raise exception 'intervention_not_owned'; end if;

  if not public.is_active_school_member(row_data.school_id)
    or (public.teacher_get_operating_context()->>'school_id') is distinct from row_data.school_id::text
    or not exists(select 1 from public.teacher_classes tc where tc.teacher_id=caller and tc.school_id=row_data.school_id and tc.class_id=row_data.class_id and tc.subject_id=row_data.subject_id)
  then raise exception 'intervention_context_not_authorized'; end if;
  if (p_status='dismissed' or row_data.status in ('completed','dismissed')) and length(btrim(coalesce(p_completion_note,'')))<5 then raise exception 'intervention_reason_required'; end if;
  if p_status='completed' then raise exception 'completed_requires_evidence_evaluation'; end if;

  update public.assessment_interventions
  set status=p_status,
      due_at=coalesce(p_due_at,due_at),
      completion_note=coalesce(nullif(btrim(p_completion_note),''),completion_note),
      completed_at=case when p_status in ('open','in_progress','escalated') then null else completed_at end,
      updated_at=now()
  where id=p_intervention_id;

  return jsonb_build_object('ok',true,'intervention_id',p_intervention_id,'status',p_status);
end;
$function$;

create or replace function public.exq_create_intervention_assessment(p_intervention_id uuid,p_title text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); iv public.assessment_interventions%rowtype; outcome_row public.curriculum_learning_outcomes%rowtype; existing_id uuid; result_id uuid; resolved_title text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into iv from public.assessment_interventions where id=p_intervention_id for update;
  if not found then raise exception 'intervention_not_found'; end if;
  if iv.teacher_id is distinct from caller then raise exception 'intervention_not_owned'; end if;

  if not public.is_active_school_member(iv.school_id)
    or (public.teacher_get_operating_context()->>'school_id') is distinct from iv.school_id::text
    or not exists(select 1 from public.teacher_classes tc where tc.teacher_id=caller and tc.school_id=iv.school_id and tc.class_id=iv.class_id and tc.subject_id=iv.subject_id)
  then raise exception 'intervention_context_not_authorized'; end if;
  if iv.status in ('completed','dismissed') then raise exception 'intervention_closed'; end if;
  select id into existing_id from public.assessment_definitions where intervention_id=iv.id and status in ('draft','review','approved','assigned','open') order by created_at desc limit 1;
  if existing_id is not null then return jsonb_build_object('ok',true,'assessment_id',existing_id,'created',false); end if;
  select * into outcome_row from public.curriculum_learning_outcomes where id=iv.outcome_id;
  if not found then raise exception 'outcome_not_found'; end if;
  resolved_title:=coalesce(nullif(btrim(coalesce(p_title,'')),''),case when iv.recommendation_type='extension_challenge' then 'Extension Practice: ' else 'Focused Practice: ' end||coalesce(outcome_row.outcome_code||' — ','')||outcome_row.outcome_text);
  insert into public.assessment_definitions(
    school_id,teacher_id,class_id,subject_id,assessment_type,title,description,instructions,status,
    generation_source,generation_status,generation_metadata,intervention_id
  ) values (
    iv.school_id,caller,iv.class_id,iv.subject_id,'practice',resolved_title,iv.recommendation,
    case when iv.recommendation_type='extension_challenge' then 'Apply this learning outcome in a new context. Explain and check your reasoning.' else 'Complete this focused practice. Review each answer before submitting.' end,'draft','intervention_intelligence','completed',
    jsonb_build_object('intervention_id',iv.id,'student_id',iv.student_id,'outcome_id',iv.outcome_id,
      'outcome_code',outcome_row.outcome_code,'outcome_text',outcome_row.outcome_text,
      'baseline_mastery_score',iv.mastery_score,'recommendation_type',iv.recommendation_type,
      'priority',iv.priority,'required_design',jsonb_build_object(
        'question_count',case when iv.priority in ('urgent','high') then 5 else 3 end,
        'difficulty_progression',case when iv.recommendation_type='extension_challenge' then jsonb_build_array('independent','application','challenge') else jsonb_build_array('supported','guided','independent') end,
        'teacher_review_required',true)),iv.id
  ) returning id into result_id;
  update public.assessment_interventions set remedial_assessment_id=result_id,
    baseline_mastery_score=coalesce(baseline_mastery_score,mastery_score),status='in_progress',updated_at=now()
  where id=iv.id;
  return jsonb_build_object('ok',true,'assessment_id',result_id,'created',true);
end;
$$;

create or replace function public.exq_evaluate_intervention(p_intervention_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  caller uuid:=auth.uid();
  iv public.assessment_interventions%rowtype;
  followup numeric;
  delta numeric;
  next_status text;
  next_note text;
  released_attempt uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into iv from public.assessment_interventions where id=p_intervention_id for update;
  if not found then raise exception 'intervention_not_found'; end if;
  if iv.teacher_id is distinct from caller then raise exception 'intervention_not_owned'; end if;

  if not public.is_active_school_member(iv.school_id)
    or (public.teacher_get_operating_context()->>'school_id') is distinct from iv.school_id::text
    or not exists(select 1 from public.teacher_classes tc where tc.teacher_id=caller and tc.school_id=iv.school_id and tc.class_id=iv.class_id and tc.subject_id=iv.subject_id)
  then raise exception 'intervention_context_not_authorized'; end if;
  if iv.status in ('completed','dismissed') then raise exception 'intervention_closed'; end if;
  if iv.remedial_assignment_id is null then raise exception 'intervention_not_assigned'; end if;

  select at.id into released_attempt
  from public.assessment_attempts at
  where at.assignment_id=iv.remedial_assignment_id
    and at.student_id=iv.student_id
    and at.status='released'
    and at.result_status='released'
  order by coalesce(at.teacher_reviewed_at,at.updated_at,at.submitted_at,at.created_at) desc
  limit 1;
  if released_attempt is null then raise exception 'followup_result_not_released'; end if;

  perform public.exq_sync_attempt_outcome_evidence(released_attempt);
  select mastery_score into followup
  from public.student_outcome_mastery
  where student_id=iv.student_id and outcome_id=iv.outcome_id;
  if followup is null then raise exception 'followup_mastery_not_available'; end if;

  delta:=round(followup-coalesce(iv.baseline_mastery_score,iv.mastery_score),2);
  next_status:=case
    when followup>=60 and delta>=10 then 'completed'
    when followup>=80 then 'completed'
    when delta<5 or followup<40 then 'escalated'
    else 'in_progress'
  end;
  next_note:=case
    when next_status='completed' then 'Follow-up evidence shows sufficient mastery improvement.'
    when next_status='escalated' then 'Follow-up evidence shows limited improvement; escalate to reteaching or additional support.'
    else 'Improvement is visible but more guided practice is required.'
  end;

  update public.assessment_interventions
  set followup_mastery_score=followup,
      mastery_change=delta,
      evaluated_at=now(),
      status=next_status,
      completion_note=case when next_status='completed' then next_note else completion_note end,
      completed_at=case when next_status='completed' then now() else null end,
      recommendation=case when next_status='escalated' then next_note else recommendation end,
      updated_at=now()
  where id=iv.id;

  return jsonb_build_object(
    'ok',true,'intervention_id',iv.id,'attempt_id',released_attempt,
    'baseline_mastery_score',coalesce(iv.baseline_mastery_score,iv.mastery_score),
    'followup_mastery_score',followup,'mastery_change',delta,
    'status',next_status,'recommendation',next_note
  );
end;
$function$;


revoke all on function public.exq_update_intervention(uuid,text,text,timestamptz) from public,anon;
revoke all on function public.exq_create_intervention_assessment(uuid,text) from public,anon;
revoke all on function public.exq_evaluate_intervention(uuid) from public,anon;
grant execute on function public.exq_update_intervention(uuid,text,text,timestamptz) to authenticated,service_role;
grant execute on function public.exq_create_intervention_assessment(uuid,text) to authenticated,service_role;
grant execute on function public.exq_evaluate_intervention(uuid) to authenticated,service_role;
-- Preserve marking RPCs while strengthening current context and moderation guards.
create or replace function public.exq_mark_response(
  p_response_id uuid,p_teacher_score numeric,p_teacher_feedback text default null,p_override_reason text default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); ar public.assessment_responses%rowtype; at public.assessment_attempts%rowtype; aa public.assessment_assignments%rowtype; normalized_override text:=nullif(btrim(coalesce(p_override_reason,'')),'');
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ar from public.assessment_responses where id=p_response_id for update;
  if not found then raise exception 'response_not_found'; end if;
  select * into at from public.assessment_attempts where id=ar.attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  select * into aa from public.assessment_assignments where id=at.assignment_id;
  if aa.teacher_id is distinct from caller then raise exception 'response_not_owned'; end if;

  if not public.is_active_school_member(aa.school_id)
    or (public.teacher_get_operating_context()->>'school_id') is distinct from aa.school_id::text
    or not exists(select 1 from public.teacher_classes tc join public.assessment_definitions ad on ad.id=aa.assessment_id
      where tc.teacher_id=caller and tc.school_id=aa.school_id and tc.class_id=aa.class_id and tc.subject_id=ad.subject_id)
  then raise exception 'assessment_context_not_authorized'; end if;
  if at.status='released' or at.result_status='released' then raise exception 'released_attempt_locked'; end if;
  if at.status not in ('teacher_review','marked','auto_marked') then raise exception 'attempt_not_markable'; end if;
  if ar.status='void' then raise exception 'void_response_not_markable'; end if;
  if exists(select 1 from public.assessment_moderation_requests where response_id=ar.id and status='pending') then raise exception 'response_review_pending'; end if;
  if p_teacher_score is null or p_teacher_score<0 or p_teacher_score>ar.max_score then raise exception 'invalid_score'; end if;
  if ar.auto_score is not null and p_teacher_score is distinct from ar.auto_score and normalized_override is null then raise exception 'override_reason_required'; end if;
  update public.assessment_responses
  set teacher_score=p_teacher_score,final_score=p_teacher_score,
      teacher_feedback=nullif(btrim(coalesce(p_teacher_feedback,'')),''),
      teacher_override_reason=normalized_override,status='marked',marked_by=caller,marked_at=now(),updated_at=now()
  where id=p_response_id;
  update public.assessment_attempts set status='teacher_review',result_status='partially_marked',updated_at=now()
  where id=at.id and status<>'teacher_review';
  return jsonb_build_object('ok',true,'response_id',p_response_id,'score',p_teacher_score,
    'overrode_auto_score',ar.auto_score is not null and p_teacher_score is distinct from ar.auto_score);
end;
$$;

create or replace function public.exq_finalize_attempt(
  p_attempt_id uuid,p_feedback text default null,p_release boolean default false
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); at public.assessment_attempts%rowtype; aa public.assessment_assignments%rowtype; unresolved integer; response_count integer; total_score numeric; total_max numeric; pct numeric; next_status text; next_result text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into at from public.assessment_attempts where id=p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  select * into aa from public.assessment_assignments where id=at.assignment_id;
  if aa.teacher_id is distinct from caller then raise exception 'attempt_not_owned'; end if;

  if not public.is_active_school_member(aa.school_id)
    or (public.teacher_get_operating_context()->>'school_id') is distinct from aa.school_id::text
    or not exists(select 1 from public.teacher_classes tc join public.assessment_definitions ad on ad.id=aa.assessment_id
      where tc.teacher_id=caller and tc.school_id=aa.school_id and tc.class_id=aa.class_id and tc.subject_id=ad.subject_id)
  then raise exception 'assessment_context_not_authorized'; end if;
  if at.status='released' or at.result_status='released' then raise exception 'released_attempt_locked'; end if;
  if at.status not in ('teacher_review','marked','auto_marked') then raise exception 'attempt_not_finalizable'; end if;
  if p_release and exists(select 1 from public.assessment_moderation_requests where attempt_id=at.id and status='pending') then raise exception 'mark_review_pending_release_blocked'; end if;
  select count(*),count(*) filter (where final_score is null) into response_count,unresolved
  from public.assessment_responses where attempt_id=at.id and status<>'void';
  if response_count=0 then raise exception 'attempt_has_no_responses'; end if;
  if unresolved>0 then raise exception 'responses_unmarked'; end if;
  select coalesce(sum(final_score),0),coalesce(sum(max_score),0) into total_score,total_max
  from public.assessment_responses where attempt_id=at.id and status<>'void';
  pct:=case when total_max>0 then round((total_score/total_max)*100,3) else 0 end;
  next_status:=case when p_release then 'released' else 'marked' end;
  next_result:=case when p_release then 'released' else 'marked' end;
  update public.assessment_attempts
  set status=next_status,result_status=next_result,score=total_score,max_score=total_max,percentage=pct,
      feedback=nullif(btrim(coalesce(p_feedback,'')),''),reviewed_by=caller,teacher_reviewed_at=now(),
      released_at=case when p_release then now() else released_at end,
      active_client_id=null,client_lease_expires_at=null,client_lease_updated_at=now(),
      locked_at=coalesce(locked_at,now()),lock_reason=coalesce(lock_reason,'submitted'),updated_at=now()
  where id=at.id;
  return jsonb_build_object('ok',true,'attempt_id',at.id,'status',next_status,'result_status',next_result,
    'score',total_score,'max_score',total_max,'percentage',pct,'released',p_release);
end;
$$;


revoke all on function public.exq_mark_response(uuid,numeric,text,text) from public,anon;
revoke all on function public.exq_finalize_attempt(uuid,text,boolean) from public,anon;
grant execute on function public.exq_mark_response(uuid,numeric,text,text) to authenticated,service_role;
grant execute on function public.exq_finalize_attempt(uuid,text,boolean) to authenticated,service_role;
-- Explicit evidence refresh is class scoped, preserves dates and respects closed history.
create or replace function public.exq_refresh_intervention_queue(p_class_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); rows_written integer:=0;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_class_id is null or not exists(select 1 from public.teacher_classes tc where tc.teacher_id=caller and tc.class_id=p_class_id and tc.school_id=(public.teacher_get_operating_context()->>'school_id')::uuid and public.is_active_school_member(tc.school_id)) then raise exception 'class_context_not_authorized'; end if;
  insert into public.assessment_interventions(
    school_id,class_id,subject_id,teacher_id,student_id,outcome_id,
    priority,recommendation_type,recommendation,mastery_score,evidence_count,
    confidence_score,repeated_weakness_count,evidence_snapshot,status,due_at,updated_at
  )
  select tc.school_id,tc.class_id,tc.subject_id,caller,som.student_id,som.outcome_id,
    case when som.mastery_score<30 and stats.recent_below_50>=2 then 'urgent'
      when som.mastery_score<40 then 'high' when som.mastery_score<80 then 'medium' else 'extension' end,
    case when som.mastery_score<30 and stats.recent_below_50>=2 then 'reteach'
      when som.mastery_score<40 then 'remedial_practice' when som.mastery_score<60 then 'guided_practice'
      when som.mastery_score<80 then 'targeted_revision' else 'extension_challenge' end,
    case when som.mastery_score<30 and stats.recent_below_50>=2 then 'Reteach this outcome using a different representation, then assign short remedial practice.'
      when som.mastery_score<40 then 'Assign focused remedial practice and check understanding in a small group.'
      when som.mastery_score<60 then 'Provide guided practice with worked examples and immediate feedback.'
      when som.mastery_score<80 then 'Schedule targeted revision and one follow-up check.'
      else 'Provide an extension challenge that applies the outcome in a new context.' end,
    coalesce(som.mastery_score,0),som.evidence_count,
    least(100,round((least(som.evidence_count,5)::numeric/5)*70 + case when som.last_evidence_at>=now()-interval '30 days' then 30 when som.last_evidence_at>=now()-interval '90 days' then 20 else 10 end,2)),
    stats.recent_below_50,
    jsonb_build_object('mastery_level',som.mastery_level,'last_evidence_at',som.last_evidence_at,
      'recent_evidence_count',stats.recent_count,'recent_below_50',stats.recent_below_50,
      'latest_percentage',stats.latest_percentage,'evidence_sources',stats.evidence_sources),
    'open',case when som.mastery_score<40 then now()+interval '7 days' when som.mastery_score<80 then now()+interval '14 days' else now()+interval '21 days' end,now()
  from public.student_outcome_mastery som
  join public.students s on s.id=som.student_id
  join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
  join public.teacher_classes tc on tc.class_id=sc.class_id and tc.teacher_id=caller
  join lateral (
    select count(*) filter(where ranked.rn<=5) recent_count,
      count(*) filter(where ranked.rn<=3 and ranked.percentage<50) recent_below_50,
      max(ranked.percentage) filter(where ranked.rn=1) latest_percentage,
      coalesce(jsonb_agg(distinct ranked.evidence_source) filter(where ranked.rn<=5),'[]'::jsonb) evidence_sources
    from (
      select cel.evidence_source,
        case when cel.max_score>0 then round((cel.score/cel.max_score)*100,2) else null end percentage,
        row_number() over(order by cel.observed_at desc,cel.created_at desc) rn
      from public.competency_evidence_ledger cel
      where cel.student_id=som.student_id and cel.outcome_id=som.outcome_id and cel.subject_id=tc.subject_id
    ) ranked
  ) stats on true
  where (p_class_id is null or tc.class_id=p_class_id)
    and tc.school_id=(public.teacher_get_operating_context()->>'school_id')::uuid
    and public.is_active_school_member(tc.school_id)
    and not exists(select 1 from public.assessment_interventions closed where closed.teacher_id=caller and closed.school_id=tc.school_id and closed.class_id=tc.class_id and closed.student_id=som.student_id and closed.outcome_id=som.outcome_id and closed.status in ('completed','dismissed') and closed.updated_at>=coalesce(som.last_evidence_at,'-infinity'::timestamptz))
    and som.evidence_count>0
    and stats.recent_count>0
  on conflict (teacher_id,class_id,student_id,outcome_id) where status in ('open','in_progress','escalated')
  do update set school_id=excluded.school_id,subject_id=excluded.subject_id,priority=excluded.priority,
    recommendation_type=excluded.recommendation_type,recommendation=excluded.recommendation,
    mastery_score=excluded.mastery_score,evidence_count=excluded.evidence_count,
    confidence_score=excluded.confidence_score,repeated_weakness_count=excluded.repeated_weakness_count,
    evidence_snapshot=excluded.evidence_snapshot,due_at=coalesce(assessment_interventions.due_at,excluded.due_at),updated_at=now();
  get diagnostics rows_written=row_count;
  return jsonb_build_object('ok',true,'rows_refreshed',rows_written);
end;
$$;


revoke all on function public.exq_refresh_intervention_queue(uuid) from public,anon;
grant execute on function public.exq_refresh_intervention_queue(uuid) to authenticated,service_role;
commit;
