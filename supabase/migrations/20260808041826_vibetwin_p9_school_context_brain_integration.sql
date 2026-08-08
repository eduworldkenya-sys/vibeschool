-- P9 final repository replay authority. This file intentionally reconciles the
-- live 041704 teacher-sync migration and the 041826 brain integration so a
-- fresh replay reaches the same final production contract.

create or replace function public.student_get_teacher_sync_context()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_class_id uuid;
  v_school_id uuid;
  v_timezone text := 'Africa/Nairobi';
  v_local_now timestamp;
  v_local_date date;
  v_local_time time;
  v_local_dow integer;
  v_current jsonb;
  v_next jsonb;
  v_focus_subject uuid;
  v_scheme jsonb;
  v_minutes integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select s.id into v_student_id from public.students s where s.profile_id=v_uid and s.deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  select sc.class_id,sc.school_id into v_class_id,v_school_id
  from public.student_classes sc
  where sc.student_id=v_student_id and sc.is_current=true
  order by sc.joined_at desc limit 1;
  if v_class_id is null then
    return jsonb_build_object('student_id',v_student_id,'has_school_context',false,'reason','no_current_class');
  end if;

  select coalesce(sch.timezone,'Africa/Nairobi') into v_timezone from public.schools sch where sch.id=v_school_id;
  v_local_now := timezone(v_timezone,now());
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;
  v_local_dow := extract(isodow from v_local_now)::integer;

  select jsonb_build_object(
    'slot_id',ts.id,'occurrence_id',o.id,'subject_id',ts.subject_id,'subject',coalesce(sub.name,'Subject'),
    'teacher_id',ts.teacher_id,'date',v_local_date,'start_time',ts.start_time,'end_time',ts.end_time,
    'lifecycle',coalesce(o.lifecycle,'scheduled'),'is_current',true
  ) into v_current
  from public.timetable_slots ts
  left join public.teaching_occurrences o on o.timetable_slot_id=ts.id and o.occurrence_date=v_local_date and o.lifecycle not in ('cancelled','missed')
  left join public.subjects sub on sub.id=ts.subject_id
  where ts.class_id=v_class_id and ts.school_id=v_school_id
    and ts.day_of_week=v_local_dow
    and v_local_date>=coalesce(ts.effective_from,v_local_date)
    and v_local_date<=coalesce(ts.effective_until,v_local_date)
    and v_local_time>=ts.start_time and v_local_time<ts.end_time
  order by ts.start_time limit 1;

  with candidate as (
    select ts.*,sub.name subject_name,
      case
        when ts.day_of_week=v_local_dow and ts.start_time>v_local_time then v_local_date
        else v_local_date + ((ts.day_of_week-v_local_dow+7)%7)
             + case when ts.day_of_week=v_local_dow and ts.start_time<=v_local_time then 7 else 0 end
      end candidate_date
    from public.timetable_slots ts
    left join public.subjects sub on sub.id=ts.subject_id
    where ts.class_id=v_class_id and ts.school_id=v_school_id
      and (ts.effective_until is null or ts.effective_until>=v_local_date)
  ), ranked as (
    select c.*,(c.candidate_date::timestamp+c.start_time) starts_at_local
    from candidate c
    where c.candidate_date>=coalesce(c.effective_from,c.candidate_date)
      and c.candidate_date<=coalesce(c.effective_until,c.candidate_date)
  )
  select jsonb_build_object(
    'slot_id',r.id,'subject_id',r.subject_id,'subject',coalesce(r.subject_name,'Subject'),'teacher_id',r.teacher_id,
    'date',r.candidate_date,'start_time',r.start_time,'end_time',r.end_time,
    'minutes_until',greatest(0,floor(extract(epoch from (r.starts_at_local-v_local_now))/60.0)::integer),'is_current',false
  ) into v_next
  from ranked r
  where r.starts_at_local>v_local_now
  order by r.starts_at_local limit 1;

  v_focus_subject := coalesce(nullif(v_current->>'subject_id','')::uuid,nullif(v_next->>'subject_id','')::uuid);
  if v_focus_subject is not null then
    select jsonb_build_object(
      'scheme_id',sw.id,'subject_id',sw.subject_id,'subject',coalesce(sub.name,sw.subject,'Subject'),
      'topic',coalesce(sw.topic,sw.sub_strand,'Current scheme focus'),'strand',sw.strand,'sub_strand',sw.sub_strand,
      'week',sw.week,'sequence_number',sw.sequence_number,'status',sw.status,'content_status',sw.content_status,
      'teacher_id',sw.teacher_id,'curriculum_content_id',sw.curriculum_content_id
    ) into v_scheme
    from public.scheme_of_work sw
    left join public.subjects sub on sub.id=sw.subject_id
    where sw.class_id=v_class_id and sw.school_id=v_school_id and sw.subject_id=v_focus_subject
      and coalesce(sw.status,'planned') not in ('cancelled','archived')
    order by case when sw.status='teaching' then 0 when sw.status='planned' then 1 when sw.status='done' then 2 else 3 end,
             case when sw.status='done' then -coalesce(sw.sequence_number,0) else coalesce(sw.sequence_number,2147483647) end
    limit 1;
  end if;

  v_minutes := nullif(v_next->>'minutes_until','')::integer;
  return jsonb_build_object(
    'student_id',v_student_id,'class_id',v_class_id,'school_id',v_school_id,'timezone',v_timezone,
    'generated_at',now(),'local_time',v_local_now,
    'current_class',v_current,'next_class',v_next,'scheme_focus',v_scheme,
    'alignment_required',v_current is not null or (v_minutes is not null and v_minutes<=90),
    'alignment_reason',case when v_current is not null then 'current_teacher_lesson' when v_minutes is not null and v_minutes<=90 then 'teacher_lesson_within_90_minutes' else 'school_context_available' end
  );
