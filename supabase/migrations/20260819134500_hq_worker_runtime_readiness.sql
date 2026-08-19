-- Owner-only runtime readiness. Observation only; does not activate or mutate runtime.
create or replace function public.hq_workforce_runtime_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_global_policies bigint;
  v_active_grants bigint;
  v_global_breakers bigint;
begin
  perform public.hq_assert_owner();
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  select count(*) into v_global_policies from public.hq_workforce_runtime_policies
    where status='active' and enabled and scope_kind='global' and scope_key='global';
  select count(*) into v_active_grants from public.hq_workforce_capability_authority_grants
    where status='active' and activated_at is not null and activated_at<=clock_timestamp()
      and expires_at>clock_timestamp() and revoked_at is null;
  select count(*) into v_global_breakers from public.hq_workforce_execution_breakers
    where scope_type='global' and scope_ref='global' and status='tripped';
  return jsonb_build_object(
    'runtime_execution_enabled',ec.runtime_execution_enabled,
    'runtime_autonomy_level',ec.runtime_autonomy_level,
    'runtime_max_risk',ec.runtime_max_risk,
    'shadow_stopped',not ec.shadow_enabled and not ec.shadow_scheduler_enabled and ec.shadow_global_stop,
    'global_stop_active',ec.shadow_global_stop,
    'active_global_policies',v_global_policies,
    'active_capability_grants',v_active_grants,
    'tripped_global_breakers',v_global_breakers,
    'can_request_activation',not ec.runtime_execution_enabled
      and not ec.shadow_enabled and not ec.shadow_scheduler_enabled and ec.shadow_global_stop
      and v_global_policies>0 and v_active_grants>0 and v_global_breakers=0,
    'blocked_reasons',jsonb_strip_nulls(jsonb_build_object(
      'runtime_already_enabled',case when ec.runtime_execution_enabled then true end,
      'shadow_not_stopped',case when ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop then true end,
      'enabled_global_policy_missing',case when v_global_policies=0 then true end,
      'active_capability_authority_missing',case when v_active_grants=0 then true end,
      'global_breaker_tripped',case when v_global_breakers>0 then true end
    )),
    'observed_at',clock_timestamp()
  );
end $$;
revoke all on function public.hq_workforce_runtime_readiness() from public,anon,service_role;
grant execute on function public.hq_workforce_runtime_readiness() to authenticated;
comment on function public.hq_workforce_runtime_readiness() is 'Owner-only non-mutating runtime activation readiness evidence.';
