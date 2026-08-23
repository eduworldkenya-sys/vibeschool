-- Structural/adversarial proof for Laban command controls.
-- Safe to run only after the Laban command migrations; performs no runtime activation.

do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  fn text;
  canonical_def text;
  approval_bound_def text;
  authorized_inner_def text;
  n integer;
  invariant_result jsonb;
begin
  -- Required command surfaces exist.
  if to_regclass('public.hq_workforce_command_missions') is null then raise exception 'missing command missions'; end if;
  if to_regclass('public.hq_workforce_command_delegations') is null then raise exception 'missing command delegations'; end if;
  if to_regclass('public.hq_workforce_command_challenges') is null then raise exception 'missing command challenges'; end if;
  if to_regclass('public.hq_workforce_command_ledger') is null then raise exception 'missing command ledger'; end if;
  if to_regclass('public.hq_workforce_command_hypotheses') is null then raise exception 'missing counterfactual hypotheses'; end if;
  if to_regclass('public.hq_workforce_command_risk_allocations') is null then raise exception 'missing risk allocations'; end if;
  if to_regclass('public.hq_workforce_command_two_key_approvals') is null then raise exception 'missing two-key approvals'; end if;
  if to_regclass('public.hq_workforce_command_assurance_assignments') is null then raise exception 'missing assurance assignments'; end if;
  if to_regclass('public.hq_workforce_command_failover') is null then raise exception 'missing failover'; end if;
  if to_regclass('public.hq_workforce_command_learning_cases') is null then raise exception 'missing learning cases'; end if;
  if to_regclass('public.hq_workforce_architecture_invariants') is null then raise exception 'missing architecture invariants'; end if;

  -- Permanent architecture invariants are present and executable.
  select count(*) into n from public.hq_workforce_architecture_invariants
   where enabled and invariant_key in ('single_consequential_gateway','no_self_authority','no_self_certification','scheduler_no_authority','contradiction_reopens');
  if n<>5 then raise exception 'military_grade_architecture_invariants_incomplete:%',n; end if;
  invariant_result:=public.hq_workforce_command_assert_architecture_invariants();
  if invariant_result->>'decision'<>'pass' then raise exception 'architecture_invariant_runtime_assertion_failed'; end if;

  -- Legacy entrypoint must be a compatibility bridge, never another mutation implementation.
  select pg_get_functiondef('public.hq_workforce_tool_gateway_execute(uuid)'::regprocedure) into fn;
  if position('hq_workforce_consequential_execution_gateway' in fn)=0 then raise exception 'legacy_gateway_not_bridged_to_r1_4'; end if;
  if position('update public.hq_work_items' in lower(fn))>0 then raise exception 'legacy_gateway_contains_direct_consequential_mutation'; end if;

  -- Canonical gateway must preserve the complete protected R1.4 authorization chain.
  -- Later certified R1.4 migrations intentionally wrap the original gateway with durable
  -- breaker denial and owner-approved-plan binding, so authorization is verified at the
  -- protected inner implementation rather than assumed to live in the outer wrapper.
  select pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure) into canonical_def;
  select pg_get_functiondef('public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)'::regprocedure) into approval_bound_def;
  select pg_get_functiondef('public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid)'::regprocedure) into authorized_inner_def;
  if position('hq_workforce_consequential_execution_gateway_r14_approval_bound_internal' in canonical_def)=0 then
    raise exception 'canonical_gateway_missing_durable_breaker_chain';
  end if;
  if position('hq_workforce_assert_approved_plan_binding' in approval_bound_def)=0
     or position('hq_workforce_consequential_execution_gateway_r14_pre_approval_binding' in approval_bound_def)=0 then
    raise exception 'canonical_gateway_missing_approval_binding_chain';
  end if;
  if position('hq_workforce_assert_consequential_task_authorized' in authorized_inner_def)=0 then
    raise exception 'canonical_gateway_missing_r1_4_authorization';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid)','EXECUTE') then
    raise exception 'canonical_internal_gateway_exposure_detected';
  end if;

  -- Mission completion must enforce independent verifier assignment and optional two-key approval.
  select pg_get_functiondef('public.hq_workforce_command_complete_mission(uuid,text,text)'::regprocedure) into fn;
  if position('independent_verifier_assignment_required' in fn)=0 then raise exception 'mission_completion_missing_independent_verifier'; end if;
  if position('mission_two_key_approval_required' in fn)=0 then raise exception 'mission_completion_missing_two_key_gate'; end if;
  if position('commander_cannot_self_certify' in fn)=0 then raise exception 'mission_completion_allows_self_certification'; end if;

  -- Delegation must be tied to canonical active authority and cannot silently ignore expiry.
  select pg_get_functiondef('public.hq_workforce_command_assert_delegation(uuid)'::regprocedure) into fn;
  if position('delegation_authority_required' in fn)=0 then raise exception 'delegation_missing_authority_gate'; end if;
  if position('delegation_authority_expired' in fn)=0 then raise exception 'delegation_missing_expiry_gate'; end if;
  if position('permitted_worker_key' in fn)=0 then raise exception 'delegation_missing_worker_binding'; end if;

  -- Command roles are structurally separated.
  select pg_get_functiondef('public.hq_workforce_command_assert_role_separation(uuid,text,text,text,text)'::regprocedure) into fn;
  if position('command_role_separation_violation' in fn)=0 then raise exception 'role_separation_gate_missing'; end if;
  if position('command_security_observer_not_independent' in fn)=0 then raise exception 'security_observer_independence_missing'; end if;

  -- Two-key approval and failover cannot be performed by a Worker Engine worker identity.
  select pg_get_functiondef('public.hq_workforce_command_approve_two_key(uuid,text)'::regprocedure) into fn;
  if position('worker_cannot_serve_as_human_two_key_approver' in fn)=0 then raise exception 'two_key_worker_exclusion_missing'; end if;
  select pg_get_functiondef('public.hq_workforce_command_activate_failover(uuid,text,text)'::regprocedure) into fn;
  if position('failover_requires_independent_activation' in fn)=0 then raise exception 'failover_not_independently_gated'; end if;
  if position('worker_cannot_activate_command_failover' in fn)=0 then raise exception 'failover_worker_exclusion_missing'; end if;

  -- Operational assurance surfaces must exist and learning must require a terminal mission plus regression reference.
  if to_regprocedure('public.hq_workforce_command_war_room_snapshot(uuid)') is null then raise exception 'war_room_snapshot_missing'; end if;
  select pg_get_functiondef('public.hq_workforce_command_record_learning_case(uuid,text,text,text,jsonb,text,text,text)'::regprocedure) into fn;
  if position('learning_requires_terminal_mission' in fn)=0 then raise exception 'learning_terminal_gate_missing'; end if;
  if position('learning_regression_test_required' in fn)=0 then raise exception 'learning_regression_requirement_missing'; end if;

  -- Command infrastructure must leave execution fully fail-closed.
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'engine_contract_missing'; end if;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false) or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'laban_contract_must_not_activate_runtime';
  end if;

  select count(*) into n from public.hq_workforce_capability_authority_grants where status='active';
  if n<>0 then raise exception 'laban_contract_must_not_activate_authority:%',n; end if;
end $$;
