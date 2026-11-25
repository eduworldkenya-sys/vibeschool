begin;

-- Restore dated lesson evidence and scope report mastery to the report's school, class and term.
CREATE OR REPLACE FUNCTION public.exq_generate_report_card_evidence(p_report_card_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  caller uuid:=auth.uid();
  rc public.report_cards%rowtype;
  term_row public.academic_terms%rowtype;
  next_version integer;
  subject_row record;
  subject_count integer:=0;
  missing_subjects integer:=0;
  issue_list jsonb:='[]'::jsonb;
  report_snapshot jsonb;
  snapshot_id uuid;
  attendance_payload jsonb;
  lesson_payload jsonb;
  homework_payload jsonb;
  subject_payload jsonb;
  overall_assessment numeric;
  overall_mastery numeric;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select * into rc from public.report_cards where id=p_report_card_id for update;
  if not found then raise exception 'report_card_not_found'; end if;
  if rc.teacher_id is distinct from caller then raise exception 'report_card_not_owned'; end if;
  if rc.status not in ('draft','returned') then raise exception 'report_card_not_refreshable'; end if;

  select * into term_row from public.academic_terms where id=rc.term_id;
  if not found then raise exception 'term_not_found'; end if;
  if term_row.school_id is distinct from rc.school_id then raise exception 'term_school_mismatch'; end if;

  for subject_row in
    select distinct tc.subject_id,coalesce(s.name,'Subject') subject_name
    from public.teacher_classes tc
    left join public.subjects s on s.id=tc.subject_id
    where tc.teacher_id=caller
      and tc.school_id=rc.school_id
      and tc.class_id=rc.class_id
      and tc.subject_id is not null
  loop
    subject_count:=subject_count+1;

    insert into public.report_card_subjects(
      report_card_id,subject_id,teacher_id,
      assessment_average,mastery_average,growth_percentage,
      strongest_outcomes,support_outcomes,intervention_summary,evidence_snapshot,updated_at
    )
    select
      rc.id,
      subject_row.subject_id,
      caller,
      assessment_stats.assessment_average,
      mastery_stats.mastery_average,
      mastery_stats.growth_percentage,
      coalesce(mastery_stats.strongest_outcomes,'[]'::jsonb),
      coalesce(mastery_stats.support_outcomes,'[]'::jsonb),
      coalesce(intervention_stats.intervention_summary,'[]'::jsonb),
      jsonb_build_object(
        'subject_id',subject_row.subject_id,
        'subject_name',subject_row.subject_name,
        'term_start',term_row.start_date,
        'term_end',term_row.end_date,
        'released_assessments',coalesce(assessment_stats.released_assessments,'[]'::jsonb),
        'assessment_count',coalesce(assessment_stats.assessment_count,0),
        'mastery',coalesce(mastery_stats.mastery_items,'[]'::jsonb),
        'mastery_evidence_count',coalesce(mastery_stats.mastery_evidence_count,0),
        'interventions',coalesce(intervention_stats.intervention_summary,'[]'::jsonb),
        'homework',coalesce(homework_stats.homework_items,'[]'::jsonb),
        'homework_assigned',coalesce(homework_stats.homework_assigned,0),
        'homework_submitted',coalesce(homework_stats.homework_submitted,0),
        'lessons',coalesce(lesson_stats.lesson_items,'[]'::jsonb),
        'lessons_completed',coalesce(lesson_stats.lessons_completed,0)
      ),
      now()
    from lateral (
      select
        round(avg(at.percentage),2) assessment_average,
        count(*) assessment_count,
        coalesce(jsonb_agg(jsonb_build_object(
          'attempt_id',at.id,
          'assessment_id',ad.id,
          'title',ad.title,
          'assessment_type',ad.assessment_type,
          'lesson_plan_id',ad.lesson_plan_id,
          'teaching_occurrence_id',ad.teaching_occurrence_id,
          'outcome_ids', coalesce(attempt_outcomes.ids, '[]'::jsonb),
          'percentage',at.percentage,
          'released_at',gradebook.released_at
        ) order by gradebook.released_at,at.id),'[]'::jsonb) released_assessments
      from public.assessment_attempts at
      join public.assessment_assignments aa on aa.id=at.assignment_id
      join public.assessment_definitions ad on ad.id=at.assessment_id
      join public.assessment_gradebook_entries gradebook on gradebook.attempt_id=at.id
        and gradebook.student_id=at.student_id and gradebook.school_id=at.school_id
        and gradebook.class_id=at.class_id and gradebook.subject_id=ad.subject_id
      left join lateral (
        select jsonb_agg(distinct cel.outcome_id order by cel.outcome_id) ids
        from public.assessment_responses ar
        join public.competency_evidence_ledger cel
          on cel.evidence_source='assessment_response' and cel.evidence_id=ar.id
         and cel.student_id=at.student_id and cel.school_id=at.school_id
         and cel.class_id=at.class_id and cel.subject_id=ad.subject_id
        where ar.attempt_id=at.id
      ) attempt_outcomes on true
      where at.student_id=rc.student_id
        and at.class_id=rc.class_id
        and at.school_id=rc.school_id
        and ad.subject_id=subject_row.subject_id
        and at.status='released'
        and at.result_status='released'
        and gradebook.released_at::date between term_row.start_date and term_row.end_date
    ) assessment_stats
    cross join lateral (
      select
        round(avg(som.mastery_score),2) mastery_average,
        round(avg(case when som.first_score is not null and som.last_score is not null then som.last_score-som.first_score end),2) growth_percentage,
        count(*) mastery_evidence_count,
        coalesce(jsonb_agg(jsonb_build_object(
          'outcome_id',clo.id,
          'outcome_code',clo.outcome_code,
          'outcome_text',clo.outcome_text,
          'mastery_level',proficiency.mastery_level,
          'mastery_score',som.mastery_score,
          'evidence_count',som.evidence_count,
          'last_evidence_at',som.last_evidence_at
        ) order by som.mastery_score desc nulls last),'[]'::jsonb) mastery_items,
        coalesce(jsonb_agg(jsonb_build_object(
          'outcome_id',clo.id,'outcome_code',clo.outcome_code,'outcome_text',clo.outcome_text,
          'mastery_score',som.mastery_score
        ) order by som.mastery_score desc) filter(where som.mastery_score>=80),'[]'::jsonb) strongest_outcomes,
        coalesce(jsonb_agg(jsonb_build_object(
          'outcome_id',clo.id,'outcome_code',clo.outcome_code,'outcome_text',clo.outcome_text,
          'mastery_score',som.mastery_score
        ) order by som.mastery_score asc) filter(where som.mastery_score<60),'[]'::jsonb) support_outcomes
      from (
        select cel.outcome_id,
          round(100 * sum(cel.score * cel.weight) / nullif(sum(cel.max_score * cel.weight),0),2) mastery_score,
          count(*) evidence_count,
          max(cel.observed_at) last_evidence_at,
          (array_agg(round(100 * cel.score / cel.max_score,2) order by cel.observed_at,cel.id))[1] first_score,
          (array_agg(round(100 * cel.score / cel.max_score,2) order by cel.observed_at desc,cel.id desc))[1] last_score
        from public.competency_evidence_ledger cel
        where cel.student_id=rc.student_id
          and cel.school_id=rc.school_id and cel.class_id=rc.class_id
          and cel.subject_id=subject_row.subject_id
          and cel.observed_at::date between term_row.start_date and term_row.end_date
          and cel.score is not null and cel.max_score>0 and cel.weight>0
          and (cel.evidence_source <> 'assessment_response' or exists (
            select 1
            from public.assessment_responses response
            join public.assessment_attempts attempt on attempt.id=response.attempt_id
            join public.assessment_gradebook_entries released on released.attempt_id=attempt.id
              and released.student_id=attempt.student_id and released.school_id=attempt.school_id
              and released.class_id=attempt.class_id and released.subject_id=subject_row.subject_id
            where response.id=cel.evidence_id
              and attempt.student_id=rc.student_id and attempt.school_id=rc.school_id
              and attempt.class_id=rc.class_id
              and attempt.status='released' and attempt.result_status='released'
              and released.released_at::date between term_row.start_date and term_row.end_date
          ))
        group by cel.outcome_id
      ) som
      join public.curriculum_learning_outcomes clo on clo.id=som.outcome_id
      cross join lateral (
        select case
          when som.mastery_score>=85 then 'exceeding'
          when som.mastery_score>=70 then 'meeting'
          when som.mastery_score>=55 then 'developing'
          when som.mastery_score>=40 then 'emerging'
          else 'needs_intervention'
        end mastery_level
      ) proficiency
    ) mastery_stats
    cross join lateral (
      select coalesce(jsonb_agg(jsonb_build_object(
        'intervention_id',ai.id,
        'priority',ai.priority,
        'recommendation_type',ai.recommendation_type,
        'status',ai.status,
        'baseline_mastery_score',ai.baseline_mastery_score,
        'followup_mastery_score',ai.followup_mastery_score,
        'mastery_change',ai.mastery_change,
        'completed_at',ai.completed_at
      ) order by ai.created_at),'[]'::jsonb) intervention_summary
      from public.assessment_interventions ai
      where ai.student_id=rc.student_id
        and ai.school_id=rc.school_id
        and ai.class_id=rc.class_id
        and ai.subject_id=subject_row.subject_id
        and ai.created_at::date between term_row.start_date and term_row.end_date
    ) intervention_stats
    cross join lateral (
      select
        count(distinct h.id) homework_assigned,
        count(distinct hs.id) filter(where hs.id is not null) homework_submitted,
        coalesce(jsonb_agg(distinct jsonb_build_object(
          'homework_id',h.id,
          'title',h.title,
          'due_date',h.due_date,
          'submission_status',hs.status,
          'mark',hs.mark,
          'submitted_at',hs.submitted_at
        )) filter(where h.id is not null),'[]'::jsonb) homework_items
      from public.homework h
      left join public.homework_submissions hs on hs.homework_id=h.id and hs.student_id=rc.student_id
      where h.class_id=rc.class_id
        and h.school_id=rc.school_id
        and lower(coalesce(h.subject,''))=lower(subject_row.subject_name)
        and coalesce(h.due_date,h.created_at::date) between term_row.start_date and term_row.end_date
    ) homework_stats
    cross join lateral (
      select
        count(*) filter(where coalesce(tocc.lifecycle,lp.status) in ('completed','taught','done')) lessons_completed,
        coalesce(jsonb_agg(jsonb_build_object(
          'lesson_plan_id',lp.id,
          'title',lp.title,
          'topic',lp.topic,
          'taught_date',lp.taught_date,
          'status',coalesce(tocc.lifecycle,lp.status),
          'reflection',lp.reflection,
          'participation_score',lp.participation_score
        ) order by lp.taught_date,lp.id),'[]'::jsonb) lesson_items
      from public.lesson_plans lp
      left join lateral (
        select occ.lifecycle
        from public.teaching_occurrences occ
        where occ.school_id=lp.school_id and occ.class_id=lp.class_id
          and occ.subject_id=lp.subject_id and occ.occurrence_date=lp.taught_date
          and (occ.unscheduled_plan_id=lp.id or
               (occ.timetable_slot_id=lp.timetable_slot_id and occ.unscheduled_plan_id is null))
        order by (occ.unscheduled_plan_id is not null) desc,occ.id
        limit 1
      ) tocc on true
      where lp.school_id=rc.school_id and lp.class_id=rc.class_id
        and lp.subject_id=subject_row.subject_id
        and lp.taught_date between term_row.start_date and term_row.end_date
    ) lesson_stats
    on conflict (report_card_id,subject_id)
    do update set
      teacher_id=excluded.teacher_id,
      assessment_average=excluded.assessment_average,
      mastery_average=excluded.mastery_average,
      growth_percentage=excluded.growth_percentage,
      strongest_outcomes=excluded.strongest_outcomes,
      support_outcomes=excluded.support_outcomes,
      intervention_summary=excluded.intervention_summary,
      evidence_snapshot=excluded.evidence_snapshot,
      updated_at=now();
  end loop;

  if subject_count=0 then
    issue_list:=issue_list||jsonb_build_array(jsonb_build_object('code','no_teacher_subjects','message','No active teacher subject assignments were found for this class.'));
  end if;

  select count(*) into missing_subjects
  from public.report_card_subjects rcs
  where rcs.report_card_id=rc.id
    and (
      coalesce((rcs.evidence_snapshot->>'assessment_count')::integer,0)=0
      and coalesce((rcs.evidence_snapshot->>'mastery_evidence_count')::integer,0)=0
      and coalesce((rcs.evidence_snapshot->>'homework_assigned')::integer,0)=0
      and coalesce((rcs.evidence_snapshot->>'lessons_completed')::integer,0)=0
    );

  if missing_subjects>0 then
    issue_list:=issue_list||jsonb_build_array(jsonb_build_object(
      'code','subjects_without_evidence','message',missing_subjects||' subject(s) have no term evidence.','count',missing_subjects
    ));
  end if;

  select jsonb_build_object(
    'present',count(*) filter(where a.status='present'),
    'absent',count(*) filter(where a.status='absent'),
    'late',count(*) filter(where a.is_late=true),
    'total_marked',count(*),
    'attendance_rate',case when count(*)>0 then round((count(*) filter(where a.status='present'))::numeric/count(*)*100,2) else null end
  ) into attendance_payload
  from public.attendance a
  where a.student_id=rc.student_id and a.school_id=rc.school_id and a.class_id=rc.class_id and a.date between term_row.start_date and term_row.end_date;

  select jsonb_build_object(
    'completed_lessons',count(*) filter(where lifecycle='completed'),
    'planned_lessons',count(*) filter(where lifecycle='planned'),
    'cancelled_lessons',count(*) filter(where lifecycle='cancelled')
  ) into lesson_payload
  from public.teaching_occurrences
  where school_id=rc.school_id and class_id=rc.class_id and occurrence_date between term_row.start_date and term_row.end_date;

  select jsonb_build_object(
    'assigned',count(distinct h.id),
    'submitted',count(distinct hs.id),
    'marked',count(distinct hs.id) filter(where hs.mark is not null)
  ) into homework_payload
  from public.homework h
  left join public.homework_submissions hs on hs.homework_id=h.id and hs.student_id=rc.student_id
  where h.class_id=rc.class_id and h.school_id=rc.school_id
    and coalesce(h.due_date,h.created_at::date) between term_row.start_date and term_row.end_date;

  select coalesce(jsonb_agg(jsonb_build_object(
    'report_card_subject_id',rcs.id,
    'subject_id',rcs.subject_id,
    'subject_name',coalesce(s.name,'Subject'),
    'assessment_average',rcs.assessment_average,
    'mastery_average',rcs.mastery_average,
    'growth_percentage',rcs.growth_percentage,
    'strongest_outcomes',rcs.strongest_outcomes,
    'support_outcomes',rcs.support_outcomes,
    'intervention_summary',rcs.intervention_summary,
    'teacher_comment',rcs.teacher_comment,
    'evidence_snapshot',rcs.evidence_snapshot
  ) order by coalesce(s.name,''),rcs.subject_id),'[]'::jsonb),
  round(avg(rcs.assessment_average),2),round(avg(rcs.mastery_average),2)
  into subject_payload,overall_assessment,overall_mastery
  from public.report_card_subjects rcs
  left join public.subjects s on s.id=rcs.subject_id
  where rcs.report_card_id=rc.id;

  report_snapshot:=jsonb_build_object(
    'schema_version',1,
    'report_card_id',rc.id,
    'student_id',rc.student_id,
    'class_id',rc.class_id,
    'term',jsonb_build_object('id',term_row.id,'name',term_row.name,'academic_year',term_row.academic_year,'start_date',term_row.start_date,'end_date',term_row.end_date),
    'generated_by',caller,
    'generated_at',now(),
    'summary',jsonb_build_object('overall_assessment_average',overall_assessment,'overall_mastery_average',overall_mastery,'subject_count',subject_count),
    'attendance',coalesce(attendance_payload,'{}'::jsonb),
    'lesson_delivery',coalesce(lesson_payload,'{}'::jsonb),
    'homework',coalesce(homework_payload,'{}'::jsonb),
    'subjects',coalesce(subject_payload,'[]'::jsonb)
  );

  select coalesce(max(version),0)+1 into next_version
  from public.report_card_evidence_snapshots
  where report_card_id=rc.id;

  insert into public.report_card_evidence_snapshots(
    report_card_id,version,generated_by,term_start,term_end,snapshot,
    completeness_status,completeness_issues
  ) values (
    rc.id,next_version,caller,term_row.start_date,term_row.end_date,report_snapshot,
    case when jsonb_array_length(issue_list)=0 then 'complete' else 'incomplete' end,
    issue_list
  ) returning id into snapshot_id;

  update public.report_cards
  set generated_snapshot=report_snapshot,
      evidence_generated_at=now(),
      evidence_version=next_version,
      completeness_status=case when jsonb_array_length(issue_list)=0 then 'complete' else 'incomplete' end,
      completeness_issues=issue_list,
      updated_at=now()
  where id=rc.id;

  return jsonb_build_object(
    'ok',true,
    'report_card_id',rc.id,
    'snapshot_id',snapshot_id,
    'evidence_version',next_version,
    'completeness_status',case when jsonb_array_length(issue_list)=0 then 'complete' else 'incomplete' end,
    'issues',issue_list,
    'subject_count',subject_count
  );
end;
$function$
;

-- Use the saved lesson's Scheme outcome authority at the item-link write boundary.
CREATE OR REPLACE FUNCTION public.exq_link_item_outcome(p_assessment_item_id uuid, p_outcome_id uuid, p_weight numeric DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  caller uuid:=auth.uid();
  assessment public.assessment_definitions%rowtype;
  lineage jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_weight is null or p_weight<=0 then raise exception 'invalid_weight'; end if;
  select ad.* into assessment
  from public.assessment_items ai
  join public.assessment_definitions ad on ad.id=ai.assessment_id
  where ai.id=p_assessment_item_id
  for update of ad;
  if not found then raise exception 'assessment_item_not_found'; end if;
  if assessment.teacher_id is distinct from caller then raise exception 'assessment_item_not_owned'; end if;
  if not exists(select 1 from public.curriculum_learning_outcomes clo where clo.id=p_outcome_id and clo.status<>'retired') then
    raise exception 'outcome_not_found';
  end if;
  if assessment.generation_source='lesson_generator'
     and assessment.generation_metadata->>'generator_version'='curriculum-outcome-assessment-v4'
  then
    if assessment.status not in ('draft','review') then
      raise exception 'assessment_outcome_links_locked';
    end if;
    lineage := public.exq_resolve_lesson_assessment_outcomes(assessment.lesson_plan_id);
    if not exists (
      select 1 from jsonb_array_elements(lineage->'outcomes') as linked(outcome)
      where linked.outcome->>'id'=p_outcome_id::text and linked.outcome->>'status'='active'
    ) then raise exception 'outcome_not_linked_to_lesson'; end if;
  end if;
  insert into public.assessment_item_outcomes(assessment_item_id,outcome_id,weight)
  values(p_assessment_item_id,p_outcome_id,p_weight)
  on conflict(assessment_item_id,outcome_id) do update set weight=excluded.weight;
  return jsonb_build_object('ok',true,'assessment_item_id',p_assessment_item_id,'outcome_id',p_outcome_id,'weight',p_weight);
end;
$function$
;

-- Release the grade and its outcome evidence in one transaction.
CREATE OR REPLACE FUNCTION public.exq_finalize_attempt(p_attempt_id uuid, p_feedback text DEFAULT NULL::text, p_release boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare caller uuid:=auth.uid(); at public.assessment_attempts%rowtype; aa public.assessment_assignments%rowtype; assessment public.assessment_definitions%rowtype; unresolved integer; response_count integer; total_score numeric; total_max numeric; pct numeric; next_status text; next_result text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into at from public.assessment_attempts where id=p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  select * into aa from public.assessment_assignments where id=at.assignment_id;
  if not found or aa.assessment_id is distinct from at.assessment_id
    or aa.school_id is distinct from at.school_id or aa.class_id is distinct from at.class_id
  then raise exception 'attempt_assignment_mismatch'; end if;
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
      active_client_id=null,client_lease_expires_at=null,client_lease_updated_at=now(),
      locked_at=coalesce(locked_at,now()),lock_reason=coalesce(lock_reason,'submitted'),updated_at=now()
  where id=at.id;
  if p_release then
    select * into strict assessment from public.assessment_definitions where id=at.assessment_id;
    insert into public.assessment_gradebook_entries(
      attempt_id,assignment_id,assessment_id,student_id,school_id,class_id,subject_id,
      teacher_id,score,max_score,percentage,assessment_type,assessment_title,released_at,updated_at
    ) values (
      at.id,at.assignment_id,at.assessment_id,at.student_id,at.school_id,at.class_id,
      assessment.subject_id,caller,total_score,total_max,pct,assessment.assessment_type,
      assessment.title,now(),now()
    )
    on conflict(attempt_id) do update set score=excluded.score,max_score=excluded.max_score,
      percentage=excluded.percentage,updated_at=excluded.updated_at;

    perform public.exq_sync_attempt_outcome_evidence(at.id);
  end if;

  return jsonb_build_object('ok',true,'attempt_id',at.id,'status',next_status,'result_status',next_result,
    'score',total_score,'max_score',total_max,'percentage',pct,'released',p_release);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.exq_sync_attempt_outcome_evidence(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  caller uuid := auth.uid();
  v_attempt public.assessment_attempts%rowtype;
  v_assignment public.assessment_assignments%rowtype;
  v_assessment public.assessment_definitions%rowtype;
  rows_written integer := 0;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select * into v_attempt from public.assessment_attempts where id = p_attempt_id;
  if not found then raise exception 'attempt_not_found'; end if;

  select * into v_assignment from public.assessment_assignments where id = v_attempt.assignment_id;
  if not found then raise exception 'assignment_not_found'; end if;
  if v_assignment.teacher_id is distinct from caller then raise exception 'attempt_not_owned'; end if;
  if v_attempt.status not in ('marked','released') then raise exception 'attempt_not_finalized'; end if;

  select * into v_assessment from public.assessment_definitions where id = v_attempt.assessment_id;
  if not found then raise exception 'assessment_not_found'; end if;

  insert into public.competency_evidence_ledger(
    student_id, outcome_id, evidence_source, evidence_id, score, max_score,
    proficiency, observed_by, observed_at, weight, school_id, class_id, subject_id
  )
  select
    v_attempt.student_id,
    aio.outcome_id,
    'assessment_response',
    ar.id,
    ar.final_score,
    ar.max_score,
    case
      when ar.max_score is null or ar.max_score <= 0 then 'not_started'
      when (ar.final_score / ar.max_score) * 100 >= 85 then 'exceeding'
      when (ar.final_score / ar.max_score) * 100 >= 70 then 'meeting'
      when (ar.final_score / ar.max_score) * 100 >= 55 then 'developing'
      when (ar.final_score / ar.max_score) * 100 >= 40 then 'emerging'
      else 'needs_intervention'
    end,
    caller,
    coalesce(v_attempt.teacher_reviewed_at, now()),
    greatest(coalesce(aio.weight, 1), 0.000001),
    v_attempt.school_id,
    v_attempt.class_id,
    v_assessment.subject_id
  from public.assessment_responses ar
  join public.assessment_item_outcomes aio on aio.assessment_item_id = ar.assessment_item_id
  where ar.attempt_id = v_attempt.id
    and ar.status<>'void'
    and ar.final_score is not null
  on conflict (evidence_source, evidence_id, outcome_id)
  do update set
    score = excluded.score,
    max_score = excluded.max_score,
    proficiency = excluded.proficiency,
    observed_by = excluded.observed_by,
    observed_at = excluded.observed_at,
    weight = excluded.weight,
    school_id = excluded.school_id,
    class_id = excluded.class_id,
    subject_id = excluded.subject_id;
  get diagnostics rows_written = row_count;

  insert into public.student_outcome_mastery(
    student_id, outcome_id, mastery_level, mastery_score, evidence_count,
    last_evidence_at, updated_at
  )
  select
    cel.student_id,
    cel.outcome_id,
    case
      when sum(cel.max_score * cel.weight) <= 0 then 'not_started'
      when (sum(cel.score * cel.weight) / sum(cel.max_score * cel.weight)) * 100 >= 85 then 'exceeding'
      when (sum(cel.score * cel.weight) / sum(cel.max_score * cel.weight)) * 100 >= 70 then 'meeting'
      when (sum(cel.score * cel.weight) / sum(cel.max_score * cel.weight)) * 100 >= 55 then 'developing'
      when (sum(cel.score * cel.weight) / sum(cel.max_score * cel.weight)) * 100 >= 40 then 'emerging'
      else 'needs_intervention'
    end,
    case
      when sum(cel.max_score * cel.weight) > 0
        then round((sum(cel.score * cel.weight) / sum(cel.max_score * cel.weight)) * 100, 2)
      else 0
    end,
    count(*),
    max(cel.observed_at),
    now()
  from public.competency_evidence_ledger cel
  where cel.student_id = v_attempt.student_id
    and cel.outcome_id in (
      select distinct aio.outcome_id
      from public.assessment_responses ar
      join public.assessment_item_outcomes aio on aio.assessment_item_id = ar.assessment_item_id
      where ar.attempt_id = v_attempt.id and ar.status<>'void' and ar.final_score is not null
    )
  group by cel.student_id, cel.outcome_id
  on conflict (student_id, outcome_id)
  do update set
    mastery_level = excluded.mastery_level,
    mastery_score = excluded.mastery_score,
    evidence_count = excluded.evidence_count,
    last_evidence_at = excluded.last_evidence_at,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'attempt_id', v_attempt.id,
    'evidence_rows', rows_written
  );
end;
$function$
;

commit;
