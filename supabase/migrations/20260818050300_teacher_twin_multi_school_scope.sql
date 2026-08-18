-- Teacher Twin multi-school authority closure.
--
-- `supabase migration new teacher_twin_multi_school_scope` was attempted with the
-- repository-pinned Supabase CLI version but the execution environment timed out.
-- This forward-only version is therefore placed after the repository's existing
-- 20260818043xxx migrations without rewriting any historical Teacher Twin ledger entry.
--
-- Invariants:
--   * one authenticated Teacher may hold multiple school memberships;
--   * every Teacher Twin state/memory row is isolated by school;
--   * explicit-school RPCs verify Teacher membership server-side;
--   * zero-argument compatibility RPCs fail closed when school scope is ambiguous;
--   * school-owned evidence is filtered by the selected school;
--   * generative AI is not part of this authority/state path.

-- ---------------------------------------------------------------------------
-- 1. School becomes part of state and memory identity.
-- ---------------------------------------------------------------------------

alter table public.teacher_twin_state_snapshots
  drop constraint if exists teacher_twin_state_snapshots_pkey;

alter table public.teacher_twin_state_snapshots
  add constraint teacher_twin_state_snapshots_pkey
  primary key (teacher_id, school_id);

alter table public.teacher_twin_memory_claims
  drop constraint if exists teacher_twin_memory_claims_teacher_id_claim_key_key;

alter table public.teacher_twin_memory_claims
  drop constraint if exists teacher_twin_memory_claims_teacher_school_claim_key_key;

alter table public.teacher_twin_memory_claims
  add constraint teacher_twin_memory_claims_teacher_school_claim_key_key
  unique (teacher_id, school_id, claim_key);

drop index if exists public.idx_teacher_twin_memory_teacher_importance;
create index idx_teacher_twin_memory_teacher_school_importance
  on public.teacher_twin_memory_claims
  (teacher_id, school_id, importance desc, last_confirmed_at desc);

-- ---------------------------------------------------------------------------
-- 2. Explicit school-scoped memory refresh.
-- ---------------------------------------------------------------------------

