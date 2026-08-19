-- TASK 16 activation/deactivation lifecycle contract suite.
-- This suite is non-activating and safe to run against a fail-closed candidate.
begin;

-- One authoritative state with a compatibility projection that cannot drift.
do $$
declare d text;
begin
  if not exists(
    select 1 from information_schema.columns
     where table_schema='public' and table_name='hq_workforce_engine_contract' and column_name='runtime_state'
  ) then raise exception 'task16_runtime_state_missing'; end if;
  if not exists(
    select 1 from information_schema.columns
     where table_schema='public' and table_name='hq_workforce_engine_contract' and column_name='runtime_state_version'
  ) then raise exception 'task16_runtime_state_version_missing'; end if;
  select pg_get_constraintdef(oid) into d from pg_constraint
   where conrelid='public.hq_workforce_engine_contract'::regclass
     and conname='hq_workforce_engine_contract_runtime_projection_check';
  if d is null or position('CONTROLLED_OPERATING' in d)=0 or position('runtime_execution_enabled' in d)=0 then
    raise exception 'task16_runtime_projection_not_enforced';
  end if;
end $$;

-- Activation no longer references the nonexistent effective_from column and must use
-- versioned, idempotent, owner-bound governance.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_owner_transition_runtime(text,bigint,text,smallint,smallint,text,jsonb)'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 then raise exception 'task16_owner_gate_missing'; end if;
  if position('runtime_transition_stale_state' in d)=0 then raise exception 'task16_stale_state_gate_missing'; end if;
  if position('idempotency_key' in d)=0 or position('runtime_transition_idempotency_conflict' in d)=0 then raise exception 'task16_idempotency_gate_missing'; end if;
  if position('effective_from' in d)>0 then raise exception 'task16_nonexistent_effective_from_reference_regressed'; end if;
  if position('activated_at is not null' in d)=0 or position('expires_at>clock_timestamp()' in d)=0 then
    raise exception 'task16_authority_freshness_gate_missing';
  end if;
  if position('runtime_activation_global_breaker_tripped' in d)=0 then raise exception 'task16_global_stop_activation_gate_missing'; end if;
  if position('runtime_activation_exceeds_global_policy' in d)=0 then raise exception 'task16_envelope_policy_gate_missing'; end if;
end $$;

-- The legacy versionless activation path is deliberately closed while STOP stays available.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)'::regprocedure)) into d;
  if position('runtime_activation_requires_versioned_transition' in d)=0 then
    raise exception 'task16_versionless_activation_still_possible';
  end if;
  if position('hq_workforce_owner_transition_runtime' in d)=0 or position('''stop''' in d)=0 then
    raise exception 'task16_legacy_stop_not_preserved';
  end if;
end $$;

-- Stop/global stop must revoke active authority and contain queued/running work.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_owner_transition_runtime(text,bigint,text,smallint,smallint,text,jsonb)'::regprocedure)) into d;
  if position('status=''revoked''' in d)=0 or position('revoked_at=clock_timestamp()' in d)=0 then
    raise exception 'task16_authority_cleanup_missing';
  end if;
  if position('t.status in (''queued'',''running'')' in d)=0 then raise exception 'task16_job_containment_missing'; end if;
  if position('runtime_shutdown_post_commit_verification_required' in d)=0 then
    raise exception 'task16_post_commit_shutdown_policy_missing';
  end if;
  if position('hq_workforce_trip_execution_breaker' in d)=0 then raise exception 'task16_global_stop_breaker_missing'; end if;
  if position('shadow_global_stop=true' in d)=0 then raise exception 'task16_safe_off_shadow_stop_missing'; end if;
end $$;

-- Global-stop reset is a separate owner governance act. Service transport may fail
-- closed by tripping a breaker but cannot remove the prohibition.
do $$
declare d text;
begin
  if has_function_privilege('service_role','public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb)','EXECUTE') then
    raise exception 'task16_service_can_reset_breaker';
  end if;
  if has_function_privilege('anon','public.hq_workforce_owner_reset_execution_breaker(uuid,bigint,text,jsonb)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_owner_reset_execution_breaker(uuid,bigint,text,jsonb)','EXECUTE') then
    raise exception 'task16_owner_breaker_reset_exposed';
  end if;
  if not has_function_privilege('service_role','public.hq_workforce_trip_execution_breaker(text,text,text,text,jsonb)','EXECUTE') then
    raise exception 'task16_fail_closed_breaker_trip_removed';
  end if;
  select lower(pg_get_functiondef('public.hq_workforce_owner_reset_execution_breaker(uuid,bigint,text,jsonb)'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 or position('global_breaker_reset_requires_safe_off' in d)=0
     or position('breaker_reset_stale_runtime_state' in d)=0 or position('authority_effect' in d)=0 then
    raise exception 'task16_owner_breaker_reset_governance_incomplete';
  end if;
end $$;

-- Execution boundaries still enforce runtime and breaker state server-side.
do $$
declare rd text; gd text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_assert_runtime_task_authorized(uuid)'::regprocedure)) into rd;
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure)) into gd;
  if position('worker_runtime_explicit_global_policy_required' in rd)=0 then
    raise exception 'task16_runtime_policy_wrapper_missing';
  end if;
  if position('hq_workforce_assert_execution_not_stopped' in gd)=0 then
    raise exception 'task16_gateway_breaker_enforcement_missing';
  end if;
end $$;

-- Lifecycle evidence is immutable and not forgeable by normal transports.
do $$
begin
  if to_regclass('public.hq_workforce_runtime_transition_events') is null then raise exception 'task16_transition_evidence_missing'; end if;
  if has_table_privilege('service_role','public.hq_workforce_runtime_transition_events','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_runtime_transition_events','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_runtime_transition_events','DELETE') then
    raise exception 'task16_service_can_forge_transition_evidence';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_transition_runtime(text,bigint,text,smallint,smallint,text,jsonb)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_owner_global_stop(bigint,text,text,jsonb)','EXECUTE') then
    raise exception 'task16_service_can_impersonate_owner_runtime_control';
  end if;
  if has_function_privilege('anon','public.hq_workforce_owner_transition_runtime(text,bigint,text,smallint,smallint,text,jsonb)','EXECUTE') then
    raise exception 'task16_anon_runtime_transition_exposed';
  end if;
end $$;

-- Installation/candidate must remain safe OFF with no active temporary authority.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'task16_runtime_contract_missing'; end if;
  if ec.runtime_state<>'OFF' or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.shadow_enabled,false) or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'task16_candidate_not_safe_off';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'task16_candidate_has_active_capability_authority'; end if;
end $$;

rollback;
