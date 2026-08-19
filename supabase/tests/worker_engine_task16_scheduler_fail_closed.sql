-- TASK 16: scheduler/background execution fail-closed contract.
-- Non-activating static certification.
begin;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_scheduled_bounded_runtime_queue()'::regprocedure)) into d;
  if position('hq_workforce_execute_bounded_runtime_queue' in d)=0 then
    raise exception 'task16_scheduler_does_not_use_bounded_runtime_queue';
  end if;
end $$;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_execute_bounded_runtime_queue(integer,integer)'::regprocedure)) into d;
  if position('runtime_disabled' in d)=0
     or position('runtime_execution_enabled' in d)=0
     or position('runtime_autonomy_level' in d)=0
     or position('runtime_max_risk' in d)=0 then
    raise exception 'task16_scheduler_runtime_gate_missing';
  end if;
  if position('hq_workforce_consequential_execution_gateway' in d)=0 then
    raise exception 'task16_scheduler_bypasses_consequential_gateway';
  end if;
end $$;

-- The consequential gateway must independently enforce emergency-stop state even if
-- queue admission was evaluated immediately before a concurrent breaker trip.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure)) into d;
  if position('hq_workforce_assert_execution_not_stopped' in d)=0 then
    raise exception 'task16_gateway_global_stop_enforcement_missing';
  end if;
  if position('pre_reservation' in d)=0 or position('pre_mutation' in d)=0 then
    raise exception 'task16_gateway_does_not_recheck_breaker_before_mutation';
  end if;
end $$;

rollback;
