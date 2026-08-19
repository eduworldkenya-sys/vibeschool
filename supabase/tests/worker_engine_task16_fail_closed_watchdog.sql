-- TASK 16 fail-closed watchdog contract suite.
begin;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_fail_closed_runtime_watchdog()'::regprocedure)) into d;
  if position('runtime_activation_envelope_expired' in d)=0 then raise exception 'task16_expiry_watchdog_missing'; end if;
  if position('global_breaker_fail_closed_watchdog' in d)=0 then raise exception 'task16_global_breaker_watchdog_missing'; end if;
  if position('runtime_envelope_integrity_fail_closed' in d)=0 then raise exception 'task16_envelope_integrity_watchdog_missing'; end if;
  if position('status=''revoked''' in d)=0 or position('runtime_watchdog_authority_cleanup_failed' in d)=0 then
    raise exception 'task16_watchdog_authority_cleanup_missing';
  end if;
  if position('t.status in (''queued'',''running'')' in d)=0 then raise exception 'task16_watchdog_job_containment_missing'; end if;
  if position('runtime_shutdown_post_commit_verification_required' in d)=0 then raise exception 'task16_watchdog_post_commit_policy_missing'; end if;
  if position('runtime_state=''off''' in d)=0 or position('runtime_activation_envelope_id=null' in d)=0 then
    raise exception 'task16_watchdog_safe_off_transition_missing';
  end if;
  if position('actor_kind' in d)=0 or position('''system''' in d)=0 then raise exception 'task16_watchdog_system_evidence_missing'; end if;
end $$;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_scheduled_bounded_runtime_queue()'::regprocedure)) into d;
  if position('hq_workforce_fail_closed_runtime_watchdog' in d)=0 then raise exception 'task16_scheduler_watchdog_missing'; end if;
  if position('hq_workforce_execute_bounded_runtime_queue' in d)=0 then raise exception 'task16_scheduler_queue_path_removed'; end if;
  if position('exception when others' in d)=0 or position('failed_closed' in d)=0 then raise exception 'task16_scheduler_exception_fail_closed_missing'; end if;
end $$;

-- Service may invoke the safety-reducing watchdog, but not safety-increasing controls.
do $$
begin
  if not has_function_privilege('service_role','public.hq_workforce_fail_closed_runtime_watchdog()','EXECUTE') then
    raise exception 'task16_service_watchdog_not_callable';
  end if;
  if has_function_privilege('authenticated','public.hq_workforce_fail_closed_runtime_watchdog()','EXECUTE')
     or has_function_privilege('anon','public.hq_workforce_fail_closed_runtime_watchdog()','EXECUTE') then
    raise exception 'task16_watchdog_exposed_to_client_transport';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_transition_runtime_v2(text,bigint,text,smallint,smallint,uuid[],integer,text,jsonb)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_owner_reset_execution_breaker(uuid,bigint,text,jsonb)','EXECUTE') then
    raise exception 'task16_service_transport_can_increase_authority';
  end if;
end $$;

-- System evidence is permitted only with NULL actor_id; owner evidence always carries
-- the authenticated owner identity.
do $$
declare d text;
begin
  select pg_get_constraintdef(oid) into d from pg_constraint
   where conrelid='public.hq_workforce_runtime_transition_events'::regclass
     and conname='hq_workforce_runtime_transition_events_actor_check';
  if d is null or position('actor_kind' in d)=0 or position('actor_id IS NULL' in d)=0 or position('actor_id IS NOT NULL' in d)=0 then
    raise exception 'task16_transition_actor_provenance_constraint_missing';
  end if;
end $$;

rollback;
