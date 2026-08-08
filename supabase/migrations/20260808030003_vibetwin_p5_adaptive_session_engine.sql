create table if not exists public.student_adaptive_learning_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  focus_outcome_id uuid references public.curriculum_learning_outcomes(id) on delete set null,
  mode text not null default 'practice' check (mode in ('explain','practice','homework','revision','exam','challenge')),
  recommended_pace text not null check (recommended_pace in ('gentle','steady','fast')),
  chosen_pace text not null check (chosen_pace in ('gentle','steady','fast')),
  planned_minutes integer not null check (planned_minutes between 5 and 180),
  reason text not null,
  status text not null default 'planned' check (status in ('planned','active','completed','abandoned')),
  mastery_before numeric,
  mastery_after numeric,
  forgetting_risk_before numeric,
  forgetting_risk_after numeric,
  evidence_count_before integer not null default 0,
  evidence_count_after integer,
  plan jsonb not null default '{}'::jsonb,
  reflection text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_adaptive_learning_sessions_student_created_idx
  on public.student_adaptive_learning_sessions(student_id, created_at desc);
create index if not exists student_adaptive_learning_sessions_focus_idx
  on public.student_adaptive_learning_sessions(focus_outcome_id)
  where focus_outcome_id is not null;

alter table public.student_adaptive_learning_sessions enable row level security;
revoke all on table public.student_adaptive_learning_sessions from anon, authenticated;

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

  select s.id into v_student_id
  from public.students s
  where s.profile_id=v_uid and s.deleted_at is null
  limit 1;
  if v_student_id is null then raise exception 'Learner identity not found'; end if;

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
  v_minutes := case v_chosen
    when 'gentle' then greatest(10, round(v_base_minutes * 0.90)::integer)
    when 'fast' then greatest(10, round(v_base_minutes * 0.75)::integer)
    else v_base_minutes
  end;

  update public.student_adaptive_learning_sessions
  set status='abandoned', updated_at=now()
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
    'mastery_before',v_effective,'forgetting_risk_before',v_forgetting,'evidence_count_before',v_evidence
  );
end;
$function$;

create or replace function public.student_start_adaptive_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row public.student_adaptive_learning_sessions%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  update public.student_adaptive_learning_sessions
  set status='active', started_at=coalesce(started_at,now()), updated_at=now()
  where id=p_session_id and profile_id=v_uid and status in ('planned','active')
  returning * into v_row;
  if v_row.id is null then raise exception 'Adaptive session not available'; end if;
  return jsonb_build_object('id',v_row.id,'status',v_row.status,'started_at',v_row.started_at);
end;
$function$;

create or replace function public.student_complete_adaptive_session(
  p_session_id uuid,
  p_reflection text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row public.student_adaptive_learning_sessions%rowtype;
  v_brain jsonb;
  v_item jsonb;
  v_mastery numeric;
  v_forgetting numeric;
  v_evidence integer := 0;
  v_event_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_row from public.student_adaptive_learning_sessions
  where id=p_session_id and profile_id=v_uid and status in ('planned','active')
  for update;
  if v_row.id is null then raise exception 'Adaptive session not available'; end if;

  v_brain := coalesce(public.student_get_twin_brain(),'{}'::jsonb);
  v_evidence := coalesce(nullif(v_brain #>> '{evidence,competency_evidence_count}','')::integer,0);
  if v_row.focus_outcome_id is not null then
    select value into v_item
    from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value
    where value->>'outcome_id'=v_row.focus_outcome_id::text
    limit 1;
  end if;
  v_mastery := coalesce(nullif(v_item->>'effective_mastery','')::numeric,nullif(v_item->>'mastery_score','')::numeric,v_row.mastery_before);
  v_forgetting := coalesce(nullif(v_item->>'forgetting_risk','')::numeric,v_row.forgetting_risk_before);

  update public.student_adaptive_learning_sessions
  set status='completed', completed_at=now(), updated_at=now(), reflection=nullif(left(coalesce(p_reflection,''),1000),''),
      mastery_after=v_mastery, forgetting_risk_after=v_forgetting, evidence_count_after=v_evidence
  where id=v_row.id;

  insert into public.student_learning_events(student_id,event_type,source_type,source_id,xp_awarded,occurred_at,metadata)
  values(v_row.student_id,'adaptive_session_completed','adaptive_session',v_row.id,0,now(),
    jsonb_build_object(
      'low_authority',true,'chosen_pace',v_row.chosen_pace,'recommended_pace',v_row.recommended_pace,
      'planned_minutes',v_row.planned_minutes,'focus_outcome_id',v_row.focus_outcome_id,
      'mastery_before',v_row.mastery_before,'mastery_after',v_mastery,
      'forgetting_risk_before',v_row.forgetting_risk_before,'forgetting_risk_after',v_forgetting,
      'evidence_count_before',v_row.evidence_count_before,'evidence_count_after',v_evidence
    )) returning id into v_event_id;

  return jsonb_build_object(
    'id',v_row.id,'status','completed','mastery_before',v_row.mastery_before,'mastery_after',v_mastery,
    'forgetting_risk_before',v_row.forgetting_risk_before,'forgetting_risk_after',v_forgetting,
    'evidence_count_before',v_row.evidence_count_before,'evidence_count_after',v_evidence,
    'learning_event_id',v_event_id
  );
end;
$function$;

revoke all on function public.student_plan_adaptive_session(text,text) from public, anon;
revoke all on function public.student_start_adaptive_session(uuid) from public, anon;
revoke all on function public.student_complete_adaptive_session(uuid,text) from public, anon;
grant execute on function public.student_plan_adaptive_session(text,text) to authenticated;
grant execute on function public.student_start_adaptive_session(uuid) to authenticated;
grant execute on function public.student_complete_adaptive_session(uuid,text) to authenticated;