end;
$function$;
revoke all on function public.student_get_teacher_sync_context() from public,anon;
grant execute on function public.student_get_teacher_sync_context() to authenticated;

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
  v_teacher jsonb;
  v_class jsonb;
  v_scheme jsonb;
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

  v_teacher := public.student_get_teacher_sync_context();
  if v_now is null and coalesce((v_teacher->>'alignment_required')::boolean,false) then
    v_class := coalesce(v_teacher->'current_class',v_teacher->'next_class');
    v_scheme := v_teacher->'scheme_focus';
    v_now := jsonb_build_object(
      'decision_type','teacher_context',
      'title',case when v_teacher->'current_class' is not null then 'Stay with your teacher''s current lesson' else 'Prepare for your next class' end,
      'subject_id',nullif(v_class->>'subject_id','')::uuid,
      'subject',v_class->>'subject',
      'topic',coalesce(v_scheme->>'topic',v_scheme->>'sub_strand','Teacher lesson'),
      'scheme_id',nullif(v_scheme->>'scheme_id','')::uuid,
      'teacher_id',nullif(v_class->>'teacher_id','')::uuid,
      'reason',case when v_teacher->'current_class' is not null then 'Your teacher is teaching this subject now, so Twin should support the same lesson rather than pull you into unrelated optional work.' else format('Your next teacher-led class starts in %s minute(s), so Twin should prepare you for the teacher''s current scheme focus.',coalesce(v_class->>'minutes_until','soon')) end,
      'reason_chain',jsonb_build_array('Teacher schedule','Current scheme pace',coalesce(v_scheme->>'topic',v_class->>'subject')),
      'action_url','/student/twin?layer=learn','teacher_context',v_teacher
    );
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

  return jsonb_build_object('student_id',v_student_id,'now',v_now,'next',v_next,'later',v_later,'teacher_context',v_teacher,
    'rule','assigned_work_then_teacher_intervention_then_imminent_teacher_context_then_mastery_recommendation');
end;
$function$;
revoke all on function public.student_get_twin_priority() from public,anon;
grant execute on function public.student_get_twin_priority() to authenticated;

