begin;

do $$
declare v_id bigint; v jsonb;
begin
  insert into public.hq_workforce_scheduler_events(cycle_key,stage,outcome,details,consequential_execution)
  values('commissioning-lineage-contract','shadow','synthetic_shadow_evaluation',jsonb_build_object('simulation',jsonb_build_object('status','synthetic')),false)
  returning id,details into v_id,v;

  if v->'commissioning_lineage' is null then raise exception 'shadow_commissioning_lineage_missing'; end if;
  if not (v->'commissioning_lineage' ?& array[
    'cycle_key','objective_id','plan_id','plan_step_id','worker_keys','capabilities','objective_scope',
    'authority_decision','budget_decision','precondition_decision','would_execute','verification_route',
    'predicted_outcome','policy_version','reason'
  ]) then raise exception 'shadow_commissioning_lineage_fields_incomplete:%',v; end if;
  if coalesce((v#>>'{commissioning_lineage,would_execute}')::boolean,true) then
    raise exception 'shadow_lineage_claimed_consequential_execution';
  end if;
  if (v#>>'{commissioning_lineage,authority_decision,decision}') is distinct from 'deny_global_stop' then
    raise exception 'shadow_lineage_global_stop_not_reflected:%',v#>'{commissioning_lineage,authority_decision}';
  end if;
  if (v#>>'{commissioning_lineage,budget_decision,decision}') is null then
    raise exception 'shadow_lineage_budget_decision_missing';
  end if;
  if (v#>>'{commissioning_lineage,precondition_decision,decision}') is null then
    raise exception 'shadow_lineage_precondition_decision_missing';
  end if;
  if (v#>>'{commissioning_lineage,verification_route,route}') is null then
    raise exception 'shadow_lineage_verification_route_missing';
  end if;
end $$;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_autopilot_enrich_shadow_scheduler_event()'::regprocedure)) into d;
  if position('hq_workforce_capability_authority_grants' in d)=0
     or position('hq_workforce_execution_budgets' in d)=0
     or position('hq_workforce_runtime_policies' in d)=0
     or position('hq_workforce_plan_step_capabilities' in d)=0 then
    raise exception 'shadow_lineage_not_derived_from_canonical_ledgers';
  end if;
  if has_function_privilege('anon','public.hq_autopilot_enrich_shadow_scheduler_event()','EXECUTE')
     or has_function_privilege('authenticated','public.hq_autopilot_enrich_shadow_scheduler_event()','EXECUTE')
     or has_function_privilege('service_role','public.hq_autopilot_enrich_shadow_scheduler_event()','EXECUTE') then
    raise exception 'shadow_lineage_trigger_function_directly_exposed';
  end if;
end $$;

rollback;
