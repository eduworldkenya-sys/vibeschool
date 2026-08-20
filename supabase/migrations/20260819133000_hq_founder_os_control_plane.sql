-- Founder OS canonical owner-only read model.
-- Read-only control plane: no runtime activation, autonomy, grants, payments, publishing, or worker execution.

create or replace function public.hq_founder_os_snapshot(p_recent_limit integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  lim integer := greatest(1, least(coalesce(p_recent_limit,25),100));
  v_open_incidents bigint; v_critical_incidents bigint; v_high_incidents bigint;
  v_open_findings bigint; v_critical_findings bigint; v_actionable_decisions bigint;
  v_overdue_high_work bigint; v_runs bigint; v_intents bigint; v_execution_verifications bigint;
  v_task_verifications bigint; v_failed_verifications bigint; v_heartbeats bigint; v_scheduler_events bigint;
  v_open_breakers bigint; v_state text; v_engine jsonb;
begin
  perform public.hq_assert_owner();
  select count(*),count(*) filter(where severity='critical'),count(*) filter(where severity='high') into v_open_incidents,v_critical_incidents,v_high_incidents from public.hq_incidents where resolved_at is null and status not in ('resolved','closed');
  select count(*),count(*) filter(where severity='critical') into v_open_findings,v_critical_findings from public.hq_findings where resolved_at is null and status not in ('resolved','closed');
  select count(*) into v_actionable_decisions from public.hq_workforce_decisions where status in ('pending','actionable','proposed','revision_requested','awaiting_review');
  select count(*) into v_overdue_high_work from public.hq_work_items where status in ('open','in_progress','waiting_approval') and priority in ('critical','high') and due_at is not null and due_at < clock_timestamp();
  select count(*) into v_runs from public.hq_workforce_runs; select count(*) into v_intents from public.hq_workforce_execution_intents; select count(*) into v_execution_verifications from public.hq_workforce_execution_verifications; select count(*) into v_task_verifications from public.hq_workforce_task_verifications; select count(*) into v_failed_verifications from public.hq_workforce_execution_verifications where passed is false; select count(*) into v_heartbeats from public.hq_workforce_heartbeat_runs; select count(*) into v_scheduler_events from public.hq_workforce_scheduler_events; select count(*) into v_open_breakers from public.hq_workforce_execution_breakers where status not in ('reset','closed','resolved');
  select jsonb_build_object('runtime_execution_enabled',runtime_execution_enabled,'runtime_autonomy_level',runtime_autonomy_level,'runtime_max_risk',runtime_max_risk,'runtime_max_concurrency',runtime_max_concurrency,'runtime_max_executions_per_minute',runtime_max_executions_per_minute,'shadow_enabled',shadow_enabled,'shadow_scheduler_enabled',shadow_scheduler_enabled,'shadow_global_stop',shadow_global_stop,'factory_enabled',factory_enabled,'heartbeat_enabled',heartbeat_enabled,'updated_at',updated_at) into v_engine from public.hq_workforce_engine_contract where singleton=true;
  v_state:=case when v_critical_incidents>0 then 'INCIDENT' when v_high_incidents>0 or v_critical_findings>0 or v_failed_verifications>0 or v_open_breakers>0 then 'DEGRADED' when v_open_findings>0 or v_actionable_decisions>0 or v_overdue_high_work>0 or (v_runs>0 and (v_intents=0 or v_execution_verifications=0)) then 'ATTENTION' else 'LIVE' end;
  return jsonb_build_object('generated_at',clock_timestamp(),'company_state',v_state,'state_precedence',jsonb_build_array('INCIDENT','DEGRADED','ATTENTION','LIVE'),'summary',jsonb_build_object('open_incidents',v_open_incidents,'open_findings',v_open_findings,'actionable_decisions',v_actionable_decisions,'overdue_high_work',v_overdue_high_work,'open_breakers',v_open_breakers),'execution_integrity',jsonb_build_object('runs',v_runs,'intents',v_intents,'execution_verifications',v_execution_verifications,'task_verifications',v_task_verifications,'failed_verifications',v_failed_verifications,'heartbeat_runs',v_heartbeats,'scheduler_events',v_scheduler_events,'verification_gap',v_runs>0 and (v_intents=0 or v_execution_verifications=0),'historical_gap_note',case when v_runs>0 and (v_intents=0 or v_execution_verifications=0) then 'Historical runs exist without a complete intent-to-verification trail. This read model does not manufacture missing evidence.' else null end),'engine',v_engine);
end $$;
revoke all on function public.hq_founder_os_snapshot(integer) from public,anon;
grant execute on function public.hq_founder_os_snapshot(integer) to authenticated;
comment on function public.hq_founder_os_snapshot(integer) is 'Owner-only deterministic Founder OS read model. Observation and recommendation evidence only; performs no consequential mutation.';
