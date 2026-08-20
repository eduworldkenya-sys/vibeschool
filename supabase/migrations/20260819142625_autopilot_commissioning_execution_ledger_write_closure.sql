-- Autopilot production commissioning: execution-ledger write closure.
-- NON-ACTIVATING. service_role is transport, not authority to mint budget capacity or
-- forge/rewrite dead-letter evidence. Governed SECURITY DEFINER gateways retain the
-- database-owner privileges required to update these ledgers internally.

revoke insert,update,delete,truncate on table public.hq_workforce_execution_budgets from service_role;
revoke insert,update,delete,truncate on table public.hq_workforce_dead_letters from service_role;
grant select on table public.hq_workforce_execution_budgets to service_role;
grant select on table public.hq_workforce_dead_letters to service_role;

do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  if has_table_privilege('service_role','public.hq_workforce_execution_budgets','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_execution_budgets','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_execution_budgets','DELETE')
     or has_table_privilege('service_role','public.hq_workforce_execution_budgets','TRUNCATE') then
    raise exception 'service_role_can_forge_execution_budget';
  end if;
  if has_table_privilege('service_role','public.hq_workforce_dead_letters','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_dead_letters','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_dead_letters','DELETE')
     or has_table_privilege('service_role','public.hq_workforce_dead_letters','TRUNCATE') then
    raise exception 'service_role_can_forge_dead_letter';
  end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'execution_ledger_closure_requires_engine_contract'; end if;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'execution_ledger_closure_changed_fail_closed_posture';
  end if;
end $$;
