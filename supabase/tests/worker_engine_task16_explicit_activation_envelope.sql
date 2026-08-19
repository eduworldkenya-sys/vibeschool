-- TASK 16 explicit activation envelope contract suite.
-- Non-activating static certification; full transactional simulation remains a hold-gated disposable-DB gate.
begin;

do $$
declare d text;
begin
  if to_regclass('public.hq_workforce_runtime_activation_envelopes') is null then raise exception 'task16_activation_envelope_table_missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_engine_contract' and column_name='runtime_activation_envelope_id') then
    raise exception 'task16_engine_envelope_pointer_missing';
  end if;
  select pg_get_constraintdef(oid) into d from pg_constraint
   where conrelid='public.hq_workforce_engine_contract'::regclass
     and conname='hq_workforce_engine_contract_envelope_projection_check';
  if d is null or position('runtime_activation_envelope_id' in d)=0 or position('CONTROLLED_OPERATING' in d)=0 then
    raise exception 'task16_runtime_envelope_projection_not_enforced';
  end if;
end $$;

-- Unscoped activation is closed; explicit v2 requires exact grant IDs and duration.
do $$
declare oldd text; d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_owner_transition_runtime(text,bigint,text,smallint,smallint,text,jsonb)'::regprocedure)) into oldd;
  if position('runtime_activation_requires_explicit_envelope' in oldd)=0 then raise exception 'task16_unscoped_activation_open'; end if;

  select lower(pg_get_functiondef('public.hq_workforce_owner_transition_runtime_v2(text,bigint,text,smallint,smallint,uuid[],integer,text,jsonb)'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 then raise exception 'task16_v2_owner_gate_missing'; end if;
  if position('runtime_transition_stale_state' in d)=0 then raise exception 'task16_v2_stale_state_gate_missing'; end if;
  if position('runtime_transition_idempotency_conflict' in d)=0 then raise exception 'task16_v2_idempotency_missing'; end if;
  if position('runtime_activation_explicit_authority_required' in d)=0 then raise exception 'task16_exact_grant_set_required_missing'; end if;
  if position('p_duration_minutes not between 1 and 60' in d)=0 then raise exception 'task16_short_duration_bound_missing'; end if;
  if position('permitted_worker_key is not null' in d)=0 then raise exception 'task16_worker_scope_required_missing'; end if;
  if position('hq_workforce_runtime_capability_allowlist' in d)=0 or position('capability_version' in d)=0 then raise exception 'task16_capability_version_allowlist_missing'; end if;
  if position('hq_workforce_execution_budgets' in d)=0 or position('runtime_activation_budget_capacity_required' in d)=0 then raise exception 'task16_activation_budget_preflight_missing'; end if;
  if position('runtime_activation_global_breaker_tripped' in d)=0 then raise exception 'task16_global_stop_activation_priority_missing'; end if;
end $$;

-- Actual runtime admission must require the task grant to be inside the active envelope.
do $$
declare d text; rd text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_assert_task_in_active_envelope(uuid)'::regprocedure)) into d;
  if position('controlled_operating' in d)=0 or position('runtime_activation_envelope_id' in d)=0 then raise exception 'task16_active_envelope_state_gate_missing'; end if;
  if position('e.expires_at<=clock_timestamp()' in d)=0 then raise exception 'task16_envelope_expiry_gate_missing'; end if;
  if position('autonomous_authority_grant_id=any(e.authority_grant_ids)' in d)=0 then raise exception 'task16_task_grant_not_bound_to_envelope'; end if;
  if position('runtime_state_version' in d)=0 then raise exception 'task16_envelope_version_binding_missing'; end if;

  select lower(pg_get_functiondef('public.hq_workforce_assert_runtime_task_authorized(uuid)'::regprocedure)) into rd;
  if position('hq_workforce_assert_task_in_active_envelope' in rd)=0 then raise exception 'task16_runtime_admission_bypasses_envelope'; end if;
  if position('hq_workforce_assert_runtime_task_authorized_r12_internal' in rd)=0 then raise exception 'task16_existing_runtime_governance_not_preserved'; end if;
end $$;

-- Envelope lifecycle/evidence cannot be forged through ordinary transports.
do $$
declare d text;
begin
  if has_table_privilege('authenticated','public.hq_workforce_runtime_activation_envelopes','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_runtime_activation_envelopes','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_runtime_activation_envelopes','UPDATE') then
    raise exception 'task16_activation_envelope_direct_mutation_exposed';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_transition_runtime_v2(text,bigint,text,smallint,smallint,uuid[],integer,text,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.hq_workforce_owner_transition_runtime_v2(text,bigint,text,smallint,smallint,uuid[],integer,text,jsonb)','EXECUTE') then
    raise exception 'task16_activation_v2_exposed_to_non_owner_transport';
  end if;
  select lower(pg_get_functiondef('public.hq_workforce_guard_runtime_activation_envelope_immutable()'::regprocedure)) into d;
  if position('runtime_activation_envelope_terminal' in d)=0
     or position('runtime_activation_envelope_governance_fields_immutable' in d)=0
     or position('old.activation_event_id is null' in d)=0 then
    raise exception 'task16_activation_envelope_evidence_seal_incomplete';
  end if;
end $$;

-- Stop must close the current envelope, revoke authority, prove zero active grants,
-- clear the contract pointer and preserve post-commit uncertainty.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_owner_transition_runtime_v2(text,bigint,text,smallint,smallint,uuid[],integer,text,jsonb)'::regprocedure)) into d;
  if position('runtime_shutdown_authority_cleanup_failed' in d)=0 then raise exception 'task16_zero_active_authority_proof_missing'; end if;
  if position('global_stopped' in d)=0 or position('status=case when v_action=''global_stop''' in d)=0 then raise exception 'task16_envelope_shutdown_state_missing'; end if;
  if position('runtime_activation_envelope_id=null' in d)=0 then raise exception 'task16_engine_envelope_pointer_not_cleared'; end if;
  if position('runtime_shutdown_post_commit_verification_required' in d)=0 then raise exception 'task16_post_commit_uncertainty_lost'; end if;
end $$;

rollback;
