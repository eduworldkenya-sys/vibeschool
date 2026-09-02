-- Learner intervention evidence integrity repair.
-- 1. Evaluate released remedial attempts using columns that actually exist.
-- 2. Require both attempt and result release state before downstream propagation.
-- 3. Prevent note-only manual completion; completion is owned by evidence evaluation.

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
  if p_status not in ('open','in_progress','completed','dismissed','escalated') then raise exception 'invalid_intervention_status'; end if;
  select * into row_data from public.assessment_interventions where id=p_intervention_id for update;
  if not found then raise exception 'intervention_not_found'; end if;
  if row_data.teacher_id is distinct from caller then raise exception 'intervention_not_owned'; end if;
  if p_status='completed' then raise exception 'completed_requires_evidence_evaluation'; end if;

  update public.assessment_interventions
  set status=p_status,
      due_at=coalesce(p_due_at,due_at),
      completed_at=case when p_status in ('open','in_progress','escalated') then null else completed_at end,
      updated_at=now()
  where id=p_intervention_id;

  return jsonb_build_object('ok',true,'intervention_id',p_intervention_id,'status',p_status);
end;
$function$;

create or replace function public.exq_propagate_released_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_attempt public.assessment_attempts%rowtype;
  v_teacher uuid;
  v_subject uuid;
  v_title text;
  v_type text;
  v_now timestamptz := now();
begin
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.status <> 'released' or v_attempt.result_status <> 'released' then raise exception 'Attempt is not released'; end if;

  select aa.teacher_id, ad.subject_id, ad.title, ad.assessment_type
    into v_teacher, v_subject, v_title, v_type
  from public.assessment_assignments aa
  join public.assessment_definitions ad on ad.id = aa.assessment_id
  where aa.id = v_attempt.assignment_id;

  if v_teacher <> auth.uid() and not exists (
    select 1 from public.school_members sm where sm.profile_id = auth.uid() and sm.school_id = v_attempt.school_id and sm.role::text in ('admin','owner','headteacher')
  ) then raise exception 'Not authorized'; end if;

  insert into public.assessment_gradebook_entries(
    attempt_id, assignment_id, assessment_id, student_id, school_id, class_id,
    subject_id, teacher_id, score, max_score, percentage, assessment_type,
    assessment_title, released_at, updated_at
  ) values (
    v_attempt.id, v_attempt.assignment_id, v_attempt.assessment_id, v_attempt.student_id,
    v_attempt.school_id, v_attempt.class_id, v_subject, v_teacher, v_attempt.score,
    v_attempt.max_score, v_attempt.percentage, v_type, v_title,
    coalesce(v_attempt.teacher_reviewed_at, v_now), v_now
  )
  on conflict (attempt_id) do update set
    score = excluded.score,
    max_score = excluded.max_score,
    percentage = excluded.percentage,
    subject_id = excluded.subject_id,
    teacher_id = excluded.teacher_id,
    assessment_type = excluded.assessment_type,
    assessment_title = excluded.assessment_title,
    released_at = excluded.released_at,
    updated_at = now();

  perform public.exq_sync_attempt_outcome_evidence(v_attempt.id);

  if not exists (select 1 from public.student_learning_timeline where source_type='assessment_attempt' and source_id=v_attempt.id and event_type='assessment_released') then
    insert into public.student_learning_timeline(student_id,event_type,source_type,source_id,subject_id,title,summary,occurred_at,metadata)
    values (v_attempt.student_id,'assessment_released','assessment_attempt',v_attempt.id,v_subject,v_title,
      case when v_attempt.percentage is null then 'Assessment result released' else format('Assessment result released: %s%%', round(v_attempt.percentage,1)) end,
      coalesce(v_attempt.teacher_reviewed_at,v_now),jsonb_build_object('score',v_attempt.score,'max_score',v_attempt.max_score,'percentage',v_attempt.percentage,'assessment_type',v_type));
  end if;

  if v_subject is not null then
    insert into public.student_subject_progress(student_id,subject_id,completed_tasks,total_tasks,average_score,mastery_percentage,updated_at)
    select v_attempt.student_id,v_subject,count(*)::int,count(*)::int,avg(coalesce(g.percentage,0)),
      coalesce((select avg(som.mastery_score) from public.student_outcome_mastery som
        join public.assessment_item_outcomes aio on aio.outcome_id=som.outcome_id
        join public.assessment_items ai on ai.id=aio.assessment_item_id
        where som.student_id=v_attempt.student_id and ai.assessment_id=v_attempt.assessment_id),0),now()
    from public.assessment_gradebook_entries g where g.student_id=v_attempt.student_id and g.subject_id=v_subject
    on conflict (student_id,subject_id) do update set completed_tasks=excluded.completed_tasks,total_tasks=excluded.total_tasks,
      average_score=excluded.average_score,mastery_percentage=excluded.mastery_percentage,updated_at=now();
  end if;

  update public.report_card_subjects rcs
  set assessment_average = stats.avg_percentage,
      mastery_average = stats.avg_mastery,
      growth_percentage = stats.growth,
      evidence_snapshot = jsonb_build_object('gradebook_entries',stats.entry_count,'latest_assessment',v_title,'latest_percentage',v_attempt.percentage,'refreshed_at',now()),
      updated_at = now()
  from (
    select rc.id report_card_id,avg(g.percentage) avg_percentage,
      (select avg(som.mastery_score) from public.student_outcome_mastery som where som.student_id=rc.student_id) avg_mastery,
      max(g.percentage)-min(g.percentage) growth,count(g.*)::int entry_count
    from public.report_cards rc join public.assessment_gradebook_entries g on g.student_id=rc.student_id and g.class_id=rc.class_id
    where rc.student_id=v_attempt.student_id and rc.class_id=v_attempt.class_id group by rc.id,rc.student_id
  ) stats where rcs.report_card_id=stats.report_card_id and (rcs.subject_id=v_subject or v_subject is null);

  return jsonb_build_object('attempt_id',v_attempt.id,'gradebook_synced',true,'competency_synced',true,'timeline_synced',true,'subject_progress_synced',true,'report_card_synced',true);
end;
$function$;
