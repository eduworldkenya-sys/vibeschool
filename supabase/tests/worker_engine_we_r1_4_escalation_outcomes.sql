-- WE-R1.4.6 escalation + deterministic outcome classification certification.
begin;

do $$
declare r text;
begin
  if to_regclass('public.hq_workforce_execution_outcomes') is null then raise exception 'execution outcomes table missing'; end if;
  if to_regclass('public.hq_workforce_execution_escalations') is null then raise exception 'execution escalations table missing'; end if;
  if not (select relrowsecurity from pg_class where oid='public.hq_workforce_execution_outcomes'::regclass) then raise exception 'execution outcomes RLS disabled'; end if;
  if not (select relrowsecurity from pg_class where oid='public.hq_workforce_execution_escalations'::regclass) then raise exception 'execution escalations RLS disabled'; end if;

  foreach r in array array['public','anon','authenticated'] loop
    if has_table_privilege(r,'public.hq_workforce_execution_outcomes','SELECT')
       or has_table_privilege(r,'public.hq_workforce_execution_outcomes','INSERT')
       or has_table_privilege(r,'public.hq_workforce_execution_outcomes','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_execution_outcomes','DELETE') then
      raise exception 'unexpected execution-outcome privilege for %',r;
    end if;
    if has_table_privilege(r,'public.hq_workforce_execution_escalations','SELECT')
       or has_table_privilege(r,'public.hq_workforce_execution_escalations','INSERT')
       or has_table_privilege(r,'public.hq_workforce_execution_escalations','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_execution_escalations','DELETE') then
      raise exception 'unexpected execution-escalation privilege for %',r;
    end if;
  end loop;

  if not has_table_privilege('service_role','public.hq_workforce_execution_outcomes','SELECT')
     or not has_table_privilege('service_role','public.hq_workforce_execution_escalations','SELECT') then
    raise exception 'service_role outcome/escalation read missing';
  end if;
  if has_table_privilege('service_role','public.hq_workforce_execution_outcomes','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_execution_outcomes','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_execution_outcomes','DELETE')
     or has_table_privilege('service_role','public.hq_workforce_execution_escalations','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_execution_escalations','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_execution_escalations','DELETE') then
    raise exception 'service_role must not directly mutate outcome/escalation evidence';
  end if;
end $$;

-- Evidence rows must be append-only and at most one terminal outcome may exist per intent.
do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgrelid='public.hq_workforce_execution_outcomes'::regclass
       and tgname='trg_hq_workforce_execution_outcome_immutable' and not tgisinternal
  ) then raise exception 'outcome immutability trigger missing'; end if;
  if not exists (
    select 1 from pg_trigger
     where tgrelid='public.hq_workforce_execution_escalations'::regclass
       and tgname='trg_hq_workforce_execution_escalation_immutable' and not tgisinternal
  ) then raise exception 'escalation immutability trigger missing'; end if;
  if not exists (
    select 1 from pg_indexes
     where schemaname='public' and tablename='hq_workforce_execution_outcomes'
       and indexname='hq_workforce_execution_outcomes_one_terminal_idx'
       and lower(indexdef) like '%where terminal%'
  ) then raise exception 'single terminal-outcome invariant missing'; end if;
end $$;

-- Classifier must derive outcome from authoritative evidence only.
do $$
declare d text;
begin
  if to_regprocedure('public.hq_workforce_classify_execution_outcome(uuid,text)') is null then
    raise exception 'execution outcome classifier missing';
  end if;
  select lower(pg_get_functiondef('public.hq_workforce_classify_execution_outcome(uuid,text)'::regprocedure)) into d;
  if position('for update' in d)=0 then raise exception 'classifier serialization lock missing'; end if;
  if position('outcome_execution_lineage_mismatch' in d)=0 then raise exception 'execution lineage validation missing'; end if;
  if position('verification_lineage_mismatch' in d)=0 then raise exception 'verification lineage validation missing'; end if;
  if position('compensation_lineage_mismatch' in d)=0 then raise exception 'compensation lineage validation missing'; end if;
  if position('recovery_required' in d)=0 then raise exception 'failed-verification recovery state missing'; end if;
  if position('verified_success' in d)=0 then raise exception 'verified success classification missing'; end if;
  if position('recovered_compensated' in d)=0 then raise exception 'compensated recovery classification missing'; end if;
  if position('state_diverged' in d)=0 then raise exception 'state-divergence classification missing'; end if;
  if position('compensation_denied' in d)=0 then raise exception 'compensation-denied classification missing'; end if;
  if position('ambiguous_evidence' in d)=0 then raise exception 'ambiguous-evidence classification missing'; end if;
  if position($q$'retry_allowed',false$q$ in d)=0 or position($q$'max_retry_attempts',0$q$ in d)=0 then
    raise exception 'post-commit no-autonomous-retry contract missing';
  end if;
  if position($q$'authority_effect','none'$q$ in d)=0 or position($q$'mutation_authority_granted',false$q$ in d)=0 then
    raise exception 'escalation evidence-only authority assertion missing';
  end if;
end $$;

-- Product roles cannot invoke the privileged classifier; service_role can only invoke the governed function.
do $$
begin
  if has_function_privilege('public','public.hq_workforce_classify_execution_outcome(uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.hq_workforce_classify_execution_outcome(uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.hq_workforce_classify_execution_outcome(uuid,text)','EXECUTE') then
    raise exception 'outcome classifier exposed to product roles';
  end if;
  if not has_function_privilege('service_role','public.hq_workforce_classify_execution_outcome(uuid,text)','EXECUTE') then
    raise exception 'governed outcome classifier execute grant missing';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_guard_execution_outcome_immutable()','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_guard_execution_escalation_immutable()','EXECUTE') then
    raise exception 'immutability trigger helper directly executable';
  end if;
end $$;

-- Missing/invalid targets must fail without creating outcome or escalation evidence.
do $$
declare before_o bigint; after_o bigint; before_e bigint; after_e bigint;
begin
  select count(*) into before_o from public.hq_workforce_execution_outcomes;
  select count(*) into before_e from public.hq_workforce_execution_escalations;
  begin
    perform public.hq_workforce_classify_execution_outcome(gen_random_uuid(),'r1_4_6_adversarial_classifier');
    raise exception 'missing task classification accepted';
  exception when others then
    if sqlerrm='missing task classification accepted' then raise; end if;
  end;
  select count(*) into after_o from public.hq_workforce_execution_outcomes;
  select count(*) into after_e from public.hq_workforce_execution_escalations;
  if after_o<>before_o or after_e<>before_e then raise exception 'invalid classification wrote evidence'; end if;
end $$;

-- Schema itself forbids unbounded or implicit retries and human intervention without escalation.
do $$
declare defs text;
begin
  select lower(string_agg(pg_get_constraintdef(oid),' | ')) into defs
    from pg_constraint where conrelid='public.hq_workforce_execution_outcomes'::regclass and contype='c';
  if position('max_retry_attempts >= 0' in defs)=0 and position('max_retry_attempts between 0 and 3' in defs)=0 then
    raise exception 'bounded retry constraint missing';
  end if;
  if position('retry_allowed' in defs)=0 or position('human_intervention_required' in defs)=0 or position('escalation_required' in defs)=0 then
    raise exception 'retry/escalation consistency constraints missing';
  end if;
end $$;

-- Engineering state remains fail closed.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'engine contract missing'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'R1.4.6 changed runtime safety boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'R1.4.6 introduced active capability authority'; end if;
end $$;

rollback;
