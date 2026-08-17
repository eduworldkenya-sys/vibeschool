\set ON_ERROR_STOP on

-- Clean-rebuild certification for the final Worker Engine authority plane.
do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  active_grants integer;
begin
  if to_regclass('public.hq_workforce_capability_authority_grants') is null then raise exception 'worker authority grants missing'; end if;
  if to_regclass('public.hq_workforce_execution_breakers') is null then raise exception 'worker execution breakers missing'; end if;
  if to_regclass('public.hq_workforce_execution_breaker_events') is null then raise exception 'worker breaker evidence missing'; end if;
  if to_regclass('public.hq_workforce_capability_execution_limits') is null then raise exception 'worker capability limits missing'; end if;
  if to_regprocedure('public.hq_workforce_consequential_execution_gateway(uuid)') is null then raise exception 'canonical consequential gateway missing'; end if;
  if to_regprocedure('public.hq_workforce_tool_gateway_execute(uuid)') is null then raise exception 'tool gateway missing'; end if;
  if to_regprocedure('public.hq_workforce_reserve_capability_execution(uuid,uuid)') is null then raise exception 'capability limiter missing'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'worker engine contract missing'; end if;
  if coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'clean rebuild did not preserve fail-closed runtime boundary';
  end if;

  select count(*) into active_grants from public.hq_workforce_capability_authority_grants where status='active';
  if active_grants<>0 then raise exception 'clean rebuild introduced active worker authority'; end if;

  if has_function_privilege('anon','public.hq_workforce_consequential_execution_gateway(uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.hq_workforce_consequential_execution_gateway(uuid)','EXECUTE') then
    raise exception 'canonical gateway exposed to user roles';
  end if;
  if not has_function_privilege('service_role','public.hq_workforce_consequential_execution_gateway(uuid)','EXECUTE') then
    raise exception 'service role cannot reach canonical gateway';
  end if;
end $$;

select 'WORKER ENGINE AUTHORITY PLANE VERIFICATION PASSED' as result;
