-- Task 12 production postflight repair: output-column names in RETURNS TABLE are
-- PL/pgSQL variables, so every measurement reference is explicitly qualified.

begin;

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
  with d as (select * from public.pilot_slo_contract where active=true), m as (
    select d.slo_key,d.journey,d.target_percent,d.window_minutes,d.freshness_minutes,d.min_observations,d.severity_when_degraded,
      count(e.id) filter(where e.event_type=d.attempt_event_name) as measured_attempts,
      count(e.id) filter(where e.event_type=d.success_event_name and e.outcome='succeeded') as measured_successes,
      max(e.received_at) filter(where e.event_type in(d.attempt_event_name,d.success_event_name)) as measured_freshest_event_at
    from d left join public.platform_events e on e.environment='production' and e.received_at>=p_as_of-make_interval(mins=>d.window_minutes) and e.received_at<=p_as_of and e.event_type in(d.attempt_event_name,d.success_event_name)
    group by d.slo_key,d.journey,d.target_percent,d.window_minutes,d.freshness_minutes,d.min_observations,d.severity_when_degraded
  ), s as (
    select m.*, greatest(m.measured_attempts-m.measured_successes,0) as measured_failures,
      case when m.measured_attempts=0 then null else round(100.0*m.measured_successes/m.measured_attempts,2) end as measured_success_rate,
      case when m.measured_attempts=0 or m.measured_freshest_event_at is null then 'UNKNOWN' when m.measured_freshest_event_at<p_as_of-make_interval(mins=>m.freshness_minutes) then 'UNKNOWN' when m.measured_attempts<m.min_observations then 'UNKNOWN' when m.measured_successes>m.measured_attempts then 'DEGRADED' when (100.0*m.measured_successes/m.measured_attempts)>=m.target_percent then 'HEALTHY' when (100.0*m.measured_successes/m.measured_attempts)>=greatest(m.target_percent-2,0) then 'ATTENTION' else 'DEGRADED' end as measured_state,
      case when m.measured_successes>m.measured_attempts then 'SUCCESS_COUNT_EXCEEDS_ATTEMPTS' when m.measured_attempts=0 then 'NO_OBSERVATIONS' when m.measured_freshest_event_at<p_as_of-make_interval(mins=>m.freshness_minutes) then 'STALE' when m.measured_attempts<m.min_observations then 'LOW_SAMPLE' else 'OK' end as measured_evidence
    from m)
  select md5('task12:slo:'||s.slo_key||':'||s.measured_state||':'||s.measured_evidence),s.slo_key,s.journey,case when s.measured_state='DEGRADED' then s.severity_when_degraded else 'P2' end,s.measured_state,s.measured_evidence,s.measured_attempts,s.measured_successes,s.measured_failures,s.target_percent,s.measured_success_rate,s.measured_freshest_event_at
  from s where s.measured_state in('DEGRADED','UNKNOWN');
end;$$;
revoke all on function public.hq_get_pilot_alert_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.hq_get_pilot_alert_candidates(timestamptz) to authenticated;
comment on function public.hq_get_pilot_alert_candidates(timestamptz) is 'Owner-only Task 12 deterministic detection candidates for Task 11 handoff. Runtime-qualified to avoid RETURNS TABLE output-variable ambiguity; does not mutate incidents.';
commit;