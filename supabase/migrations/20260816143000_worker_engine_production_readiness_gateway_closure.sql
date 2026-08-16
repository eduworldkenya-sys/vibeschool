-- Worker Engine production-readiness hardening: mutation-boundary closure and master-gate hierarchy.
-- access: service-only Worker Engine control plane; no anon/authenticated execution is introduced.
-- authorization-test: legacy queue executor has no EXECUTE privilege for public/anon/authenticated/service_role;
-- authorization-test: scheduled Factory heartbeat returns disabled unless BOTH runtime and Factory are enabled.

-- P0: retire the legacy autonomous queue mutation gateway as an executable control surface.
-- Keep the function definition for migration/replay compatibility, but remove every application role's ability
-- to invoke it. Any future consequential queue mutation must traverse the R1.4 canonical gateway.
revoke all on function public.hq_workforce_execute_safe_queue() from public, anon, authenticated, service_role;

comment on function public.hq_workforce_execute_safe_queue() is
'RETIRED: legacy pre-R1.4 queue mutator. No application role may execute it. Consequential Worker Engine mutation must use the canonical R1.4 authority/execution/verification path.';

-- P1: master runtime gate dominates the Factory subsystem switch.
create or replace function public.hq_workforce_scheduled_factory_heartbeat()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_runtime_enabled boolean;
  v_anomaly_paused boolean;
  v_factory_enabled boolean;
  v_limit integer;
begin
  select runtime_execution_enabled,
         runtime_anomaly_paused,
         factory_enabled,
         factory_limit
    into v_runtime_enabled,
         v_anomaly_paused,
         v_factory_enabled,
         v_limit
  from public.hq_workforce_engine_contract
  where singleton=true;

  -- Fail closed on a missing contract, master runtime OFF, or global anomaly pause.
  if not found
     or not coalesce(v_runtime_enabled,false)
     or coalesce(v_anomaly_paused,true) then
    return jsonb_build_object(
      'status','disabled',
      'reason','master_runtime_gate',
      'mode','deterministic'
    );
  end if;

  if not coalesce(v_factory_enabled,false) then
    return jsonb_build_object(
      'status','disabled',
      'reason','factory_gate',
      'mode','deterministic'
    );
  end if;

  return public.hq_workforce_autonomous_factory_heartbeat(coalesce(v_limit,10));
end $$;

revoke all on function public.hq_workforce_scheduled_factory_heartbeat() from public, anon, authenticated;
grant execute on function public.hq_workforce_scheduled_factory_heartbeat() to service_role;

comment on function public.hq_workforce_scheduled_factory_heartbeat() is
'Factory scheduler entrypoint. Master runtime enablement and anomaly/global-stop state dominate the subsystem factory_enabled switch.';
