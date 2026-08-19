-- TASK 16: authority suspension/revocation/expiry must fail closed during operation.
begin;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_assert_task_in_active_envelope(uuid)'::regprocedure)) into d;
  if position('worker_runtime_activation_envelope_authority_drift' in d)=0 then
    raise exception 'task16_selected_authority_drift_not_denied';
  end if;
  if position('g.expires_at>clock_timestamp()' in d)=0 then
    raise exception 'task16_selected_authority_expiry_not_enforced';
  end if;
  if position('worker_runtime_unselected_active_authority_detected' in d)=0 then
    raise exception 'task16_hidden_authority_runtime_denial_missing';
  end if;
end $$;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_fail_closed_envelope_authority_watchdog()'::regprocedure)) into d;
  if position('runtime_authority_drift' in d)=0 or position('hq_workforce_trip_execution_breaker' in d)=0 then
    raise exception 'task16_authority_drift_does_not_trip_containment';
  end if;
  if position('active_outside_count' in d)=0 or position('selected_active_count' in d)=0 then
    raise exception 'task16_authority_drift_evidence_missing';
  end if;
end $$;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_scheduled_bounded_runtime_queue()'::regprocedure)) into d;
  if position('hq_workforce_fail_closed_envelope_authority_watchdog' in d)=0
     or position('hq_workforce_fail_closed_runtime_watchdog' in d)=0 then
    raise exception 'task16_authority_drift_not_connected_to_scheduler';
  end if;
end $$;

rollback;