-- VibeSchool Task 12 post-merge production certification closure.
-- Closes explicit event receipt/environment/schema identity and bounded client-ingress gaps.
-- Domain authority remains outside telemetry; Task 11 remains incident authority.

begin;

alter table public.platform_events
  add column if not exists received_at timestamptz,
  add column if not exists environment text,
  add column if not exists event_schema_version integer;

update public.platform_events
set received_at = coalesce(received_at, occurred_at, now()),
    environment = coalesce(environment, 'production'),
    event_schema_version = coalesce(event_schema_version, 1)
where received_at is null or environment is null or event_schema_version is null;

alter table public.platform_events
  alter column received_at set default now(),
  alter column received_at set not null,
  alter column environment set default 'production',
  alter column environment set not null,
  alter column event_schema_version set default 1,
  alter column event_schema_version set not null;

alter table public.platform_events drop constraint if exists platform_events_environment_check;
alter table public.platform_events add constraint platform_events_environment_check
  check (environment in ('production','preview','development','test','synthetic')) not valid;

alter table public.platform_events drop constraint if exists platform_events_event_schema_version_check;
alter table public.platform_events add constraint platform_events_event_schema_version_check
  check (event_schema_version between 1 and 1000) not valid;

create index if not exists platform_events_environment_time_idx
  on public.platform_events (environment, occurred_at desc);
create index if not exists platform_events_client_actor_received_idx
  on public.platform_events (actor_id, received_at desc)
  where source = 'client' and actor_id is not null;

create or replace function public.pilot_record_event(
  p_event_name text, p_surface text, p_outcome text, p_correlation_id uuid default null, p_session_id uuid default null,
  p_entity_type text default 'application', p_entity_id uuid default null, p_school_id uuid default null,
  p_failure_class text default null, p_error_code text default null, p_latency_ms integer default null,
  p_network_class text default null, p_app_version text default null, p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_contract public.pilot_event_contract%rowtype;
  v_role text;
  v_school_id uuid;
  v_id uuid;
  v_metadata jsonb;
  v_recent_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select role::text, school_id into v_role, v_school_id from public.profiles where id=v_uid;
  if v_role is null then raise exception 'ROLE_NOT_RESOLVED' using errcode='42501'; end if;
  select * into v_contract from public.pilot_event_contract where event_name=p_event_name and active=true;
  if not found then raise exception 'UNKNOWN_EVENT_NAME' using errcode='22023'; end if;
  if v_contract.authoritative_required then raise exception 'AUTHORITATIVE_EVENT_REQUIRES_BACKEND' using errcode='42501'; end if;
  if cardinality(v_contract.allowed_roles)>0 and not (v_role=any(v_contract.allowed_roles)) then raise exception 'ROLE_NOT_ALLOWED_FOR_EVENT' using errcode='42501'; end if;
  if p_outcome not in ('attempted','succeeded','failed','denied','cancelled') then raise exception 'INVALID_OUTCOME' using errcode='22023'; end if;
  if p_failure_class is not null and p_failure_class not in ('authentication','authorization','identity','database','rpc','network','content','validation','application','external_integration','unknown') then raise exception 'INVALID_FAILURE_CLASS' using errcode='22023'; end if;
  if p_latency_ms is not null and (p_latency_ms<0 or p_latency_ms>3600000) then raise exception 'INVALID_LATENCY' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) <> 'object' then raise exception 'INVALID_METADATA' using errcode='22023'; end if;
  if pg_column_size(coalesce(p_metadata,'{}'::jsonb)) > 8192 then raise exception 'METADATA_TOO_LARGE' using errcode='22023'; end if;
  if p_error_code is not null and length(p_error_code) > 200 then raise exception 'ERROR_CODE_TOO_LARGE' using errcode='22023'; end if;
  if p_idempotency_key is not null and length(p_idempotency_key) > 200 then raise exception 'IDEMPOTENCY_KEY_TOO_LARGE' using errcode='22023'; end if;
  select count(*) into v_recent_count from public.platform_events e where e.actor_id=v_uid and e.source='client' and e.received_at >= now()-interval '1 minute';
  if v_recent_count >= 120 then raise exception 'TELEMETRY_RATE_LIMITED' using errcode='P0001'; end if;
  v_metadata := public.pilot_sanitize_event_metadata(p_metadata,v_contract.metadata_keys);
  insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,occurred_at,received_at,idempotency_key,journey,surface,outcome,failure_class,error_code,latency_ms,correlation_id,session_id,source,authoritative,network_class,app_version,environment,event_schema_version)
  values(p_event_name,v_uid,v_role,v_school_id,'application',null,v_metadata,now(),now(),p_idempotency_key,v_contract.journey,left(coalesce(p_surface,'unknown'),120),p_outcome,p_failure_class,left(p_error_code,80),p_latency_ms,p_correlation_id,p_session_id,'client',false,p_network_class,left(p_app_version,80),'production',v_contract.schema_version)
  on conflict (idempotency_key) where idempotency_key is not null do nothing returning id into v_id;
  if v_id is null and p_idempotency_key is not null then select id into v_id from public.platform_events where idempotency_key=p_idempotency_key and actor_id=v_uid; end if;
  return v_id;
