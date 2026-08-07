create table if not exists public.student_twin_state_snapshots (
  student_id uuid primary key references public.students(id) on delete cascade,
  state_version integer not null default 1,
  state jsonb not null default '{}'::jsonb,
  confidence_score numeric not null default 0 check (confidence_score between 0 and 1),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_twin_state_snapshots enable row level security;

drop policy if exists student_twin_state_select_own on public.student_twin_state_snapshots;
create policy student_twin_state_select_own on public.student_twin_state_snapshots
for select to authenticated
using (exists (select 1 from public.students s where s.id=student_twin_state_snapshots.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null));

create index if not exists idx_student_twin_state_generated_at on public.student_twin_state_snapshots(generated_at desc);

create table if not exists public.student_twin_calibration_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid null references public.subjects(id) on delete set null,
  outcome_id uuid null references public.curriculum_learning_outcomes(id) on delete set null,
  prediction_type text not null,
  predicted_value numeric null,
  actual_value numeric null,
  confidence_score numeric not null default 0 check (confidence_score between 0 and 1),
  absolute_error numeric null,
  source_type text not null,
  source_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  predicted_at timestamptz not null default now(),
  resolved_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.student_twin_calibration_events enable row level security;

drop policy if exists student_twin_calibration_select_own on public.student_twin_calibration_events;
create policy student_twin_calibration_select_own on public.student_twin_calibration_events
for select to authenticated
using (exists (select 1 from public.students s where s.id=student_twin_calibration_events.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null));

create index if not exists idx_student_twin_calibration_student_time on public.student_twin_calibration_events(student_id, predicted_at desc);
create index if not exists idx_student_twin_calibration_outcome on public.student_twin_calibration_events(student_id, outcome_id) where outcome_id is not null;

create or replace function public.student_get_twin_state()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_student public.students%rowtype;
  v_home public.student_home_state%rowtype;
  v_tasks jsonb := '[]'::jsonb;
  v_task_counts jsonb := '{}'::jsonb;
  v_mastery jsonb := '[]'::jsonb;
  v_subject_mastery jsonb := '[]'::jsonb;
  v_interventions jsonb := '[]'::jsonb;
  v_recommendations jsonb := '[]'::jsonb;
  v_streak jsonb := '{}'::jsonb;
  v_exam jsonb := '{}'::jsonb;
  v_curriculum jsonb := '{}'::jsonb;
  v_evidence jsonb := '{}'::jsonb;
  v_decision jsonb := '{}'::jsonb;
  v_prediction jsonb := '{}'::jsonb;
  v_tutor jsonb := '{}'::jsonb;
  v_state jsonb := '{}'::jsonb;
  v_evidence_count integer := 0;
  v_mastery_count integer := 0;
  v_confidence numeric := 0;
  v_avg_mastery numeric := null;
  v_days_since_evidence numeric := null;
  v_forgetting_risk numeric := 0;
  v_now_task jsonb := null;
  v_next_tasks jsonb := '[]'::jsonb;
  v_later_tasks jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_student from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if not found then raise exception 'learner_identity_not_found'; end if;

  insert into public.student_home_state(student_id) values(v_student.id) on conflict(student_id) do nothing;
  select * into v_home from public.student_home_state where student_id=v_student.id;

  select coalesce(x->'tasks','[]'::jsonb), coalesce(x->'counts','{}'::jsonb)
  into v_tasks,v_task_counts from (select public.student_list_my_tasks() x) q;

  select coalesce(jsonb_agg(jsonb_build_object(
    'outcome_id',som.outcome_id,'outcome_code',clo.outcome_code,'outcome_text',clo.outcome_text,
    'mastery_level',som.mastery_level,'mastery_score',som.mastery_score,'evidence_count',som.evidence_count,
    'last_evidence_at',som.last_evidence_at,'confidence',least(1,greatest(0,som.evidence_count/5.0))
  ) order by coalesce(som.mastery_score,0) asc, som.last_evidence_at asc nulls first),'[]'::jsonb), count(*), avg(som.mastery_score),
  extract(epoch from (now()-max(som.last_evidence_at)))/86400.0
  into v_mastery,v_mastery_count,v_avg_mastery,v_days_since_evidence
  from public.student_outcome_mastery som
  join public.curriculum_learning_outcomes clo on clo.id=som.outcome_id
  where som.student_id=v_student.id and clo.status in ('active','verified');

  select coalesce(jsonb_agg(jsonb_build_object(
    'subject_id',ssp.subject_id,'subject_name',s.name,'completed_tasks',ssp.completed_tasks,'total_tasks',ssp.total_tasks,
    'average_score',ssp.average_score,'mastery_percentage',ssp.mastery_percentage,
    'confidence',least(1,greatest(0,ssp.total_tasks/8.0))
  ) order by coalesce(ssp.mastery_percentage,ssp.average_score,0) asc),'[]'::jsonb)
  into v_subject_mastery
  from public.student_subject_progress ssp join public.subjects s on s.id=ssp.subject_id
  where ssp.student_id=v_student.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ai.id,'subject_id',ai.subject_id,'outcome_id',ai.outcome_id,'priority',ai.priority,
    'recommendation_type',ai.recommendation_type,'recommendation',ai.recommendation,
    'mastery_score',ai.mastery_score,'evidence_count',ai.evidence_count,'confidence',ai.confidence_score,'due_at',ai.due_at
  ) order by case ai.priority when 'urgent' then 0 when 'high' then 1 else 2 end, ai.due_at nulls last),'[]'::jsonb)
  into v_interventions from public.assessment_interventions ai
  where ai.student_id=v_student.id and ai.status in ('open','active','planned');

  perform public.student_refresh_personalized_path();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'subject_id',r.subject_id,'outcome_id',r.outcome_id,'type',r.recommendation_type,'title',r.title,
    'reason',r.reason,'confidence',r.confidence_score,'priority',r.priority_score,'next_review_at',r.next_review_at
  ) order by r.priority_score desc),'[]'::jsonb)
  into v_recommendations from public.student_learning_recommendations r where r.student_id=v_student.id and r.status='active';

  select jsonb_build_object('current',coalesce(s.current_streak,0),'longest',coalesce(s.longest_streak,0),'last_active_date',s.last_active_date,'grace_tokens',coalesce(s.grace_tokens,0))
  into v_streak from public.student_learning_streaks s where s.student_id=v_student.id;
  v_streak := coalesce(v_streak,jsonb_build_object('current',0,'longest',0,'last_active_date',null,'grace_tokens',0));

  select jsonb_build_object(
    'exam_name',r.exam_name,'exam_date',r.exam_date,
    'days_remaining',case when r.exam_date is null then null else greatest(r.exam_date-current_date,0) end,
    'daily_revision_minutes',r.daily_revision_minutes,'confidence_check',r.confidence_check,
    'target_grade',v_home.kcse_target_grade
  ) into v_exam from public.student_exam_readiness_state r where r.student_id in (v_student.id,v_uid)
  order by case when r.student_id=v_student.id then 0 else 1 end limit 1;
  v_exam := coalesce(v_exam,jsonb_build_object('exam_name','KCSE','exam_date',null,'days_remaining',null,'daily_revision_minutes',90,'confidence_check',null,'target_grade',v_home.kcse_target_grade));

  select jsonb_build_object(
    'current_class_id',sc.class_id,'current_class_name',c.name,'school_id',sc.school_id,
    'known_outcomes',v_mastery_count,'lowest_mastery',case when jsonb_array_length(v_mastery)>0 then v_mastery->0 else null end
  ) into v_curriculum
  from public.student_classes sc join public.classes c on c.id=sc.class_id
  where sc.student_id=v_student.id and sc.is_current=true order by sc.joined_at desc limit 1;
  v_curriculum := coalesce(v_curriculum,jsonb_build_object('current_class_id',v_student.class_id,'current_class_name',null,'school_id',null,'known_outcomes',v_mastery_count,'lowest_mastery',case when jsonb_array_length(v_mastery)>0 then v_mastery->0 else null end));

  select count(*) into v_evidence_count from public.competency_evidence_ledger e where e.student_id=v_student.id;
  select jsonb_build_object(
    'competency_evidence_count',v_evidence_count,
    'learning_event_count',(select count(*) from public.student_learning_events e where e.student_id=v_student.id),
    'task_receipt_count',(select count(*) from public.student_task_execution_receipts r where r.student_id=v_student.id),
    'latest_evidence_at',(select max(e.observed_at) from public.competency_evidence_ledger e where e.student_id=v_student.id),
    'calibration_count',(select count(*) from public.student_twin_calibration_events ce where ce.student_id=v_student.id and ce.resolved_at is not null),
    'mean_absolute_error',(select round(avg(ce.absolute_error)::numeric,3) from public.student_twin_calibration_events ce where ce.student_id=v_student.id and ce.resolved_at is not null and ce.absolute_error is not null)
  ) into v_evidence;

  v_confidence := least(1,greatest(0, (least(v_evidence_count,20)/20.0)*0.6 + (least(v_mastery_count,10)/10.0)*0.4));
  v_forgetting_risk := least(1,greatest(0,coalesce(v_days_since_evidence,30)/30.0 * case when coalesce(v_avg_mastery,0)>=70 then 0.7 else 1 end));
  v_prediction := jsonb_build_object(
    'average_mastery',case when v_avg_mastery is null then null else round(v_avg_mastery,1) end,
    'forgetting_risk',round(v_forgetting_risk,3),
    'confidence',round(v_confidence,3),
    'basis','deterministic_evidence_recency',
    'disclaimer','Projection is based only on available Vibeschool evidence and is not an official examination prediction.'
  );

  select value into v_now_task from jsonb_array_elements(v_tasks) value
  where coalesce(value->>'status','') in ('overdue','returned','in_progress','ready')
  order by case value->>'status' when 'overdue' then 0 when 'returned' then 1 when 'in_progress' then 2 else 3 end,
           case value->>'priority' when 'urgent' then 0 when 'high' then 1 else 2 end,
           nullif(value->>'due_at','')::timestamptz nulls last limit 1;

  select coalesce(jsonb_agg(value),'[]'::jsonb) into v_next_tasks from (
    select value from jsonb_array_elements(v_tasks) value
    where coalesce(value->>'status','') in ('overdue','returned','in_progress','ready','upcoming')
      and (v_now_task is null or value->>'task_id'<>v_now_task->>'task_id')
    order by case value->>'status' when 'overdue' then 0 when 'returned' then 1 when 'in_progress' then 2 when 'ready' then 3 else 4 end,
             nullif(value->>'due_at','')::timestamptz nulls last limit 3
  ) q;
  select coalesce(jsonb_agg(value),'[]'::jsonb) into v_later_tasks from (
    select value from jsonb_array_elements(v_tasks) value
    where coalesce(value->>'status','') in ('ready','upcoming')
      and (v_now_task is null or value->>'task_id'<>v_now_task->>'task_id')
    order by nullif(value->>'due_at','')::timestamptz nulls last limit 6
  ) q;
  v_decision := jsonb_build_object('now',v_now_task,'next',v_next_tasks,'later',v_later_tasks,'rule','deadline_then_revision_then_resume_then_ready');

  v_tutor := jsonb_build_object(
    'mode','bounded',
    'can_explain',true,'can_question',true,'can_hint',true,'can_generate_practice',true,
    'cannot_change_marks',true,'cannot_mark_verified_completion',true,'cannot_override_teacher_interventions',true,
    'context',jsonb_build_object('weak_outcomes',v_mastery,'recommendations',v_recommendations,'current_decision',v_decision)
  );

  v_state := jsonb_build_object(
    'ok',true,'version',1,'student_id',v_student.id,'profile_id',v_uid,'generated_at',now(),
    'curriculum',v_curriculum,'mastery',jsonb_build_object('outcomes',v_mastery,'subjects',v_subject_mastery),
    'obligations',jsonb_build_object('tasks',v_tasks,'counts',v_task_counts),'interventions',v_interventions,
    'streak',v_streak,'study_time',jsonb_build_object('weekly_minutes',v_home.weekly_study_minutes,'session_minutes',v_home.preferred_session_minutes,'preferred_time',v_home.preferred_study_time),
    'exam',v_exam,'evidence',v_evidence,'prediction',v_prediction,'recommendations',v_recommendations,'decision',v_decision,'tutor',v_tutor,
    'confidence',round(v_confidence,3)
  );

  insert into public.student_twin_state_snapshots(student_id,state_version,state,confidence_score,evidence_count,generated_at,updated_at)
  values(v_student.id,1,v_state,v_confidence,v_evidence_count,now(),now())
  on conflict(student_id) do update set state_version=excluded.state_version,state=excluded.state,confidence_score=excluded.confidence_score,evidence_count=excluded.evidence_count,generated_at=excluded.generated_at,updated_at=now();

  return v_state;
