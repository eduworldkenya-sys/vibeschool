-- Production-readiness adversarial test: critical execution evidence must have event-driven alerts.
begin;

do $$
declare d text; n integer;
begin
  select lower(pg_get_functiondef('public.hq_workforce_emit_execution_alert()'::regprocedure)) into d;
  foreach n in array array[1] loop null; end loop;
  if position('execution_verification_failed' in d)=0 then raise exception 'verification_failure_alert_missing'; end if;
  if position('execution_compensation_conflict' in d)=0 then raise exception 'compensation_conflict_alert_missing'; end if;
  if position('execution_escalation_created' in d)=0 then raise exception 'escalation_alert_missing'; end if;
  if position('execution_blocked_by_breaker' in d)=0 then raise exception 'breaker_block_alert_missing'; end if;
  if position('execution_id' in d)=0 then raise exception 'alert_execution_correlation_missing'; end if;
end $$;

do $$
declare missing text[];
begin
  select array_agg(x.name) into missing
  from (values
    ('trg_hq_workforce_alert_verification'),
    ('trg_hq_workforce_alert_compensation'),
    ('trg_hq_workforce_alert_escalation'),
    ('trg_hq_workforce_alert_breaker')
  ) x(name)
  where not exists(select 1 from pg_trigger t where t.tgname=x.name and not t.tgisinternal);
  if missing is not null then raise exception 'execution_alert_triggers_missing:%',missing; end if;
end $$;

rollback;