end;
$$;
revoke all on function public.pilot_record_event(text,text,text,uuid,uuid,text,uuid,uuid,text,text,integer,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.pilot_record_event(text,text,text,uuid,uuid,text,uuid,uuid,text,text,integer,text,text,jsonb,text) to authenticated;

create or replace function public.pilot_record_authoritative_event(
  p_event_name text, p_actor_id uuid, p_actor_role text, p_school_id uuid, p_entity_type text, p_entity_id uuid, p_outcome text,
  p_correlation_id uuid default null, p_failure_class text default null, p_error_code text default null, p_latency_ms integer default null,
  p_metadata jsonb default '{}'::jsonb, p_idempotency_key text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_contract public.pilot_event_contract%rowtype; v_id uuid; v_metadata jsonb;
begin
  select * into v_contract from public.pilot_event_contract where event_name=p_event_name and active=true;
  if not found then raise exception 'UNKNOWN_EVENT_NAME' using errcode='22023'; end if;
  if not v_contract.authoritative_required then raise exception 'NON_AUTHORITATIVE_EVENT_NOT_ALLOWED_HERE' using errcode='22023'; end if;
  if p_outcome not in ('attempted','succeeded','failed','denied','cancelled') then raise exception 'INVALID_OUTCOME' using errcode='22023'; end if;
  if p_failure_class is not null and p_failure_class not in ('authentication','authorization','identity','database','rpc','network','content','validation','application','external_integration','unknown') then raise exception 'INVALID_FAILURE_CLASS' using errcode='22023'; end if;
  if p_latency_ms is not null and (p_latency_ms<0 or p_latency_ms>3600000) then raise exception 'INVALID_LATENCY' using errcode='22023'; end if;
  if cardinality(v_contract.allowed_roles)>0 and (p_actor_role is null or not (p_actor_role=any(v_contract.allowed_roles))) then raise exception 'ROLE_NOT_ALLOWED_FOR_EVENT' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) <> 'object' then raise exception 'INVALID_METADATA' using errcode='22023'; end if;
  if pg_column_size(coalesce(p_metadata,'{}'::jsonb)) > 8192 then raise exception 'METADATA_TOO_LARGE' using errcode='22023'; end if;
  if p_error_code is not null and length(p_error_code) > 200 then raise exception 'ERROR_CODE_TOO_LARGE' using errcode='22023'; end if;
  if p_idempotency_key is not null and length(p_idempotency_key) > 200 then raise exception 'IDEMPOTENCY_KEY_TOO_LARGE' using errcode='22023'; end if;
  v_metadata := public.pilot_sanitize_event_metadata(p_metadata,v_contract.metadata_keys);
  insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,occurred_at,received_at,idempotency_key,journey,surface,outcome,failure_class,error_code,latency_ms,correlation_id,source,authoritative,environment,event_schema_version)
  values(p_event_name,p_actor_id,p_actor_role,p_school_id,coalesce(nullif(p_entity_type,''),'application'),p_entity_id,v_metadata,now(),now(),p_idempotency_key,v_contract.journey,'backend',p_outcome,p_failure_class,left(p_error_code,80),p_latency_ms,p_correlation_id,'backend',true,'production',v_contract.schema_version)
  on conflict (idempotency_key) where idempotency_key is not null do nothing returning id into v_id;
  if v_id is null and p_idempotency_key is not null then select id into v_id from public.platform_events where idempotency_key=p_idempotency_key; end if;
  return v_id;
end;
$$;
revoke all on function public.pilot_record_authoritative_event(text,uuid,text,uuid,text,uuid,text,uuid,text,text,integer,jsonb,text) from public, anon, authenticated;
grant execute on function public.pilot_record_authoritative_event(text,uuid,text,uuid,text,uuid,text,uuid,text,text,integer,jsonb,text) to service_role;