end;
$function$;

create or replace function public.student_get_twin_tutor_context()
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_state jsonb;
begin
  v_state:=public.student_get_twin_state();
  return jsonb_build_object('student_id',v_state->'student_id','generated_at',v_state->'generated_at','confidence',v_state->'confidence','curriculum',v_state->'curriculum','mastery',v_state->'mastery','interventions',v_state->'interventions','recommendations',v_state->'recommendations','decision',v_state->'decision','prediction',v_state->'prediction','guardrails',v_state->'tutor');
end;
$function$;

create or replace function public.student_record_twin_calibration(
  p_prediction_type text,p_predicted_value numeric,p_actual_value numeric,p_confidence_score numeric,
  p_subject_id uuid default null,p_outcome_id uuid default null,p_source_type text default 'system',p_source_id uuid default null,p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_uid uuid:=auth.uid(); v_student_id uuid; v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  if p_prediction_type not in ('mastery','assessment_score','forgetting_risk','readiness') then raise exception 'unsupported_prediction_type'; end if;
  if p_confidence_score<0 or p_confidence_score>1 then raise exception 'invalid_confidence_score'; end if;
  insert into public.student_twin_calibration_events(student_id,subject_id,outcome_id,prediction_type,predicted_value,actual_value,confidence_score,absolute_error,source_type,source_id,metadata,resolved_at)
  values(v_student_id,p_subject_id,p_outcome_id,p_prediction_type,p_predicted_value,p_actual_value,p_confidence_score,case when p_actual_value is null or p_predicted_value is null then null else abs(p_actual_value-p_predicted_value) end,p_source_type,p_source_id,coalesce(p_metadata,'{}'::jsonb),case when p_actual_value is null then null else now() end)
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end;
$function$;

revoke all on function public.student_get_twin_state() from public, anon;
revoke all on function public.student_get_twin_tutor_context() from public, anon;
revoke all on function public.student_record_twin_calibration(text,numeric,numeric,numeric,uuid,uuid,text,uuid,jsonb) from public, anon;
grant execute on function public.student_get_twin_state() to authenticated, service_role;
grant execute on function public.student_get_twin_tutor_context() to authenticated, service_role;
grant execute on function public.student_record_twin_calibration(text,numeric,numeric,numeric,uuid,uuid,text,uuid,jsonb) to authenticated, service_role;
