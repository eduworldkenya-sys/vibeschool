-- WE-R1.4.11 adversarial legacy-authority closure tests.
-- These tests prove that superseded R1.2/R1.3/R1.3X externally callable paths cannot
-- remain a second autonomous authority plane beside the WE-R1.4 canonical gateway.

begin;

-- Safety baseline: this suite must never run with execution activated.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'test_engine_contract_missing'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'test_requires_fail_closed_runtime';
  end if;
end $$;

-- Service role must not be able to invoke any superseded consequential authority path.
do $$
declare v_bad text[];
begin
  select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
    into v_bad
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'hq_workforce_execute_safe_queue',
      'hq_workforce_enqueue_unrouted_work',
      'hq_workforce_verify_run',
      'hq_workforce_verify_assignment',
      'hq_workforce_verify_internal_review',
      'hq_workforce_transition_decision',
      'hq_workforce_promote_learning',
      'hq_workforce_promote_learning_candidate',
      'hq_workforce_prepare_skill_promotion',
      'hq_workforce_record_skill_benchmark',
      'hq_workforce_finalize_skill_probation',
      'hq_workforce_record_positive_outcome',
      'hq_workforce_record_verified_outcome_memory',
      'hq_workforce_evaluate_candidate_gaps',
      'hq_workforce_create_gap_work_items',
      'hq_workforce_scheduled_factory_heartbeat',
      'hq_workforce_runtime_self_certify'
    )
    and has_function_privilege('service_role',p.oid,'EXECUTE');
  if v_bad is not null then
    raise exception 'legacy_service_role_authority_remains:%',v_bad;
  end if;
end $$;

-- Compatibility names must be fail-closed even if invoked by an owning/admin context.
do $$
begin
  begin
    perform public.hq_workforce_execute_safe_queue();
    raise exception 'execute_safe_queue_unexpectedly_returned';
  exception when others then
    if sqlerrm not like 'legacy_worker_execution_retired_use_we_r1_4_gateway%' then raise; end if;
  end;

  begin
    perform public.hq_workforce_transition_decision(gen_random_uuid(),'approve',null,null);
    raise exception 'legacy_transition_decision_unexpectedly_returned';
  exception when others then
    if sqlerrm not like 'legacy_worker_decision_transition_retired_use_owner_gated_decide%' then raise; end if;
  end;
end $$;

-- Direct Factory scheduler must not bypass the runtime master stop.
do $$
declare r jsonb;
begin
  r:=public.hq_workforce_scheduled_factory_heartbeat();
  if r->>'status'<>'runtime_disabled' or coalesce((r->>'factory_executed')::boolean,true) then
    raise exception 'direct_factory_scheduler_failed_master_stop:%',r;
  end if;
end $$;

-- Canonical WE-R1.4 gateway must still exist; closure cannot "solve" bypasses by
-- deleting the intended engine.
do $$
begin
  if to_regprocedure('public.hq_workforce_consequential_execution_gateway(uuid)') is null then
    raise exception 'canonical_consequential_gateway_missing';
  end if;
  if to_regprocedure('public.hq_workforce_assert_consequential_task_authorized(uuid)') is null then
    raise exception 'canonical_consequential_authority_missing';
  end if;
end $$;

rollback;
