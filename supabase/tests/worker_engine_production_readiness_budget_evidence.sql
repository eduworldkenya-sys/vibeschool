-- Production-readiness adversarial test: execution budget accounting must be immutable and execution-bound.
begin;

do $$
declare d text;
begin
  if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='hq_workforce_execution_budget_events') then raise exception 'execution_budget_evidence_table_missing'; end if;
  if has_table_privilege('service_role','public.hq_workforce_execution_budget_events','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_execution_budget_events','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_execution_budget_events','DELETE') then
    raise exception 'service_role_can_mutate_execution_budget_evidence';
  end if;
  select lower(pg_get_functiondef('public.hq_workforce_capture_execution_budget_evidence()'::regprocedure)) into d;
  if position('execution_envelope' in d)=0 and position('execution_id' in d)=0 then raise exception 'budget_evidence_not_execution_bound'; end if;
  if position('pre_reservation' in d)=0 or position('committed' in d)=0 or position('blocked' in d)=0 then raise exception 'budget_lifecycle_evidence_incomplete'; end if;
  if position('actual_consumed_amount' in d)=0 then raise exception 'actual_budget_consumption_missing'; end if;
end $$;

do $$
begin
  if not exists(select 1 from pg_trigger where tgname='trg_hq_workforce_capture_execution_budget_evidence' and not tgisinternal) then raise exception 'budget_evidence_capture_trigger_missing'; end if;
  if not exists(select 1 from pg_trigger where tgname='trg_hq_workforce_execution_budget_events_immutable' and not tgisinternal) then raise exception 'budget_evidence_immutability_trigger_missing'; end if;
end $$;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_execution_budget_events_immutable()'::regprocedure)) into d;
  if position('append_only' in d)=0 then raise exception 'budget_evidence_not_append_only'; end if;
end $$;

rollback;
