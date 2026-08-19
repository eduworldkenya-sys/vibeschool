-- TASK 16: OFF-state Global Stop must neutralize staged authority.
begin;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_fail_closed_off_state_authority_cleanup()'::regprocedure)) into d;
  if position('scope_type=''global''' in d)=0 or position('status=''tripped''' in d)=0 then
    raise exception 'task16_off_state_cleanup_global_breaker_gate_missing';
  end if;
  if position('where status=''active''' in d)=0 or position('status=''revoked''' in d)=0 then
    raise exception 'task16_off_state_cleanup_revocation_missing';
  end if;
  if position('off_state_global_stop_authority_cleanup_failed' in d)=0 then
    raise exception 'task16_off_state_cleanup_zero_authority_proof_missing';
  end if;
  if position('t.status in (''queued'',''running'')' in d)=0 then
    raise exception 'task16_off_state_cleanup_job_containment_missing';
  end if;
  if position('runtime_shutdown_post_commit_verification_required' in d)=0 then
    raise exception 'task16_off_state_cleanup_post_commit_policy_missing';
  end if;
  if position('actor_kind' in d)=0 or position('''system''' in d)=0 then
    raise exception 'task16_off_state_cleanup_system_evidence_missing';
  end if;
end $$;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_scheduled_bounded_runtime_queue()'::regprocedure)) into d;
  if position('hq_workforce_fail_closed_off_state_authority_cleanup' in d)=0
     or position('hq_workforce_fail_closed_runtime_watchdog' in d)=0
     or position('hq_workforce_execute_bounded_runtime_queue' in d)=0 then
    raise exception 'task16_scheduler_safety_order_incomplete';
  end if;
end $$;

do $$
begin
  if not has_function_privilege('service_role','public.hq_workforce_fail_closed_off_state_authority_cleanup()','EXECUTE') then
    raise exception 'task16_scheduler_cannot_run_off_state_cleanup';
  end if;
  if has_function_privilege('authenticated','public.hq_workforce_fail_closed_off_state_authority_cleanup()','EXECUTE')
     or has_function_privilege('anon','public.hq_workforce_fail_closed_off_state_authority_cleanup()','EXECUTE') then
    raise exception 'task16_off_state_cleanup_exposed_to_client';
  end if;
end $$;

rollback;