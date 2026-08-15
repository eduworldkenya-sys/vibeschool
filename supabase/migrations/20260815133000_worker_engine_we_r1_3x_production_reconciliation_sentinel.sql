-- WE-R1.3X production reconciliation sentinel. NON-ACTIVATING.
-- This migration creates no runtime capability. It proves the certified reconciliation
-- infrastructure exists before production promotion can be considered complete.

do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  if to_regclass('public.hq_workforce_objectives') is null then raise exception 'R1.3X production sentinel: objective kernel missing'; end if;
  if to_regclass('public.hq_workforce_memory_records') is null then raise exception 'R1.3X production sentinel: memory/context fabric missing'; end if;
  if to_regclass('public.hq_workforce_capabilities') is null then raise exception 'R1.3X production sentinel: capability graph missing'; end if;
  if to_regclass('public.hq_workforce_resources') is null then raise exception 'R1.3X production sentinel: resource registry missing'; end if;
  if to_regclass('public.hq_workforce_plans') is null then raise exception 'R1.3X production sentinel: planning graph missing'; end if;
  if to_regclass('public.hq_workforce_collaborations') is null then raise exception 'R1.3X production sentinel: collaboration fabric missing'; end if;
  if to_regclass('public.hq_workforce_scheduler_events') is null then raise exception 'R1.3X production sentinel: scheduler reconciliation missing'; end if;
  if to_regclass('public.hq_workforce_factory_recommendations') is null then raise exception 'R1.3X production sentinel: factory reconciliation missing'; end if;

  if to_regprocedure('public.hq_workforce_run_r1_3x_shadow_scheduler(text,integer)') is null then
    raise exception 'R1.3X production sentinel: canonical shadow scheduler missing';
  end if;
  if to_regprocedure('public.hq_workforce_route_plan_step(uuid,text,text)') is null then
    raise exception 'R1.3X production sentinel: competency router missing';
  end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'R1.3X production sentinel: engine contract missing'; end if;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled
     or ec.runtime_autonomy_level <> 0 or ec.runtime_max_risk <> 0
     or ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop then
    raise exception 'R1.3X production sentinel: fail-closed OFF/L0/R0 boundary violated';
  end if;
end $$;
