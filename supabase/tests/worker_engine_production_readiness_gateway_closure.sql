-- Worker Engine production-readiness mutation-boundary closure regression.
begin;

-- The legacy pre-R1.4 mutator must be unreachable by every application role.
do $$
begin
  if has_function_privilege('service_role','public.hq_workforce_execute_safe_queue()','EXECUTE') then
    raise exception 'legacy_execute_safe_queue_service_role_still_executable';
  end if;
  if has_function_privilege('authenticated','public.hq_workforce_execute_safe_queue()','EXECUTE') then
    raise exception 'legacy_execute_safe_queue_authenticated_still_executable';
  end if;
  if has_function_privilege('anon','public.hq_workforce_execute_safe_queue()','EXECUTE') then
    raise exception 'legacy_execute_safe_queue_anon_still_executable';
  end if;
end $$;

-- Factory enablement must never override the master runtime switch.
update public.hq_workforce_engine_contract
set runtime_execution_enabled=false,
    runtime_anomaly_paused=false,
    factory_enabled=true
where singleton=true;

do $$
declare r jsonb;
begin
  r:=public.hq_workforce_scheduled_factory_heartbeat();
  if r->>'status' <> 'disabled' or r->>'reason' <> 'master_runtime_gate' then
    raise exception 'factory_did_not_obey_master_runtime_gate: %',r;
  end if;
end $$;

-- A global/anomaly stop also dominates Factory even if runtime and Factory switches are true.
update public.hq_workforce_engine_contract
set runtime_execution_enabled=true,
    runtime_anomaly_paused=true,
    factory_enabled=true
where singleton=true;

do $$
declare r jsonb;
begin
  r:=public.hq_workforce_scheduled_factory_heartbeat();
  if r->>'status' <> 'disabled' or r->>'reason' <> 'master_runtime_gate' then
    raise exception 'factory_did_not_obey_global_stop: %',r;
  end if;
end $$;

rollback;