create or replace function public.student_plan_adaptive_session(p_pace_override text default null::text,p_mode text default 'practice'::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid := auth.uid(); v_student_id uuid; v_existing public.student_adaptive_learning_sessions%rowtype;
  v_brain jsonb; v_item jsonb; v_outcome_id uuid; v_effective numeric := 0; v_forgetting numeric := 0; v_confidence numeric := 0;
  v_base_minutes integer := 25; v_recommended text := 'steady'; v_chosen text; v_minutes integer; v_reason text; v_evidence integer := 0; v_id uuid; v_teacher jsonb; v_scheme jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_mode not in ('explain','practice','homework','revision','exam','challenge') then raise exception 'Unsupported session mode'; end if;
  if p_pace_override is not null and p_pace_override not in ('gentle','steady','fast') then raise exception 'Unsupported pace'; end if;
  select s.id into v_student_id from public.students s where s.profile_id=v_uid and s.deleted_at is null limit 1;
  if v_student_id is null then raise exception 'Learner identity not found'; end if;
  if p_pace_override is null then
    select * into v_existing from public.student_adaptive_learning_sessions where student_id=v_student_id and status='active' and created_at>now()-interval '12 hours' order by created_at desc limit 1;
    if v_existing.id is not null then return jsonb_build_object('id',v_existing.id,'focus_outcome_id',v_existing.focus_outcome_id,'mode',v_existing.mode,'recommended_pace',v_existing.recommended_pace,'chosen_pace',v_existing.chosen_pace,'planned_minutes',v_existing.planned_minutes,'reason',v_existing.reason,'status',v_existing.status,'mastery_before',v_existing.mastery_before,'forgetting_risk_before',v_existing.forgetting_risk_before,'evidence_count_before',v_existing.evidence_count_before,'plan',v_existing.plan,'resumed',true); end if;
  end if;
  v_brain:=coalesce(public.student_get_twin_brain(),'{}'::jsonb); v_teacher:=public.student_get_teacher_sync_context(); v_scheme:=v_teacher->'scheme_focus';
  v_confidence:=coalesce(nullif(v_brain->>'confidence','')::numeric,0); v_base_minutes:=greatest(10,least(90,coalesce(nullif(v_brain #>> '{study_time,session_minutes}','')::integer,25))); v_evidence:=coalesce(nullif(v_brain #>> '{evidence,competency_evidence_count}','')::integer,0);
  select value into v_item from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value order by coalesce((value->>'effective_mastery')::numeric,(value->>'mastery_score')::numeric,0) asc,coalesce((value->>'forgetting_risk')::numeric,0) desc limit 1;
  v_outcome_id:=nullif(v_item->>'outcome_id','')::uuid; v_effective:=coalesce(nullif(v_item->>'effective_mastery','')::numeric,nullif(v_item->>'mastery_score','')::numeric,0); v_forgetting:=coalesce(nullif(v_item->>'forgetting_risk','')::numeric,0);
  if v_outcome_id is null then select m.outcome_id,coalesce(m.mastery_score,0) into v_outcome_id,v_effective from public.student_outcome_mastery m join public.curriculum_learning_outcomes o on o.id=m.outcome_id and o.status in ('active','verified') where m.student_id=v_student_id order by coalesce(m.mastery_score,0) asc,m.updated_at asc limit 1; v_forgetting:=0; end if;
  if v_effective<50 or v_forgetting>=0.60 then v_recommended:='gentle'; v_reason:='Twin recommends a gentler session because this skill needs more support or is at higher forgetting risk.';
  elsif v_effective>=80 and v_forgetting<0.25 and v_confidence>=0.65 then v_recommended:='fast'; v_reason:='Twin recommends a faster session because the skill is secure and the evidence is reasonably confident.';
  else v_recommended:='steady'; v_reason:='Twin recommends a steady session to balance explanation, practice and recall.'; end if;
  if coalesce((v_teacher->>'alignment_required')::boolean,false) and v_scheme is not null then v_reason:=format('Stay aligned with your teacher: %s — %s. %s',coalesce(v_scheme->>'subject','your next subject'),coalesce(v_scheme->>'topic','current scheme focus'),v_reason); end if;
  v_chosen:=coalesce(p_pace_override,v_recommended); v_minutes:=case v_chosen when 'gentle' then greatest(10,round(v_base_minutes*0.90)::integer) when 'fast' then greatest(10,round(v_base_minutes*0.75)::integer) else v_base_minutes end;
  update public.student_adaptive_learning_sessions set status='abandoned',updated_at=now() where student_id=v_student_id and status='planned';
  insert into public.student_adaptive_learning_sessions(student_id,profile_id,focus_outcome_id,mode,recommended_pace,chosen_pace,planned_minutes,reason,mastery_before,forgetting_risk_before,evidence_count_before,plan)
  values(v_student_id,v_uid,v_outcome_id,p_mode,v_recommended,v_chosen,v_minutes,v_reason,v_effective,v_forgetting,v_evidence,jsonb_build_object('brain_confidence',v_confidence,'base_minutes',v_base_minutes,'learner_override',p_pace_override is not null,'focus_authority',case when v_item is null then 'student_outcome_mastery' else 'twin_brain' end,'teacher_context',v_teacher,'teacher_alignment_required',coalesce((v_teacher->>'alignment_required')::boolean,false))) returning id into v_id;
  return jsonb_build_object('id',v_id,'focus_outcome_id',v_outcome_id,'mode',p_mode,'recommended_pace',v_recommended,'chosen_pace',v_chosen,'planned_minutes',v_minutes,'reason',v_reason,'status','planned','mastery_before',v_effective,'forgetting_risk_before',v_forgetting,'evidence_count_before',v_evidence,'teacher_context',v_teacher,'resumed',false);
end;
$function$;
revoke all on function public.student_plan_adaptive_session(text,text) from public,anon;
grant execute on function public.student_plan_adaptive_session(text,text) to authenticated;

create or replace function public.student_get_twin_brain()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_state jsonb; v_mastery jsonb; v_prediction jsonb; v_priority jsonb; v_evidence jsonb; v_learning jsonb; v_adaptation jsonb;
  v_tutor jsonb; v_school_context jsonb; v_teacher_context jsonb; v_student_id uuid;
begin
  v_state := public.student_get_twin_state();
  v_mastery := public.student_get_twin_mastery();
  v_prediction := public.student_get_twin_prediction();
  v_priority := public.student_get_twin_priority();
  v_evidence := public.student_get_twin_evidence();
  v_learning := public.student_get_twin_learning();
  v_adaptation := public.student_get_twin_adaptation();
  v_school_context := public.student_get_twin_school_context();
  v_teacher_context := public.student_get_teacher_sync_context();
  v_student_id := nullif(v_state->>'student_id','')::uuid;
  v_tutor := jsonb_build_object(
    'mode','bounded','can_explain',true,'can_question',true,'can_hint',true,'can_generate_practice',true,
    'cannot_change_marks',true,'cannot_mark_verified_completion',true,'cannot_override_teacher_interventions',true,
    'cannot_claim_official_exam_prediction',true,'must_use_learner_evidence',true,'must_abstain_when_evidence_is_insufficient',true,
    'must_respect_teacher_assignments',true,'must_respect_teacher_pacing',true,
    'mastery',v_mastery,'prediction',v_prediction,'decision',v_priority,'learning',v_learning,'adaptation',v_adaptation,
    'teacher_context',v_teacher_context,'school_context',v_school_context,
    'interventions',coalesce(v_state->'interventions','[]'::jsonb),'curriculum',coalesce(v_state->'curriculum','{}'::jsonb));
  v_state := v_state || jsonb_build_object('mastery',v_mastery,'prediction',v_prediction,'decision',v_priority,'evidence',v_evidence,'learning',v_learning,'adaptation',v_adaptation,'teacher_context',v_teacher_context,'school_context',v_school_context,'tutor',v_tutor);
  if v_student_id is not null then
    update public.student_twin_state_snapshots set state=v_state,confidence_score=coalesce((v_state->>'confidence')::numeric,confidence_score),evidence_count=coalesce((v_evidence->>'competency_evidence_count')::integer,evidence_count),generated_at=now(),updated_at=now() where student_id=v_student_id;
  end if;
  return v_state;
end;
$function$;
revoke all on function public.student_get_twin_brain() from public,anon;
grant execute on function public.student_get_twin_brain() to authenticated;

create or replace function public.student_get_twin_tutor_context()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_brain jsonb; v_memory jsonb;
begin
  v_brain := public.student_get_twin_brain();
  v_memory := public.student_get_twin_memory();
  return jsonb_build_object(
    'student_id',v_brain->'student_id','generated_at',v_brain->'generated_at','confidence',v_brain->'confidence',
    'curriculum',v_brain->'curriculum','mastery',v_brain->'mastery','interventions',v_brain->'interventions',
    'recommendations',v_brain->'recommendations','decision',v_brain->'decision','prediction',v_brain->'prediction',
    'evidence',v_brain->'evidence','learning',v_brain->'learning','adaptation',v_brain->'adaptation','memory',v_memory,
    'teacher_context',v_brain->'teacher_context','school_context',v_brain->'school_context','exam',v_brain->'exam','study_time',v_brain->'study_time','guardrails',v_brain->'tutor');
end;
$function$;
revoke all on function public.student_get_twin_tutor_context() from public,anon;
grant execute on function public.student_get_twin_tutor_context() to authenticated;
revoke all on function public.student_get_twin_school_context() from public,anon;
grant execute on function public.student_get_twin_school_context() to authenticated;
