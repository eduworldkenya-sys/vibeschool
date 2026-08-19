begin;

-- Architecture: Autopilot composes Worker Engine/HQ instead of creating duplicate ledgers.
do $$
begin
  if to_regclass('public.autopilot_workers') is not null
     or to_regclass('public.autopilot_runs') is not null
     or to_regclass('public.autopilot_authority_grants') is not null
     or to_regclass('public.autopilot_execution_intents') is not null then
    raise exception 'duplicate_autopilot_control_plane_detected';
  end if;
  if to_regclass('public.hq_workforce_objectives') is null
     or to_regclass('public.hq_workforce_plans') is null
     or to_regclass('public.hq_workforce_plan_steps') is null
     or to_regclass('public.hq_workforce_capability_authority_grants') is null
     or to_regclass('public.hq_workforce_execution_budgets') is null
     or to_regclass('public.hq_workforce_execution_intents') is null
     or to_regclass('public.hq_workforce_execution_verifications') is null
     or to_regclass('public.hq_workforce_execution_outcomes') is null then
    raise exception 'canonical_autopilot_primitive_missing';
  end if;
end $$;

-- Constitution/Founder read models must be owner-bound and unavailable to service transport.
do $$
declare d text;
begin
  if to_regprocedure('public.hq_autopilot_constitution_snapshot()') is null
     or to_regprocedure('public.hq_autopilot_founder_brief()') is null then
    raise exception 'autopilot_read_model_missing';
  end if;
  if has_function_privilege('service_role','public.hq_autopilot_constitution_snapshot()','EXECUTE')
     or has_function_privilege('service_role','public.hq_autopilot_founder_brief()','EXECUTE') then
    raise exception 'service_role_can_impersonate_founder_read_model';
  end if;
  select lower(pg_get_functiondef('public.hq_autopilot_constitution_snapshot()'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 then raise exception 'constitution_snapshot_not_owner_bound'; end if;
  select lower(pg_get_functiondef('public.hq_autopilot_founder_brief()'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 or position('verification_status=''verified''' in d)=0 then
    raise exception 'founder_brief_truth_contract_incomplete';
  end if;
end $$;

-- Owner approval, authority lifecycle and runtime controls remain human-governed.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_owner_review_objective(uuid,text,text,jsonb)'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 or position('approved_plan_hash' in d)=0 then raise exception 'owner_plan_approval_binding_missing'; end if;
  select lower(pg_get_functiondef('public.hq_workforce_owner_transition_capability_authority(uuid,text,text,jsonb)'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 then raise exception 'authority_lifecycle_not_owner_governed'; end if;
  select lower(pg_get_functiondef('public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 or position('runtime_activation_active_capability_authority_required' in d)=0 then
    raise exception 'runtime_activation_constitution_incomplete';
  end if;
end $$;

-- Consequential execution requires approved plan, authority, idempotency and verification.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure)) into d;
  if position('approved_plan' in d)=0 then raise exception 'canonical_gateway_plan_binding_missing'; end if;
  if to_regprocedure('public.hq_workforce_reserve_execution_intent(uuid,uuid,jsonb,jsonb,jsonb)') is null then raise exception 'execution_intent_gateway_missing'; end if;
  if to_regprocedure('public.hq_workforce_assign_independent_verifier(uuid,uuid)') is null then raise exception 'independent_verifier_assignment_missing'; end if;
  if has_function_privilege('service_role','public.hq_workforce_verify_consequential_execution_r14_unbound_internal(uuid,text)','EXECUTE') then
    raise exception 'unbound_self_verification_bypass_exposed';
  end if;
end $$;

-- Content remains a vertical adapter with explicit human publication boundary.
do $$
begin
  if to_regprocedure('public.hq_content_authoring_evidence_packet(uuid)') is null
     or to_regprocedure('public.hq_content_authoring_complete(uuid,uuid,uuid,text,text,jsonb,jsonb)') is null
     or to_regprocedure('public.hq_accept_content_authoring_draft(uuid)') is null then
    raise exception 'content_autopilot_vertical_contract_missing';
  end if;
  if has_function_privilege('service_role','public.hq_accept_content_authoring_draft(uuid)','EXECUTE') then
    raise exception 'content_worker_can_impersonate_owner_acceptance';
  end if;
end $$;

-- Installation is non-activating.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'autopilot_contract_runtime_not_fail_closed';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'autopilot_contract_active_authority_detected'; end if;
end $$;

rollback;
