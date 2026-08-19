-- VibeSchool Task 12: pilot SLO / error-budget / freshness measurement kernel.
-- Extends the reconciled Task-12 foundation already present on main.
-- Task 11 remains incident authority; this migration exposes detection evidence only.

begin;

alter table public.pilot_event_contract
  add column if not exists schema_version integer not null default 1,
  add column if not exists event_class text not null default 'observation',
  add column if not exists sensitivity_class text not null default 'pseudonymous',
  add column if not exists owner_key text not null default 'engineering';

alter table public.pilot_event_contract drop constraint if exists pilot_event_contract_schema_version_check;
alter table public.pilot_event_contract add constraint pilot_event_contract_schema_version_check
  check (schema_version between 1 and 1000) not valid;

alter table public.pilot_event_contract drop constraint if exists pilot_event_contract_event_class_check;
alter table public.pilot_event_contract add constraint pilot_event_contract_event_class_check
  check (event_class in ('journey_started','journey_completed','journey_failed','action_started','action_completed','action_failed','authoritative_commit','performance_measurement','security_denial','system_degradation','observation')) not valid;

alter table public.pilot_event_contract drop constraint if exists pilot_event_contract_sensitivity_check;
alter table public.pilot_event_contract add constraint pilot_event_contract_sensitivity_check
  check (sensitivity_class in ('non_sensitive','pseudonymous','personal','sensitive_child','prohibited')) not valid;

insert into public.pilot_event_contract
  (event_name, journey, stage, success_semantics, authoritative_required, allowed_roles, metadata_keys, activation_role, schema_version, event_class, sensitivity_class, owner_key)
values
  ('teacher.useful_action_started','teacher','action_started','Teacher began a meaningful classroom operation',false,array['teacher'],array['action_type'],null,1,'action_started','pseudonymous','teacher'),
  ('student.learning_activity_started','student','activity_started','Student began a meaningful learning activity',false,array['student'],array['activity_type'],null,1,'action_started','pseudonymous','student'),
  ('parent.child_insight_requested','parent','insight_requested','Verified parent requested a permitted child-support view',false,array['parent'],array['insight_type'],null,1,'action_started','pseudonymous','parent'),
  ('admin.school_operation_started','admin','operation_started','School administrator began an operational action',false,array['admin'],array['operation_type'],null,1,'action_started','pseudonymous','admin'),
  ('homework.submit_attempted','homework','submission_attempt','Student attempted a valid homework submission',false,array['student'],array['submission_type'],null,1,'action_started','pseudonymous','student'),
  ('homework.submit_committed','homework','submission_commit','Homework submission durably committed',true,array['student'],array['submission_type'],null,1,'authoritative_commit','sensitive_child','student'),
  ('homework.submit_failed','homework','submission_failure','Homework submission failed before durable commit',true,array['student'],array['submission_type'],null,1,'action_failed','sensitive_child','student'),
  ('assessment.submit_attempted','assessment','submission_attempt','Student attempted a valid assessment submission',false,array['student'],array['assessment_type'],null,1,'action_started','pseudonymous','student')
on conflict (event_name) do update set
  journey = excluded.journey,
  stage = excluded.stage,
  success_semantics = excluded.success_semantics,
  authoritative_required = excluded.authoritative_required,
  allowed_roles = excluded.allowed_roles,
  metadata_keys = excluded.metadata_keys,
  activation_role = excluded.activation_role,
  schema_version = excluded.schema_version,
  event_class = excluded.event_class,
  sensitivity_class = excluded.sensitivity_class,
  owner_key = excluded.owner_key,
  updated_at = now(),
  active = true;

update public.pilot_event_contract set
  schema_version = 1,
  event_class = case
    when authoritative_required then 'authoritative_commit'
    when event_name like '%.%failed%' or event_name like '%.render_failed' then 'action_failed'
    when event_name like 'security.%' then 'security_denial'
    when event_name like '%.%started' or event_name like '%.content_requested' then 'action_started'
    when event_name like '%.%committed' or event_name like '%.%resolved' or event_name like '%.%reached' or event_name like '%.content_opened' then 'action_completed'
    else event_class
  end,
  sensitivity_class = case
    when journey in ('student','parent','homework','assessment') then 'sensitive_child'
    else sensitivity_class
  end,
  owner_key = case
    when journey in ('teacher','student','parent','admin','vibelearn','homework','assessment','payments','worker_engine','security') then journey
    else owner_key
  end,
  updated_at = now();

