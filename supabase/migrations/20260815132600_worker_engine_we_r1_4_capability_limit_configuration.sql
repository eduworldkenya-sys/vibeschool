-- WE-R1.4.7 hardening: limits must be capability-specific and governable before certification.
-- This function may only narrow/configure a DRAFT authority envelope. It cannot certify,
-- activate, widen identity/scope/operation authority, or mutate runtime activation state.

create or replace function public.hq_workforce_configure_draft_capability_execution_limits(
  p_authority_grant_id uuid,
  p_max_operations_per_cycle integer,
  p_max_records_per_operation integer,
  p_max_concurrency integer,
  p_max_executions_per_minute integer,
  p_max_runtime_ms integer
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare g public.hq_workforce_capability_authority_grants%rowtype;
begin
  if p_max_operations_per_cycle not between 1 and 1000 then raise exception 'capability_authority_cycle_limit_invalid'; end if;
  if p_max_records_per_operation not between 1 and 100000 then raise exception 'capability_authority_record_limit_invalid'; end if;
  if p_max_concurrency not between 1 and 1000 then raise exception 'capability_authority_concurrency_invalid'; end if;
  if p_max_executions_per_minute not between 1 and 100000 then raise exception 'capability_authority_rate_invalid'; end if;
  if p_max_runtime_ms not between 50 and 600000 then raise exception 'capability_authority_runtime_invalid'; end if;

  select * into g from public.hq_workforce_capability_authority_grants
   where id=p_authority_grant_id for update;
  if not found then raise exception 'capability_authority_not_found'; end if;
  if g.status<>'draft' then raise exception 'capability_authority_limits_only_configurable_in_draft'; end if;

  update public.hq_workforce_capability_authority_grants
     set max_operations_per_cycle=p_max_operations_per_cycle,
         max_records_per_operation=p_max_records_per_operation,
         max_concurrency=p_max_concurrency,
         max_executions_per_minute=p_max_executions_per_minute,
         max_runtime_ms=p_max_runtime_ms
   where id=g.id;

  return jsonb_build_object(
    'authority_grant_id',g.id,'status','draft',
    'max_operations_per_cycle',p_max_operations_per_cycle,
    'max_records_per_operation',p_max_records_per_operation,
    'max_concurrency',p_max_concurrency,
    'max_executions_per_minute',p_max_executions_per_minute,
    'max_runtime_ms',p_max_runtime_ms
  );
end $$;

revoke all on function public.hq_workforce_configure_draft_capability_execution_limits(uuid,integer,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.hq_workforce_configure_draft_capability_execution_limits(uuid,integer,integer,integer,integer,integer) to service_role;

-- This gate remains structurally non-activating.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.7 limit configuration requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.7 limit configuration violated fail-closed runtime boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.7 limit configuration cannot activate authority'; end if;
end $$;
