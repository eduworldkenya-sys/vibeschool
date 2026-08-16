-- Production-readiness adversarial test: breaker denial must persist evidence without mutation.
begin;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_assert_execution_not_stopped(uuid,text)'::regprocedure)) into d;
  if position('execution_blocked' in d)=0 then raise exception 'breaker_block_event_missing'; end if;
  if position('durable_denial' in d)=0 then raise exception 'durable_breaker_marker_missing'; end if;
  if position('raise exception ''execution_circuit_breaker_tripped' in d)>0 then raise exception 'breaker_denial_still_rollback_prone'; end if;
  if position('''stopped'',true' in d)=0 then raise exception 'breaker_denial_not_returned_as_state'; end if;
end $$;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure)) into d;
  if position('outcome'',''blocked' in d)=0 then raise exception 'gateway_blocked_outcome_missing'; end if;
  if position('mutation_applied'',false' in d)=0 then raise exception 'gateway_blocked_mutation_evidence_missing'; end if;
  if position('hq_workforce_block_execution_intent' in d)=0 then raise exception 'pre_mutation_blocked_intent_transition_missing'; end if;
  if position('quota_consumed_by_blocked_attempt' in d)=0 then raise exception 'blocked_quota_accounting_missing'; end if;
end $$;

do $$
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_execution_intents' and column_name='blocked_at') then raise exception 'blocked_intent_timestamp_missing'; end if;
  if position('blocked' in pg_get_constraintdef((select oid from pg_constraint where conrelid='public.hq_workforce_execution_intents'::regclass and conname='hq_workforce_execution_intents_status_check')))=0 then raise exception 'blocked_intent_status_missing'; end if;
end $$;

rollback;