-- access: owner-only public.pilot_slo_contract
-- authorization-test: public.pilot_slo_contract
create table if not exists public.pilot_slo_contract (
  slo_key text primary key,
  journey text not null unique,
  attempt_event_name text not null,
  success_event_name text not null,
  target_percent numeric(5,2) not null check (target_percent >= 50 and target_percent <= 100),
  window_minutes integer not null check (window_minutes between 5 and 43200),
  freshness_minutes integer not null check (freshness_minutes between 5 and 10080),
  min_observations integer not null default 20 check (min_observations between 1 and 1000000),
  owner_key text not null,
  severity_when_degraded text not null default 'P1' check (severity_when_degraded in ('P0','P1','P2')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pilot_slo_contract enable row level security;
revoke all on public.pilot_slo_contract from public, anon, authenticated;

insert into public.pilot_slo_contract
  (slo_key,journey,attempt_event_name,success_event_name,target_percent,window_minutes,freshness_minutes,min_observations,owner_key,severity_when_degraded)
values
  ('auth.workspace_entry','authentication','auth.login_started','auth.dashboard_reached',98.00,10080,1440,20,'authentication','P1'),
  ('teacher.useful_action','teacher','teacher.useful_action_started','teacher.useful_action_committed',97.00,10080,1440,20,'teacher','P1'),
  ('student.learning_commit','student','student.learning_activity_started','student.learning_activity_committed',97.00,10080,1440,20,'student','P1'),
  ('parent.child_support','parent','parent.child_insight_requested','parent.child_insight_viewed',97.00,10080,1440,10,'parent','P1'),
  ('admin.school_operation','admin','admin.school_operation_started','admin.school_operation_committed',97.00,10080,1440,10,'admin','P1'),
  ('vibelearn.content_open','vibelearn','vibelearn.content_requested','vibelearn.content_opened',98.00,10080,1440,20,'vibelearn','P1'),
  ('homework.submission','homework','homework.submit_attempted','homework.submit_committed',98.00,10080,1440,20,'homework','P1'),
  ('assessment.submission','assessment','assessment.submit_attempted','assessment.submit_committed',99.00,10080,1440,20,'assessment','P1')
on conflict (slo_key) do update set
  journey=excluded.journey,
  attempt_event_name=excluded.attempt_event_name,
  success_event_name=excluded.success_event_name,
  target_percent=excluded.target_percent,
  window_minutes=excluded.window_minutes,
  freshness_minutes=excluded.freshness_minutes,
  min_observations=excluded.min_observations,
  owner_key=excluded.owner_key,
  severity_when_degraded=excluded.severity_when_degraded,
  updated_at=now(),
  active=true;

create or replace function public.hq_get_pilot_slo_scorecard(p_as_of timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_platform_owner() then
    raise exception 'HQ_OWNER_REQUIRED' using errcode='42501';
  end if;

  with definitions as (
    select * from public.pilot_slo_contract where active=true
  ), measurements as (
    select
      d.slo_key,
      d.journey,
      d.target_percent,
      d.window_minutes,
      d.freshness_minutes,
      d.min_observations,
      d.owner_key,
      d.severity_when_degraded,
      count(e.id) filter (where e.event_type=d.attempt_event_name) as attempts,
      count(e.id) filter (where e.event_type=d.success_event_name and e.outcome='succeeded') as successes,
      max(e.occurred_at) filter (where e.event_type in (d.attempt_event_name,d.success_event_name)) as freshest_event_at,
      percentile_cont(0.95) within group (order by e.latency_ms)
        filter (where e.event_type=d.success_event_name and e.latency_ms is not null) as p95_latency_ms
    from definitions d
    left join public.platform_events e
      on e.occurred_at >= p_as_of - make_interval(mins => d.window_minutes)
     and e.occurred_at <= p_as_of
     and e.event_type in (d.attempt_event_name,d.success_event_name)
    group by d.slo_key,d.journey,d.target_percent,d.window_minutes,d.freshness_minutes,d.min_observations,d.owner_key,d.severity_when_degraded
  ), normalized as (
    select *,
      greatest(attempts-successes,0) as failures,
      case when attempts=0 then null else round(100.0*successes/attempts,2) end as success_rate,
      floor(attempts*((100-target_percent)/100.0))::bigint as allowed_failures,
      case
        when attempts=0 then 'UNKNOWN'
        when freshest_event_at is null then 'UNKNOWN'
        when freshest_event_at < p_as_of - make_interval(mins => freshness_minutes) then 'UNKNOWN'
        when attempts < min_observations then 'UNKNOWN'
        when successes > attempts then 'DEGRADED'
        when (100.0*successes/attempts) >= target_percent then 'HEALTHY'
        when (100.0*successes/attempts) >= greatest(target_percent-2,0) then 'ATTENTION'
        else 'DEGRADED'
      end as status,
      case
        when successes > attempts then 'SUCCESS_COUNT_EXCEEDS_ATTEMPTS'
        when attempts=0 then 'NO_OBSERVATIONS'
        when attempts < min_observations then 'LOW_SAMPLE'
        when freshest_event_at < p_as_of - make_interval(mins => freshness_minutes) then 'STALE'
        else 'OK'
      end as evidence_state
    from measurements
  )
  select jsonb_build_object(
    'generated_at', p_as_of,
    'status_semantics', jsonb_build_object(
      'HEALTHY','observed volume meets minimum, data is fresh, and SLO target is met',
      'ATTENTION','observed volume meets minimum but target is narrowly missed',
      'DEGRADED','observed volume meets minimum and target is materially missed or event integrity is invalid',
      'UNKNOWN','no observations, low sample, or stale evidence; never interpreted as healthy'
    ),
    'slos', coalesce(jsonb_agg(jsonb_build_object(
      'slo_key',slo_key,
      'journey',journey,
      'owner',owner_key,
      'status',status,
      'evidence_state',evidence_state,
      'attempts',attempts,
      'successes',successes,
      'failures',failures,
      'success_rate_percent',success_rate,
      'target_percent',target_percent,
      'min_observations',min_observations,
      'freshest_event_at',freshest_event_at,
      'p95_latency_ms',p95_latency_ms,
      'error_budget',jsonb_build_object(
        'allowed_failures',allowed_failures,
        'consumed_failures',failures,
        'remaining_failures',greatest(allowed_failures-failures,0)
      ),
      'severity_when_degraded',severity_when_degraded
    ) order by slo_key),'[]'::jsonb)
  ) into v_result
  from normalized;

  return v_result;
end;
$$;

revoke all on function public.hq_get_pilot_slo_scorecard(timestamptz) from public, anon, authenticated;
grant execute on function public.hq_get_pilot_slo_scorecard(timestamptz) to authenticated;

create or replace function public.hq_get_pilot_alert_candidates(p_as_of timestamptz default now())
returns table(
  alert_fingerprint text,
  slo_key text,
  journey text,
  severity text,
  status text,
  evidence_state text,
  attempts bigint,
  successes bigint,
  failure_count bigint,
  target_percent numeric,
  success_rate_percent numeric,
  freshest_event_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_platform_owner() then
    raise exception 'HQ_OWNER_REQUIRED' using errcode='42501';
  end if;

  return query
  with d as (
    select * from public.pilot_slo_contract where active=true
  ), m as (
    select
      d.slo_key,
      d.journey,
      d.target_percent,
      d.window_minutes,
      d.freshness_minutes,
      d.min_observations,
      d.severity_when_degraded,
      count(e.id) filter (where e.event_type=d.attempt_event_name) as attempts,
      count(e.id) filter (where e.event_type=d.success_event_name and e.outcome='succeeded') as successes,
      max(e.occurred_at) filter (where e.event_type in (d.attempt_event_name,d.success_event_name)) as freshest_event_at
    from d
    left join public.platform_events e
      on e.occurred_at >= p_as_of - make_interval(mins => d.window_minutes)
     and e.occurred_at <= p_as_of
     and e.event_type in (d.attempt_event_name,d.success_event_name)
    group by d.slo_key,d.journey,d.target_percent,d.window_minutes,d.freshness_minutes,d.min_observations,d.severity_when_degraded
  ), s as (
    select *,
      greatest(attempts-successes,0) as failures,
      case when attempts=0 then null else round(100.0*successes/attempts,2) end as success_rate,
      case
        when attempts=0 or freshest_event_at is null then 'UNKNOWN'
        when freshest_event_at < p_as_of - make_interval(mins => freshness_minutes) then 'UNKNOWN'
        when attempts < min_observations then 'UNKNOWN'
        when successes > attempts then 'DEGRADED'
        when (100.0*successes/attempts) >= target_percent then 'HEALTHY'
        when (100.0*successes/attempts) >= greatest(target_percent-2,0) then 'ATTENTION'
        else 'DEGRADED'
      end as state,
      case
        when successes > attempts then 'SUCCESS_COUNT_EXCEEDS_ATTEMPTS'
        when attempts=0 then 'NO_OBSERVATIONS'
        when attempts < min_observations then 'LOW_SAMPLE'
        when freshest_event_at < p_as_of - make_interval(mins => freshness_minutes) then 'STALE'
        else 'OK'
      end as evidence
    from m
  )
  select
    md5('task12:slo:'||s.slo_key||':'||s.state||':'||s.evidence),
    s.slo_key,
    s.journey,
    case when s.state='DEGRADED' then s.severity_when_degraded else 'P2' end,
    s.state,
    s.evidence,
    s.attempts,
    s.successes,
    s.failures,
    s.target_percent,
    s.success_rate,
    s.freshest_event_at
  from s
  where s.state in ('DEGRADED','UNKNOWN');
end;
$$;

revoke all on function public.hq_get_pilot_alert_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.hq_get_pilot_alert_candidates(timestamptz) to authenticated;

comment on table public.pilot_slo_contract is 'Task 12 internal pilot SLI/SLO registry. No direct anon/authenticated read; owner scorecard RPC is the read boundary.';
comment on function public.hq_get_pilot_slo_scorecard(timestamptz) is 'Owner-only Task 12 SLO/error-budget/freshness scorecard. Zero, low-volume, and stale evidence produce UNKNOWN.';
comment on function public.hq_get_pilot_alert_candidates(timestamptz) is 'Owner-only Task 12 detection candidates for Task 11 incident handoff. Does not create or mutate incidents.';

commit;