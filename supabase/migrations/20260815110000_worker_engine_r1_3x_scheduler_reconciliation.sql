-- WE-R1.3X X7: Scheduler Reconciliation
-- Canonical rule: legacy autonomous heartbeat is not a scheduling authority.
-- Scheduling remains fail-closed and shadow-only; no cron is installed here.

-- Retire any legacy pg_cron heartbeat registration left by historical migrations.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job
     where jobname='vibeschool-worker-engine-heartbeat';
  end if;
end $$;

-- Fail closed at migration time. X7 does not activate Shadow, heartbeat, Factory,
-- consequential execution, or autonomy.
update public.hq_workforce_engine_contract
set heartbeat_enabled=false,
    factory_enabled=false,
    runtime_execution_enabled=false,
    runtime_autonomy_level=0,
    runtime_max_risk=0,
    shadow_enabled=false,
    shadow_scheduler_enabled=false,
    shadow_global_stop=true,
    updated_at=clock_timestamp()
where singleton=true;

-- Preserve the historical RPC name only as a compatibility tombstone.
-- It must never delegate to hq_workforce_autonomous_heartbeat again.
create or replace function public.hq_workforce_scheduled_heartbeat()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  return jsonb_build_object(
    'status','retired',
    'mode','compatibility_tombstone',
    'reason','legacy_heartbeat_scheduler_superseded_by_governed_shadow_scheduler',
    'consequential_execution',false
  );
end $$;

revoke all on function public.hq_workforce_scheduled_heartbeat() from public,anon,authenticated;
grant execute on function public.hq_workforce_scheduled_heartbeat() to service_role;

-- Adversarial migration assertions: no legacy cron authority and all runtime
-- execution surfaces remain at L0/R0 with global Shadow stop asserted.
do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  legacy_cron_count integer:=0;
begin
  select * into ec
    from public.hq_workforce_engine_contract
   where singleton=true;

  if not found then
    raise exception 'X7 scheduler reconciliation: runtime contract missing';
  end if;

  if exists(select 1 from pg_extension where extname='pg_cron') then
    select count(*) into legacy_cron_count
      from cron.job
     where jobname='vibeschool-worker-engine-heartbeat';
  end if;

  if legacy_cron_count<>0 then
    raise exception 'X7 scheduler reconciliation: legacy heartbeat cron remains installed';
  end if;

  if ec.heartbeat_enabled
     or ec.factory_enabled
     or ec.runtime_execution_enabled
     or ec.runtime_autonomy_level<>0
     or ec.runtime_max_risk<>0
     or ec.shadow_enabled
     or ec.shadow_scheduler_enabled
     or not ec.shadow_global_stop then
    raise exception 'X7 scheduler reconciliation violated fail-closed L0/R0 boundary';
  end if;
end $$;
