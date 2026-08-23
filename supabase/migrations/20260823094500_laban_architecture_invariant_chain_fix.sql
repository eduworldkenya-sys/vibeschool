-- Laban architecture-invariant chain fix — NON-ACTIVATING.
-- The canonical R1.4 gateway is intentionally layered: durable breaker wrapper ->
-- approval-bound internal gateway -> pre-approval R1.4 body -> consequential authorization.
-- Validate the complete chain instead of expecting the outer wrapper to contain the
-- authorization assertion directly.

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
  pre_approval_def text;
  enabled_count integer;
begin
  if to_regprocedure('public.hq_workforce_tool_gateway_execute(uuid)') is null then
    raise exception 'architecture_drift_legacy_gateway_missing';
  end if;
  if to_regprocedure('public.hq_workforce_consequential_execution_gateway(uuid)') is null then
    raise exception 'architecture_drift_canonical_gateway_missing';
  end if;
  if to_regprocedure('public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)') is null then
    raise exception 'architecture_drift_approval_bound_gateway_missing';
  end if;
  if to_regprocedure('public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid)') is null then
    raise exception 'architecture_drift_pre_approval_gateway_missing';
  end if;

  select pg_get_functiondef('public.hq_workforce_tool_gateway_execute(uuid)'::regprocedure) into legacy_def;
  select pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure) into canonical_def;
  select pg_get_functiondef('public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)'::regprocedure) into approval_bound_def;
  select pg_get_functiondef('public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid)'::regprocedure) into pre_approval_def;

  if position('hq_workforce_consequential_execution_gateway' in legacy_def)=0 then
    raise exception 'architecture_drift_legacy_gateway_not_bridged';
  end if;
  if position('update public.hq_work_items' in lower(legacy_def))>0 then
    raise exception 'architecture_drift_second_consequential_gateway';
  end if;

  -- Outer canonical wrapper must route only through the inaccessible approval-bound body.
  if position('hq_workforce_consequential_execution_gateway_r14_approval_bound_internal' in canonical_def)=0 then
    raise exception 'architecture_drift_canonical_gateway_not_layered';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)','EXECUTE') then
    raise exception 'architecture_drift_approval_bound_internal_exposed';
  end if;

  -- Approval-bound body must enforce owner-approved immutable plan binding before entering
  -- the original R1.4 body.
  if position('hq_workforce_assert_approved_plan_binding' in approval_bound_def)=0 then
    raise exception 'architecture_drift_approved_plan_binding_missing';
  end if;
  if position('hq_workforce_consequential_execution_gateway_r14_pre_approval_binding' in approval_bound_def)=0 then
    raise exception 'architecture_drift_pre_approval_chain_missing';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid)','EXECUTE') then
    raise exception 'architecture_drift_pre_approval_internal_exposed';
  end if;

  -- The preserved R1.4 body is where capability/authority authorization is performed.
  if position('hq_workforce_assert_consequential_task_authorized' in pre_approval_def)=0 then
    raise exception 'architecture_drift_canonical_authorization_missing';
  end if;

  select count(*) into enabled_count
    from public.hq_workforce_architecture_invariants
   where enabled
     and invariant_key in (
       'single_consequential_gateway',
       'no_self_authority',
       'no_self_certification',
       'scheduler_no_authority',
       'contradiction_reopens'
     );
  if enabled_count<>5 then
    raise exception 'architecture_invariants_not_fully_enabled:%',enabled_count;
  end if;

  return jsonb_build_object(
    'decision','pass',
    'enabled_invariants',enabled_count,
    'legacy_gateway','bridged',
    'canonical_gateway','durable_breaker_wrapper',
    'approved_plan_binding','present',
    'capability_authorization','present',
    'internal_gateway_exposure','closed'
  );
end $$;

revoke all on function public.hq_workforce_command_assert_architecture_invariants() from public,anon,authenticated;
grant execute on function public.hq_workforce_command_assert_architecture_invariants() to service_role;

-- Reassert the non-activating boundary after the invariant repair.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'laban_architecture_fix_requires_engine_contract'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'laban_architecture_fix_non_activating_boundary_violated';
  end if;
  select count(*) into v_active
    from public.hq_workforce_capability_authority_grants
   where status='active';
  if v_active<>0 then
    raise exception 'laban_architecture_fix_must_not_activate_authority';
  end if;
end $$;