create or replace function public.hq_get_pilot_slo_scorecard(p_as_of timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_platform_owner() then raise exception 'HQ_OWNER_REQUIRED' using errcode='42501'; end if;
  with definitions as (select * from public.pilot_slo_contract where active=true), measurements as (
    select d.slo_key,d.journey,d.target_percent,d.window_minutes,d.freshness_minutes,d.min_observations,d.owner_key,d.severity_when_degraded,
      count(e.id) filter (where e.event_type=d.attempt_event_name) as attempts,
      count(e.id) filter (where e.event_type=d.success_event_name and e.outcome='succeeded') as successes,
      max(e.received_at) filter (where e.event_type in (d.attempt_event_name,d.success_event_name)) as freshest_event_at,
      percentile_cont(0.95) within group (order by e.latency_ms) filter (where e.event_type=d.success_event_name and e.latency_ms is not null) as p95_latency_ms
    from definitions d left join public.platform_events e on e.environment='production' and e.received_at >= p_as_of-make_interval(mins=>d.window_minutes) and e.received_at <= p_as_of and e.event_type in (d.attempt_event_name,d.success_event_name)
    group by d.slo_key,d.journey,d.target_percent,d.window_minutes,d.freshness_minutes,d.min_observations,d.owner_key,d.severity_when_degraded
  ), normalized as (
    select *, greatest(attempts-successes,0) as failures,
      case when attempts=0 then null else round(100.0*successes/attempts,2) end as success_rate,
      floor(attempts*((100-target_percent)/100.0))::bigint as allowed_failures,
      case when attempts=0 or freshest_event_at is null then 'UNKNOWN' when freshest_event_at < p_as_of-make_interval(mins=>freshness_minutes) then 'UNKNOWN' when attempts < min_observations then 'UNKNOWN' when successes > attempts then 'DEGRADED' when (100.0*successes/attempts)>=target_percent then 'HEALTHY' when (100.0*successes/attempts)>=greatest(target_percent-2,0) then 'ATTENTION' else 'DEGRADED' end as status,
      case when successes>attempts then 'SUCCESS_COUNT_EXCEEDS_ATTEMPTS' when attempts=0 then 'NO_OBSERVATIONS' when freshest_event_at < p_as_of-make_interval(mins=>freshness_minutes) then 'STALE' when attempts<min_observations then 'LOW_SAMPLE' else 'OK' end as evidence_state
    from measurements)
  select jsonb_build_object('generated_at',p_as_of,'environment','production','status_semantics',jsonb_build_object('HEALTHY','observed volume meets minimum, data is fresh, and SLO target is met','ATTENTION','observed volume meets minimum but target is narrowly missed','DEGRADED','observed volume meets minimum and target is materially missed or event integrity is invalid','UNKNOWN','no observations, low sample, or stale evidence; never interpreted as healthy'),'slos',coalesce(jsonb_agg(jsonb_build_object('slo_key',slo_key,'journey',journey,'owner',owner_key,'status',status,'evidence_state',evidence_state,'attempts',attempts,'successes',successes,'failures',failures,'success_rate_percent',success_rate,'target_percent',target_percent,'min_observations',min_observations,'freshest_event_at',freshest_event_at,'p95_latency_ms',p95_latency_ms,'error_budget',jsonb_build_object('allowed_failures',allowed_failures,'consumed_failures',failures,'remaining_failures',greatest(allowed_failures-failures,0)),'severity_when_degraded',severity_when_degraded) order by slo_key),'[]'::jsonb)) into v_result from normalized;
  return v_result;
end;$$;
revoke all on function public.hq_get_pilot_slo_scorecard(timestamptz) from public, anon, authenticated;
grant execute on function public.hq_get_pilot_slo_scorecard(timestamptz) to authenticated;

comment on column public.platform_events.received_at is 'Server receipt time used for freshness and SLO windows; client clock is not trusted.';
comment on column public.platform_events.environment is 'Explicit telemetry environment. Production scorecards consume production only.';
comment on column public.platform_events.event_schema_version is 'Version of the registered event contract at ingestion time.';
comment on function public.pilot_record_event(text,text,text,uuid,uuid,text,uuid,uuid,text,text,integer,text,text,jsonb,text) is 'Authenticated, bounded, privacy-safe client telemetry ingress. Server derives actor/school, receipt time, environment and event schema; client cannot emit authoritative events.';

commit;