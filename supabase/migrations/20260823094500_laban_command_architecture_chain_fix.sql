-- Laban architecture-chain reconciliation — NON-ACTIVATING.
-- Forward-only repair: the canonical R1.4 gateway is intentionally wrapped by later
-- approval-binding and durable-breaker layers. Validate the protected call chain rather
-- than requiring the outermost wrapper to contain the authorization call directly.

create or replace function public.hq_workforce_command_assert_architecture_invariants()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  legacy_def text;
  canonical_def text;
  approval_bound_def text;
  authorized_inner_def text;
  enabled_count integer;
begin
  select pg_get_functiondef('public.hq_workforce_tool_gateway_execute(uuid)'::regprocedure) into legacy_def;
  select pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure) into canonical_def;
  select pg_get_functiondef('public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)'::regprocedure) into approval_bound_def;
  select pg_get_functiondef('public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid)'::regprocedure) into authorized_inner_def;

  if position('hq_workforce_consequential_execution_gateway' in legacy_def)=0 then
    raise exception 'architecture_drift_legacy_gateway_not_bridged';
  end if;
  if position('update public.hq_work_items' in lower(legacy_def))>0 then
    raise exception 'architecture_drift_second_consequential_gateway';
  end if;

  -- Current canonical topology:
  -- legacy bridge -> durable-breaker canonical wrapper -> approval-bound wrapper
  -- -> authorized R1.4 inner gateway. Each link must remain explicit.
  if position('hq_workforce_consequential_execution_gateway_r14_approval_bound_internal' in canonical_def)=0 then
    raise exception 'architecture_drift_canonical_breaker_chain_missing';
  end if;
  if position('hq_workforce_assert_approved_plan_binding' in approval_bound_def)=0
     or position('hq_workforce_consequential_execution_gateway_r14_pre_approval_binding' in approval_bound_def)=0 then
    raise exception 'architecture_drift_approval_binding_chain_missing';
  end if;
  if position('hq_workforce_assert_consequential_task_authorized' in authorized_inner_def)=0 then
    raise exception 'architecture_drift_canonical_authorization_missing';
  end if;

  -- Internal gateway implementations must not be externally callable by transport roles.
  if has_function_privilege('service_role','public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid)','EXECUTE') then
    raise exception 'architecture_drift_internal_gateway_externally_callable';
  end if;

  select count(*) into enabled_count from public.hq_workforce_architecture_invariants
    where enabled and invariant_key in ('single_consequential_gateway','no_self_authority','no_self_certification','scheduler_no_authority','contradiction_reopens');
  if enabled_count<>5 then raise exception 'architecture_invariants_not_fully_enabled:%',enabled_count; end if;

  return jsonb_build_object(
    'decision','pass',
    'enabled_invariants',enabled_count,
    'legacy_gateway','bridged',
    'canonical_chain','durable_breaker->approval_binding->r1_4_authorization',
    'canonical_authorization','present',
    'internal_gateway_exposure','closed'
  );
end $$;

revoke all on function public.hq_workforce_command_assert_architecture_invariants() from public,anon,authenticated;
grant execute on function public.hq_workforce_command_assert_architecture_invariants() to service_role;

-- Reassert the non-activation boundary after the forward repair.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'command_architecture_chain_fix_requires_engine_contract'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'command_architecture_chain_fix_non_activating_boundary_violated';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'command_architecture_chain_fix_must_not_activate_authority'; end if;
end $$;
