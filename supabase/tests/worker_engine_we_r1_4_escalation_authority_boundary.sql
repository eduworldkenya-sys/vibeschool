-- WE-R1.4.6 adversarial proof: escalation/outcome evidence cannot become authority or a mutation gateway.
begin;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_classify_execution_outcome(uuid,text)'::regprocedure)) into d;

  if position('update public.hq_work_items' in d)>0
     or position('delete from public.hq_work_items' in d)>0
     or position('insert into public.hq_work_items' in d)>0 then
    raise exception 'outcome classifier contains governed-resource mutation path';
  end if;

  if position('insert into public.hq_workforce_capability_authority_grants' in d)>0
     or position('update public.hq_workforce_capability_authority_grants' in d)>0
     or position('delete from public.hq_workforce_capability_authority_grants' in d)>0 then
    raise exception 'outcome classifier can mutate capability authority';
  end if;

  if position('hq_workforce_consequential_execution_gateway(' in d)>0 then
    raise exception 'outcome classifier can invoke consequential gateway';
  end if;
  if position('hq_workforce_compensate_consequential_execution(' in d)>0 then
    raise exception 'outcome classifier can invoke compensation mutation';
  end if;
  if position('hq_workforce_issue_capability_authority' in d)>0
     or position('hq_workforce_activate_capability_authority' in d)>0 then
    raise exception 'outcome classifier can issue or activate authority';
  end if;
end $$;

-- Existing authorization must remain independent of outcome/escalation evidence.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_assert_consequential_task_authorized(uuid)'::regprocedure)) into d;
  if position('hq_workforce_execution_outcomes' in d)>0
     or position('hq_workforce_execution_escalations' in d)>0 then
    raise exception 'escalation/outcome evidence influences consequential authorization';
  end if;
end $$;

-- No product role can write escalation evidence or invoke its immutability helper.
do $$
declare r text;
begin
  foreach r in array array['public','anon','authenticated','service_role'] loop
    if has_table_privilege(r,'public.hq_workforce_execution_escalations','INSERT')
       or has_table_privilege(r,'public.hq_workforce_execution_escalations','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_execution_escalations','DELETE') then
      raise exception 'role % has escalation mutation privilege',r;
    end if;
    if has_function_privilege(r,'public.hq_workforce_guard_execution_escalation_immutable()','EXECUTE') then
      raise exception 'role % can invoke escalation trigger helper',r;
    end if;
  end loop;
end $$;

-- Retry policy is fail-closed at this gate: no persisted post-commit outcome may request retry.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_classify_execution_outcome(uuid,text)'::regprocedure)) into d;
  if position('retry_allowed' in d)=0 or position('max_retry_attempts' in d)=0 then
    raise exception 'outcome retry disposition evidence missing';
  end if;
  if exists (
    select 1 from public.hq_workforce_execution_outcomes
     where retry_allowed or max_retry_attempts<>0
  ) then raise exception 'R1.4.6 contains an autonomously retryable persisted outcome'; end if;
end $$;

rollback;