create or replace function public.teacher_refresh_twin_memory(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_plans integer := 0;
  v_reflections integer := 0;
  v_completed integer := 0;
  v_marking integer := 0;
  v_interventions integer := 0;
  v_behind integer := 0;
  v_student_twin_attention integer := 0;
  v_evaluated_interventions integer := 0;
  v_mean_intervention_gain numeric := null;
  v_now timestamptz := now();
begin
  perform public.hq_require_policy_enabled('twin','twin.enabled');
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_school_id is null then raise exception 'teacher_school_scope_required'; end if;

  if not exists (
    select 1
    from public.school_members sm
    where sm.profile_id = v_uid
      and sm.school_id = p_school_id
      and sm.role = 'teacher'
  ) then
    raise exception 'teacher_school_scope_not_authorized';
  end if;

  select count(*) into v_plans
  from public.lesson_plans lp
  where lp.teacher_id = v_uid
    and lp.created_at >= v_now - interval '30 days'
    and (
      lp.school_id = p_school_id
      or (
        lp.school_id is null
        and exists (
          select 1 from public.teacher_classes tc
          where tc.teacher_id = v_uid
            and tc.school_id = p_school_id
            and tc.class_id = lp.class_id
        )
      )
    );

  select count(*) into v_reflections
  from public.lesson_reflections lr
  where lr.teacher_id = v_uid
    and lr.created_at >= v_now - interval '30 days'
    and (
      lr.school_id = p_school_id
      or (
        lr.school_id is null
        and exists (
          select 1
          from public.teaching_occurrences tor
          where tor.id = lr.teaching_occurrence_id
            and tor.teacher_id = v_uid
            and tor.school_id = p_school_id
        )
      )
    );

  select count(*) into v_completed
  from public.teaching_occurrences t
  where t.teacher_id = v_uid
    and t.school_id = p_school_id
    and t.lifecycle = 'completed'
    and t.completed_at >= v_now - interval '30 days';

  select count(*) into v_marking
  from public.homework_submissions hs
  join public.homework h on h.id = hs.homework_id
  where h.teacher_id = v_uid
    and h.school_id = p_school_id
    and hs.status = 'submitted'
    and hs.mark is null;

  select count(*) into v_interventions
  from public.assessment_interventions ai
  where ai.teacher_id = v_uid
    and ai.school_id = p_school_id
    and ai.status in ('open','active','planned');

  select count(*) into v_behind
  from public.scheme_of_work sw
  where sw.teacher_id = v_uid
    and sw.school_id = p_school_id
    and coalesce(sw.status,'planned') not in ('done','covered','completed')
    and sw.date is not null
    and sw.date < (v_now at time zone 'Africa/Nairobi')::date;

  select count(distinct sc.student_id) into v_student_twin_attention
  from public.teacher_classes tc
  join public.student_classes sc
    on sc.class_id = tc.class_id
   and sc.school_id = p_school_id
   and sc.is_current = true
  join public.students s
    on s.id = sc.student_id
   and s.deleted_at is null
  join public.student_twin_state_snapshots st on st.student_id = sc.student_id
  where tc.teacher_id = v_uid
    and tc.school_id = p_school_id
    and (
      coalesce(st.state->'decision'->'now'->>'priority','') in ('critical','urgent','high')
      or coalesce(st.state->'decision'->'now'->>'decision_type','') = 'intervention'
      or coalesce(st.state->'decision'->'now'->>'status','') in ('overdue','returned')
    );

  select count(*), round(avg(ai.mastery_change)::numeric,2)
    into v_evaluated_interventions, v_mean_intervention_gain
  from public.assessment_interventions ai
  where ai.teacher_id = v_uid
    and ai.school_id = p_school_id
    and ai.evaluated_at is not null
    and ai.mastery_change is not null;

  insert into public.teacher_twin_memory_claims(
    teacher_id, school_id, memory_type, claim_key, claim,
    confidence, evidence_count, importance, last_confirmed_at, provenance
  )
  values
    (v_uid,p_school_id,'planning_pattern','planning:30d',format('%s lesson plans created for this school in the last 30 days.',v_plans),least(0.95,0.35+least(v_plans,12)*0.05),greatest(v_plans,1),0.7,v_now,jsonb_build_object('source','lesson_plans','school_id',p_school_id,'window_days',30)),
    (v_uid,p_school_id,'reflection_pattern','reflection:30d',format('%s reflections recorded against %s completed teaching occurrences for this school in the last 30 days.',v_reflections,v_completed),case when v_completed=0 then 0.3 else least(0.95,0.4+(least(v_reflections::numeric/v_completed,1)*0.5)) end,greatest(v_completed,1),0.75,v_now,jsonb_build_object('source','lesson_reflections+teaching_occurrences','school_id',p_school_id,'window_days',30)),
    (v_uid,p_school_id,'workload_pattern','marking:pending',format('%s learner submissions for this school are waiting for marking.',v_marking),0.9,greatest(v_marking,1),case when v_marking>0 then 0.9 else 0.4 end,v_now,jsonb_build_object('source','homework_submissions','school_id',p_school_id,'status','submitted')),
    (v_uid,p_school_id,'learner_risk_pattern','interventions:open',format('%s learner interventions for this school are open or planned.',v_interventions),0.9,greatest(v_interventions,1),case when v_interventions>0 then 0.95 else 0.4 end,v_now,jsonb_build_object('source','assessment_interventions','school_id',p_school_id)),
    (v_uid,p_school_id,'learner_risk_pattern','student_twin:attention',format('%s learners in assigned classes for this school currently have a high-priority Student Twin signal.',v_student_twin_attention),0.85,greatest(v_student_twin_attention,1),case when v_student_twin_attention>0 then 0.95 else 0.4 end,v_now,jsonb_build_object('source','student_twin_state_snapshots','school_id',p_school_id,'scope','current_student_classes')),
    (v_uid,p_school_id,'assessment_pattern','intervention:effectiveness',case when v_evaluated_interventions=0 then 'No evaluated teacher interventions for this school have enough before/after mastery evidence yet.' else format('%s evaluated teacher interventions for this school have an average mastery change of %s points.',v_evaluated_interventions,coalesce(v_mean_intervention_gain,0)) end,case when v_evaluated_interventions=0 then 0.25 else least(0.95,0.35+least(v_evaluated_interventions,12)*0.05) end,greatest(v_evaluated_interventions,1),0.8,v_now,jsonb_build_object('source','assessment_interventions','school_id',p_school_id,'metric','mastery_change')),
    (v_uid,p_school_id,'curriculum_pattern','scheme:overdue',format('%s scheme items for this school are dated before today and are not marked done.',v_behind),0.85,greatest(v_behind,1),case when v_behind>0 then 0.9 else 0.5 end,v_now,jsonb_build_object('source','scheme_of_work','school_id',p_school_id))
  on conflict(teacher_id,school_id,claim_key) do update set
    claim = excluded.claim,
    confidence = excluded.confidence,
    evidence_count = excluded.evidence_count,
    importance = excluded.importance,
    last_confirmed_at = excluded.last_confirmed_at,
    provenance = excluded.provenance,
    status = 'active',
    updated_at = now();

  return jsonb_build_object(
    'teacher_id',v_uid,
    'school_id',p_school_id,
    'refreshed_at',v_now
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Explicit school-scoped Teacher brain.
-- ---------------------------------------------------------------------------

create or replace function public.teacher_get_twin_brain(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_now_time time := (now() at time zone 'Africa/Nairobi')::time;
  v_dow integer := extract(isodow from (now() at time zone 'Africa/Nairobi'))::integer;
  v_classes integer := 0;
  v_completed_today integer := 0;
  v_in_progress integer := 0;
  v_plan_count integer := 0;
  v_pending_marking integer := 0;
  v_open_interventions integer := 0;
  v_student_twin_attention integer := 0;
  v_overdue_scheme integer := 0;
  v_reflection_gap integer := 0;
  v_attendance_pending integer := 0;
  v_unread_threads integer := 0;
  v_attendance_streak integer := 0;
  v_tpad_due date := null;
  v_tpad_days integer := null;
  v_credit_balance integer := null;
  v_today_schedule jsonb := '[]'::jsonb;
  v_at_risk_students jsonb := '[]'::jsonb;
  v_homework_due jsonb := '[]'::jsonb;
  v_evaluated_interventions integer := 0;
  v_mean_intervention_gain numeric := null;
  v_now_action jsonb;
  v_next jsonb := '[]'::jsonb;
  v_later jsonb := '[]'::jsonb;
  v_memory jsonb := '[]'::jsonb;
  v_evidence integer := 0;
  v_conf numeric := 0;
  v_state jsonb;
  v_slot record;
  v_occ record;
  v_term_id uuid;
begin
  perform public.hq_require_policy_enabled('twin','twin.enabled');
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_school_id is null then raise exception 'teacher_school_scope_required'; end if;

  select p.full_name into v_name
  from public.profiles p
  where p.id = v_uid;

  if not exists (
    select 1
    from public.school_members sm
    where sm.profile_id = v_uid
      and sm.school_id = p_school_id
      and sm.role = 'teacher'
  ) then
    raise exception 'teacher_school_scope_not_authorized';
  end if;

  perform public.teacher_refresh_twin_memory(p_school_id);

  select id into v_term_id
  from public.academic_terms
  where school_id = p_school_id and status = 'active'
  order by start_date desc
  limit 1;

  select count(*) into v_classes
  from public.teacher_classes tc
  where tc.teacher_id = v_uid and tc.school_id = p_school_id;

  select count(*) into v_completed_today
  from public.teaching_occurrences t
  where t.teacher_id = v_uid
    and t.school_id = p_school_id
    and t.occurrence_date = v_today
    and t.lifecycle = 'completed';

  select count(*) into v_in_progress
  from public.teaching_occurrences t
  where t.teacher_id = v_uid
    and t.school_id = p_school_id
    and t.occurrence_date = v_today
    and t.lifecycle = 'in_progress';

  select count(*) into v_pending_marking
  from public.homework_submissions hs
  join public.homework h on h.id = hs.homework_id
  where h.teacher_id = v_uid
    and h.school_id = p_school_id
    and hs.status = 'submitted'
    and hs.mark is null;

  select count(*) into v_open_interventions
  from public.assessment_interventions ai
  where ai.teacher_id = v_uid
    and ai.school_id = p_school_id
    and ai.status in ('open','active','planned');

  select count(*) into v_overdue_scheme
  from public.scheme_of_work sw
  where sw.teacher_id = v_uid
    and sw.school_id = p_school_id
    and coalesce(sw.status,'planned') not in ('done','covered','completed')
    and sw.date is not null
    and sw.date < v_today;

  select count(*) into v_reflection_gap
  from public.teaching_occurrences t
  where t.teacher_id = v_uid
    and t.school_id = p_school_id
    and t.lifecycle = 'completed'
    and t.completed_at >= v_now - interval '7 days'
    and not exists (
      select 1 from public.lesson_reflections lr
      where lr.teaching_occurrence_id = t.id
    );

  select count(distinct ts.id) into v_attendance_pending
  from public.timetable_slots ts
  where ts.teacher_id = v_uid
    and ts.school_id = p_school_id
    and ts.day_of_week = v_dow
    and ts.effective_from <= v_today
    and (ts.effective_until is null or ts.effective_until >= v_today)
    and ts.start_time <= v_now_time
    and not exists (
      select 1 from public.attendance a
      where a.teacher_id = v_uid
        and a.school_id = p_school_id
        and a.date = v_today
        and a.timetable_slot_id = ts.id
    );

  select coalesce(jsonb_agg(x order by x.start_time),'[]'::jsonb)
    into v_today_schedule
  from (
    select ts.id, ts.class_id, ts.subject_id, ts.start_time, ts.end_time,
           coalesce(c.name,'Class') || case when nullif(c.stream,'') is not null then ' '||c.stream else '' end as class_name,
           coalesce(s.name,'Subject') as subject,
           exists(
             select 1 from public.lesson_plans lp
             where lp.teacher_id = v_uid
               and lp.timetable_slot_id = ts.id
               and lp.taught_date = v_today
               and (
                 lp.school_id = p_school_id
                 or (lp.school_id is null and lp.class_id = ts.class_id)
               )
           ) as has_lesson_plan,
           exists(
             select 1 from public.attendance a
             where a.teacher_id = v_uid
               and a.school_id = p_school_id
               and a.date = v_today
               and a.timetable_slot_id = ts.id
           ) as attendance_marked
    from public.timetable_slots ts
    left join public.classes c on c.id = ts.class_id
    left join public.subjects s on s.id = ts.subject_id
    where ts.teacher_id = v_uid
      and ts.school_id = p_school_id
      and ts.day_of_week = v_dow
      and ts.effective_from <= v_today
      and (ts.effective_until is null or ts.effective_until >= v_today)
  ) x;

  select coalesce(jsonb_agg(x order by x.absence_count desc),'[]'::jsonb)
    into v_at_risk_students
  from (
    select st.id as student_id, st.name, count(distinct a.id)::integer as absence_count
    from public.attendance a
    join public.students st on st.id = a.student_id and st.deleted_at is null
    where a.status = 'absent'
      and a.school_id = p_school_id
      and exists (
        select 1 from public.teacher_classes tc
        where tc.class_id = a.class_id
          and tc.teacher_id = v_uid
          and tc.school_id = p_school_id
      )
      and (
        v_term_id is null
        or a.date >= coalesce(
          (select start_date from public.academic_terms where id = v_term_id),
          v_today - 90
        )
      )
    group by st.id, st.name
    having count(distinct a.id) >= 3
    order by count(distinct a.id) desc
    limit 10
  ) x;

  select coalesce(jsonb_agg(x order by x.due_date),'[]'::jsonb)
    into v_homework_due
  from (
    select h.id,h.title,h.subject,h.due_date,h.class_id
    from public.homework h
    where h.teacher_id = v_uid
      and h.school_id = p_school_id
      and h.due_date >= v_today
    order by h.due_date
    limit 8
  ) x;

  select count(*) into v_unread_threads
  from public.vc_participants vp
  join public.vc_threads vt on vt.id = vp.thread_id and vt.school_id = p_school_id
  where vp.profile_id = v_uid
    and vp.school_id = p_school_id
    and vp.left_at is null
    and vt.last_message_at is not null
    and vt.last_message_at > coalesce(vp.last_read_at,vp.joined_at);

  with recursive days(d,streak) as (
    select v_today,0
    union all
    select d-1,
      case when exists(
        select 1 from public.attendance a
        where a.teacher_id = v_uid
          and a.school_id = p_school_id
          and a.date = d
          and a.timetable_slot_id is not null
      ) then streak+1 else streak end
    from days
    where d > v_today-30
      and (
        extract(isodow from d) in (6,7)
        or exists(
          select 1 from public.attendance a
          where a.teacher_id = v_uid
            and a.school_id = p_school_id
            and a.date = d
            and a.timetable_slot_id is not null
        )
      )
  )
  select coalesce(max(streak),0) into v_attendance_streak from days;

  select count(distinct sc.student_id) into v_student_twin_attention
  from public.teacher_classes tc
  join public.student_classes sc
    on sc.class_id = tc.class_id
   and sc.school_id = p_school_id
   and sc.is_current = true
  join public.students s
    on s.id = sc.student_id
   and s.deleted_at is null
  join public.student_twin_state_snapshots st on st.student_id = sc.student_id
  where tc.teacher_id = v_uid
    and tc.school_id = p_school_id
    and (
      coalesce(st.state->'decision'->'now'->>'priority','') in ('critical','urgent','high')
      or coalesce(st.state->'decision'->'now'->>'decision_type','') = 'intervention'
      or coalesce(st.state->'decision'->'now'->>'status','') in ('overdue','returned')
    );

  select count(*),round(avg(ai.mastery_change)::numeric,2)
    into v_evaluated_interventions,v_mean_intervention_gain
  from public.assessment_interventions ai
  where ai.teacher_id = v_uid
    and ai.school_id = p_school_id
    and ai.evaluated_at is not null
    and ai.mastery_change is not null;

  if v_term_id is not null then
    select td.self_appraisal_due into v_tpad_due
    from public.tpad_deadlines td
    where td.school_id = p_school_id and td.term_id = v_term_id
    limit 1;
  end if;
  if v_tpad_due is not null then v_tpad_days := v_tpad_due - v_today; end if;

  -- Credits are intentionally account-level: vibe_credits has no school_id.
  select vc.balance into v_credit_balance
  from public.vibe_credits vc
  where vc.teacher_id = v_uid
  limit 1;
  if v_credit_balance is null then
    select coalesce(sum(vct.amount),0)::integer into v_credit_balance
    from public.vibe_credit_transactions vct
    where vct.teacher_id = v_uid;
  end if;

  select t.* into v_occ
  from public.teaching_occurrences t
  where t.teacher_id = v_uid
    and t.school_id = p_school_id
    and t.occurrence_date = v_today
    and t.lifecycle = 'in_progress'
  order by t.started_at desc nulls last
  limit 1;

  if v_occ.id is not null then
    v_now_action := jsonb_build_object(
      'decision_type','teaching','title','Continue current lesson',
      'reason','A teaching occurrence is already in progress for this school. Finish the active teaching lifecycle before starting another workflow.',
      'reason_chain',jsonb_build_array('Lesson in progress','Preserve teaching continuity'),
      'action_url','/teacher/timetable','action_label','Continue lesson',
      'priority','critical','occurrence_id',v_occ.id
    );
  end if;

  if v_now_action is null then
    select ts.* into v_slot
    from public.timetable_slots ts
    where ts.teacher_id = v_uid
      and ts.school_id = p_school_id
      and ts.day_of_week = v_dow
      and ts.effective_from <= v_today
      and (ts.effective_until is null or ts.effective_until >= v_today)
      and ts.start_time >= v_now_time
    order by ts.start_time
    limit 1;

    if v_slot.id is not null and v_slot.start_time <= (v_now_time + interval '45 minutes') then
      select count(*) into v_plan_count
      from public.lesson_plans lp
      where lp.teacher_id = v_uid
        and lp.timetable_slot_id = v_slot.id
        and lp.taught_date = v_today
        and (
          lp.school_id = p_school_id
          or (lp.school_id is null and lp.class_id = v_slot.class_id)
        );

      v_now_action := jsonb_build_object(
        'decision_type','teaching',
        'title',case when v_plan_count=0 then 'Prepare next lesson' else 'Teach next lesson' end,
        'reason',case when v_plan_count=0 then 'Your next scheduled lesson starts within 45 minutes and no lesson plan is linked for today.' else 'Your next scheduled lesson starts within 45 minutes and its lesson plan is linked.' end,
        'reason_chain',jsonb_build_array('Upcoming timetable slot',case when v_plan_count=0 then 'Lesson plan missing' else 'Lesson plan ready' end),
        'action_url','/teacher/timetable',
        'action_label',case when v_plan_count=0 then 'Prepare lesson' else 'Open timetable' end,
        'priority',case when v_plan_count=0 then 'urgent' else 'high' end,
        'timetable_slot_id',v_slot.id
      );
    end if;
  end if;

  if v_now_action is null and v_attendance_pending>0 then
    v_now_action:=jsonb_build_object('decision_type','attendance','title','Complete pending attendance','reason',format('%s started timetable slot%s have no attendance record today.',v_attendance_pending,case when v_attendance_pending=1 then '' else 's' end),'reason_chain',jsonb_build_array('Scheduled lesson started','Attendance evidence missing'),'action_url','/teacher/attendance','action_label','Mark attendance','priority','urgent');
  end if;
  if v_now_action is null and v_pending_marking>0 then
    v_now_action:=jsonb_build_object('decision_type','marking','title','Review learner submissions','reason',format('%s unmarked learner submission%s are waiting for review.',v_pending_marking,case when v_pending_marking=1 then '' else 's' end),'reason_chain',jsonb_build_array('Pending learner evidence','Teacher feedback required'),'action_url','/teacher/homework','action_label','Open marking','priority','high');
  end if;
  if v_now_action is null and v_open_interventions>0 then
    v_now_action:=jsonb_build_object('decision_type','intervention','title','Review learner interventions','reason',format('%s learner interventions are open or planned.',v_open_interventions),'reason_chain',jsonb_build_array('Learner risk evidence','Teacher intervention required'),'action_url','/teacher/assessment','action_label','Review interventions','priority','high');
  end if;
  if v_now_action is null and v_student_twin_attention>0 then
    v_now_action:=jsonb_build_object('decision_type','learner_signal','title','Review Student Twin attention signals','reason',format('%s learners in your assigned classes have a high-priority Student Twin signal.',v_student_twin_attention),'reason_chain',jsonb_build_array('Student Twin priority','Assigned class'),'action_url','/teacher/students','action_label','Review learners','priority','high');
  end if;
  if v_now_action is null and v_overdue_scheme>0 then
    v_now_action:=jsonb_build_object('decision_type','curriculum','title','Recover curriculum pacing','reason',format('%s scheme items are past their planned date and not done.',v_overdue_scheme),'reason_chain',jsonb_build_array('Scheme pacing overdue','Curriculum continuity'),'action_url','/teacher/scheme','action_label','Open scheme','priority','attention');
  end if;
  if v_now_action is null and v_reflection_gap>0 then
    v_now_action:=jsonb_build_object('decision_type','reflection','title','Close recent lesson reflections','reason',format('%s completed lessons in the last 7 days have no linked reflection.',v_reflection_gap),'reason_chain',jsonb_build_array('Completed teaching evidence','Reflection missing'),'action_url','/teacher/pulse','action_label','Open Pulse','priority','attention');
  end if;
  if v_now_action is null and v_tpad_days is not null and v_tpad_days <= 7 then
    v_now_action:=jsonb_build_object('decision_type','admin','title',case when v_tpad_days<0 then 'TPAD self-appraisal is overdue' else 'TPAD self-appraisal is due soon' end,'reason',case when v_tpad_days<0 then format('TPAD self-appraisal was due %s day%s ago.',abs(v_tpad_days),case when abs(v_tpad_days)=1 then '' else 's' end) else format('TPAD self-appraisal is due in %s day%s.',v_tpad_days,case when v_tpad_days=1 then '' else 's' end) end,'reason_chain',jsonb_build_array('Administrative deadline'),'action_url','/teacher/tpad','action_label','Open TPAD','priority',case when v_tpad_days<0 then 'urgent' else 'attention' end);
  end if;
  if v_now_action is null then
    v_now_action:=jsonb_build_object('decision_type','calm','title','Teaching workflow is on track','reason','No higher-priority teacher obligation is currently detected for this school.','reason_chain',jsonb_build_array('No urgent workflow gaps'),'action_url','/teacher/pulse','action_label','Open Pulse','priority','calm');
  end if;

  v_next := jsonb_build_array(
    jsonb_build_object('decision_type','attendance','title','Pending attendance','count',v_attendance_pending,'action_url','/teacher/attendance','action_label','Mark attendance'),
    jsonb_build_object('decision_type','marking','title','Pending marking','count',v_pending_marking,'action_url','/teacher/homework','action_label','Open marking'),
    jsonb_build_object('decision_type','intervention','title','Open interventions','count',v_open_interventions,'action_url','/teacher/assessment','action_label','Review interventions'),
    jsonb_build_object('decision_type','learner_signal','title','Student Twin attention','count',v_student_twin_attention,'action_url','/teacher/students','action_label','Review learners'),
    jsonb_build_object('decision_type','curriculum','title','Overdue scheme items','count',v_overdue_scheme,'action_url','/teacher/scheme','action_label','Open scheme')
  );

  v_later := jsonb_build_array(
    jsonb_build_object('decision_type','reflection','title','Reflection gaps','count',v_reflection_gap,'action_url','/teacher/pulse','action_label','Open Pulse'),
    jsonb_build_object('decision_type','teaching','title','Completed lessons today','count',v_completed_today,'action_url','/teacher/timetable','action_label','Open timetable'),
    jsonb_build_object('decision_type','effectiveness','title','Evaluated interventions','count',v_evaluated_interventions,'value',v_mean_intervention_gain,'action_url','/teacher/assessment','action_label','Review evidence')
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'type',memory_type,'claim_key',claim_key,'claim',claim,
        'confidence',confidence,'evidence_count',evidence_count,
        'importance',importance,'last_confirmed_at',last_confirmed_at,
        'provenance',provenance
      ) order by importance desc,last_confirmed_at desc
    ),
    '[]'::jsonb
  ) into v_memory
  from public.teacher_twin_memory_claims
  where teacher_id = v_uid
    and school_id = p_school_id
    and status = 'active';

  v_evidence := v_completed_today + v_attendance_pending + v_pending_marking +
    v_open_interventions + v_student_twin_attention + v_overdue_scheme +
    v_reflection_gap + v_classes + v_evaluated_interventions;
  v_conf := least(0.95, 0.35 + least(v_evidence,12)*0.05);

  v_state := jsonb_build_object(
    'teacher_id',v_uid,'school_id',p_school_id,'full_name',coalesce(v_name,'Teacher'),
    'generated_at',v_now,'confidence',v_conf,
    'evidence',jsonb_build_object(
      'assigned_classes',v_classes,'completed_today',v_completed_today,
      'in_progress_today',v_in_progress,'attendance_pending',v_attendance_pending,
      'pending_marking',v_pending_marking,'open_interventions',v_open_interventions,
      'student_twin_attention',v_student_twin_attention,
      'overdue_scheme_items',v_overdue_scheme,'reflection_gaps_7d',v_reflection_gap,
      'evaluated_interventions',v_evaluated_interventions,
      'mean_intervention_mastery_change',v_mean_intervention_gain
    ),
    'context',jsonb_build_object(
      'today_schedule',v_today_schedule,'at_risk_students',v_at_risk_students,
      'homework_due',v_homework_due,'unread_threads',v_unread_threads,
      'attendance_streak',v_attendance_streak,'tpad_due',v_tpad_due,
      'tpad_days',v_tpad_days,'credit_balance',v_credit_balance
    ),
    'decision',jsonb_build_object(
      'now',v_now_action,'next',v_next,'later',v_later,
      'rule','active_teaching_then_upcoming_lesson_then_attendance_then_marking_then_intervention_then_student_twin_signal_then_curriculum_then_reflection_then_admin_deadline'
    ),
    'memory',jsonb_build_object('claims',v_memory,'rule','evidence_derived_teacher_workflow_memory_scoped_by_school'),
    'guardrails',jsonb_build_object(
      'ai_is_not_authority',true,
      'must_not_invent_evidence',true,
      'must_not_override_teacher_records',true,
      'must_use_authenticated_context',true,
      'school_scope_required',true
    )
  );

  insert into public.teacher_twin_state_snapshots(
    teacher_id,school_id,state,confidence_score,evidence_count,generated_at,updated_at
  )
  values(v_uid,p_school_id,v_state,v_conf,v_evidence,v_now,v_now)
  on conflict(teacher_id,school_id) do update set
    state = excluded.state,
    confidence_score = excluded.confidence_score,
    evidence_count = excluded.evidence_count,
    generated_at = excluded.generated_at,
    updated_at = excluded.updated_at;

  return v_state;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Explicit school-scoped tutor context (kept for future optional skills).
-- ---------------------------------------------------------------------------

create or replace function public.teacher_get_twin_tutor_context(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_brain jsonb;
begin
  v_brain := public.teacher_get_twin_brain(p_school_id);
  return jsonb_build_object(
    'teacher_id',v_brain->'teacher_id',
    'school_id',v_brain->'school_id',
    'generated_at',v_brain->'generated_at',
    'confidence',v_brain->'confidence',
    'decision',v_brain->'decision',
    'evidence',v_brain->'evidence',
    'context',v_brain->'context',
    'memory',v_brain->'memory',
    'guardrails',v_brain->'guardrails'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Backward-compatible zero-argument wrappers fail closed on ambiguity.
-- ---------------------------------------------------------------------------

create or replace function public.teacher_refresh_twin_memory()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_schools uuid[];
  v_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select array_agg(sm.school_id order by sm.school_id)
    into v_schools
  from public.school_members sm
  where sm.profile_id = v_uid and sm.role = 'teacher';
  v_count := coalesce(array_length(v_schools,1),0);
  if v_count = 0 then raise exception 'teacher_identity_not_found'; end if;
  if v_count > 1 then raise exception 'teacher_school_scope_required'; end if;
  return public.teacher_refresh_twin_memory(v_schools[1]);
end;
$$;

create or replace function public.teacher_get_twin_brain()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_schools uuid[];
  v_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select array_agg(sm.school_id order by sm.school_id)
    into v_schools
  from public.school_members sm
  where sm.profile_id = v_uid and sm.role = 'teacher';
  v_count := coalesce(array_length(v_schools,1),0);
  if v_count = 0 then raise exception 'teacher_identity_not_found'; end if;
  if v_count > 1 then raise exception 'teacher_school_scope_required'; end if;
  return public.teacher_get_twin_brain(v_schools[1]);
end;
$$;

create or replace function public.teacher_get_twin_tutor_context()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_schools uuid[];
  v_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select array_agg(sm.school_id order by sm.school_id)
    into v_schools
  from public.school_members sm
  where sm.profile_id = v_uid and sm.role = 'teacher';
  v_count := coalesce(array_length(v_schools,1),0);
  if v_count = 0 then raise exception 'teacher_identity_not_found'; end if;
  if v_count > 1 then raise exception 'teacher_school_scope_required'; end if;
  return public.teacher_get_twin_tutor_context(v_schools[1]);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Explicit execution boundary for both overloads and compatibility wrappers.
-- ---------------------------------------------------------------------------

revoke all on function public.teacher_refresh_twin_memory(uuid) from public, anon;
revoke all on function public.teacher_get_twin_brain(uuid) from public, anon;
revoke all on function public.teacher_get_twin_tutor_context(uuid) from public, anon;
revoke all on function public.teacher_refresh_twin_memory() from public, anon;
revoke all on function public.teacher_get_twin_brain() from public, anon;
revoke all on function public.teacher_get_twin_tutor_context() from public, anon;

grant execute on function public.teacher_refresh_twin_memory(uuid) to authenticated, service_role;
grant execute on function public.teacher_get_twin_brain(uuid) to authenticated, service_role;
grant execute on function public.teacher_get_twin_tutor_context(uuid) to authenticated, service_role;
grant execute on function public.teacher_refresh_twin_memory() to authenticated, service_role;
grant execute on function public.teacher_get_twin_brain() to authenticated, service_role;
grant execute on function public.teacher_get_twin_tutor_context() to authenticated, service_role;
