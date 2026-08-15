-- WE-R1.3X legacy-entrypoint retirement.
-- Preserve historical functions for replay/audit, but remove the old positive scheduler from externally invokable service authority.
-- R1.3X Shadow orchestration is the canonical intelligence path. This does not create a cron or enable any runtime.

revoke execute on function public.hq_workforce_scheduled_heartbeat() from service_role;

-- Reassert that all old positive autonomous controls remain disabled.
do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then
   raise exception 'legacy_autonomous_control_not_retired';
 end if;
 if has_function_privilege('service_role','public.hq_workforce_scheduled_heartbeat()','EXECUTE') then
   raise exception 'legacy_scheduled_heartbeat_still_externally_invokable';
 end if;
end $$;
