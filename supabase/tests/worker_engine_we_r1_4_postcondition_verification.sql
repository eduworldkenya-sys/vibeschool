-- WE-R1.4.4 independent postcondition verification certification.
begin;

do $$
declare r text;
begin
  if to_regclass('public.hq_workforce_execution_verifications') is null then raise exception 'execution verification table missing'; end if;
  if not (select relrowsecurity from pg_class where oid='public.hq_workforce_execution_verifications'::regclass) then raise exception 'execution verification RLS disabled'; end if;
  foreach r in array array['public','anon','authenticated'] loop
    if has_table_privilege(r,'public.hq_workforce_execution_verifications','SELECT')
       or has_table_privilege(r,'public.hq_workforce_execution_verifications','INSERT')
       or has_table_privilege(r,'public.hq_workforce_execution_verifications','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_execution_verifications','DELETE') then
      raise exception 'unexpected execution-verification privilege for %',r;
    end if;
  end loop;
  if not has_table_privilege('service_role','public.hq_workforce_execution_verifications','SELECT') then raise exception 'service_role verification read missing'; end if;
  if has_table_privilege('service_role','public.hq_workforce_execution_verifications','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_execution_verifications','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_execution_verifications','DELETE') then
    raise exception 'service_role must not directly mutate verification evidence';
  end if;
end $$;

do $$
declare d text;
begin
  if to_regprocedure('public.hq_workforce_verify_consequential_execution(uuid,text)') is null then raise exception 'consequential verifier missing'; end if;
  select lower(pg_get_functiondef('public.hq_workforce_verify_consequential_execution(uuid,text)'::regprocedure)) into d;
  if position('worker_cannot_verify_own_execution' in d)=0 then raise exception 'independent verifier gate missing'; end if;
  if position('verification_execution_intent_not_committed' in d)=0 then raise exception 'committed intent gate missing'; end if;
  if position('verification_contract_missing' in d)=0 then raise exception 'verification contract gate missing'; end if;
  if position('negative evidence is deliberately persisted' in d)=0 then raise exception 'negative evidence persistence contract missing'; end if;
  if position('execution_intent_id' in d)=0 or position('authority_grant_id' in d)=0 or position('plan_step_id' in d)=0 then raise exception 'verification lineage comparison incomplete'; end if;
end $$;

-- Verification receipts are immutable after insert.
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgrelid='public.hq_workforce_execution_verifications'::regclass
      and tgname='trg_hq_workforce_execution_verification_immutable' and not tgisinternal
  ) then raise exception 'verification immutability trigger missing'; end if;
end $$;

-- Invalid verification must fail before evidence mutation.
do $$
begin
  begin
    perform public.hq_workforce_verify_consequential_execution(gen_random_uuid(),'verifier_test');
    raise exception 'missing task verification accepted';
  exception when others then
    if sqlerrm='missing task verification accepted' then raise; end if;
  end;
end $$;

-- Engineering gate remains fail-closed.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'engine contract missing'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'R1.4.4 changed runtime safety boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'R1.4.4 introduced active capability authority'; end if;
end $$;

rollback;
