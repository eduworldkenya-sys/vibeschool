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

-- The activation guard itself must reject attempts to turn runtime on while an
-- anomaly/global stop is asserted. Do not bypass that safety invariant merely
-- to manufacture an impossible state for the Factory heartbeat test.
do $$
begin
  begin
    update public.hq_workforce_engine_contract
    set runtime_anomaly_paused=true,
        runtime_execution_enabled=true,
        factory_enabled=true
    where singleton=true;
    raise exception 'runtime_activation_guard_failed_to_block_anomaly_stop';
  exception
    when others then
      if sqlerrm <> 'runtime_activation_blocked_by_anomaly_stop' then raise; end if;
  end;
end $$;

-- With runtime already OFF, asserting the stop must continue to dominate the
-- Factory path and return the canonical master-runtime denial.
update public.hq_workforce_engine_contract
set runtime_execution_enabled=false,
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
