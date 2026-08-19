-- WE-R1.4.5 compensation / rollback certification.
begin;

do $$
declare r text;
begin
  if to_regclass('public.hq_workforce_execution_compensations') is null then raise exception 'execution compensation table missing'; end if;
  if not (select relrowsecurity from pg_class where oid='public.hq_workforce_execution_compensations'::regclass) then raise exception 'execution compensation RLS disabled'; end if;
  foreach r in array array['public','anon','authenticated'] loop
    if has_table_privilege(r,'public.hq_workforce_execution_compensations','SELECT')
       or has_table_privilege(r,'public.hq_workforce_execution_compensations','INSERT')
       or has_table_privilege(r,'public.hq_workforce_execution_compensations','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_execution_compensations','DELETE') then
      raise exception 'unexpected execution-compensation privilege for %',r;
    end if;
  end loop;
  if not has_table_privilege('service_role','public.hq_workforce_execution_compensations','SELECT') then raise exception 'service_role compensation read missing'; end if;
  if has_table_privilege('service_role','public.hq_workforce_execution_compensations','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_execution_compensations','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_execution_compensations','DELETE') then
    raise exception 'service_role must not directly mutate compensation evidence';
  end if;
end $$;

do $$
declare d text;
begin
  if to_regprocedure('public.hq_workforce_compensate_consequential_execution(uuid,text,text)') is null then raise exception 'consequential compensation function missing'; end if;
  select lower(pg_get_functiondef('public.hq_workforce_compensate_consequential_execution(uuid,text,text)'::regprocedure)) into d;
  if position('compensation_requires_failed_verification' in d)=0 then raise exception 'failed-verification gate missing'; end if;
  if position('compensation_recovery_snapshot_missing' in d)=0 then raise exception 'authoritative recovery snapshot gate missing'; end if;
  -- Exact-state hardening is the executable compare-and-compensate contract. Certify
  -- semantics rather than a comment string so forward lineage repairs cannot fail CI
  -- merely because PostgreSQL does not preserve comments inside pg_get_functiondef().
  if position('v_observed is distinct from i.expected_after_state' in d)=0 then raise exception 'compare-and-compensate exact-state guard missing'; end if;
  if position('for update' in d)=0 then raise exception 'compare-and-compensate row lock missing'; end if;
  if position('current_state_diverged' in d)=0 then raise exception 'divergence escalation missing'; end if;
  if position('conflict_escalated' in d)=0 then raise exception 'compensation conflict outcome missing'; end if;
  if position('mutation_applied' in d)=0 then raise exception 'compensation mutation evidence missing'; end if;
end $$;

-- R1.4 composes three gateway layers: durable breaker wrapper -> approval-bound wrapper ->
-- recovery-aware implementation. Certify the full chain and prove wrappers are not externally callable.
do $$
declare canonical_d text; approval_d text; recovery_d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure)) into canonical_d;
  if position('hq_workforce_consequential_execution_gateway_r14_approval_bound_internal' in canonical_d)=0 then
    raise exception 'canonical gateway does not delegate to approval-bound wrapper';
  end if;

  if to_regprocedure('public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)') is null then
    raise exception 'approval-bound gateway wrapper missing';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)','EXECUTE') then
    raise exception 'approval-bound gateway wrapper externally callable';
  end if;
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway_r14_approval_bound_internal(uuid)'::regprocedure)) into approval_d;
  if position('hq_workforce_consequential_execution_gateway_r14_pre_approval_binding' in approval_d)=0 then
    raise exception 'approval-bound wrapper does not delegate to recovery implementation';
  end if;

  if to_regprocedure('public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid)') is null then
    raise exception 'recovery-aware gateway implementation missing';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid)','EXECUTE') then
    raise exception 'recovery-aware gateway implementation externally callable';
  end if;
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid)'::regprocedure)) into recovery_d;
  if position('authoritative_before_state' in recovery_d)=0 or position('expected_after_state' in recovery_d)=0 then raise exception 'gateway recovery snapshot persistence missing'; end if;
  if position('for update' in recovery_d)=0 then raise exception 'gateway row-lock proof missing'; end if;
  if position('execution_recovery_snapshot_not_recorded' in recovery_d)=0 then raise exception 'gateway snapshot fail-closed assertion missing'; end if;
end $$;
