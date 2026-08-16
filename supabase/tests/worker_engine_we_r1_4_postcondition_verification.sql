-- WE-R1.4.4+ independent postcondition verification certification.
begin;

do $$
declare r text;
begin
  if to_regclass('public.hq_workforce_execution_verifications') is null then raise exception 'execution verification table missing'; end if;
  if to_regclass('public.hq_workforce_verifier_assignments') is null then raise exception 'verifier assignment table missing'; end if;
  if not (select relrowsecurity from pg_class where oid='public.hq_workforce_execution_verifications'::regclass) then raise exception 'execution verification RLS disabled'; end if;
  if not (select relrowsecurity from pg_class where oid='public.hq_workforce_verifier_assignments'::regclass) then raise exception 'verifier assignment RLS disabled'; end if;
  foreach r in array array['public','anon','authenticated'] loop
    if has_table_privilege(r,'public.hq_workforce_execution_verifications','SELECT')
       or has_table_privilege(r,'public.hq_workforce_execution_verifications','INSERT')
       or has_table_privilege(r,'public.hq_workforce_execution_verifications','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_execution_verifications','DELETE') then
      raise exception 'unexpected execution-verification privilege for %',r;
    end if;
    if has_table_privilege(r,'public.hq_workforce_verifier_assignments','SELECT')
       or has_table_privilege(r,'public.hq_workforce_verifier_assignments','INSERT')
       or has_table_privilege(r,'public.hq_workforce_verifier_assignments','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_verifier_assignments','DELETE') then
      raise exception 'unexpected verifier-assignment privilege for %',r;
    end if;
  end loop;
  if not has_table_privilege('service_role','public.hq_workforce_execution_verifications','SELECT') then raise exception 'service_role verification read missing'; end if;
  if has_table_privilege('service_role','public.hq_workforce_execution_verifications','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_execution_verifications','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_execution_verifications','DELETE') then
    raise exception 'service_role must not directly mutate verification evidence';
  end if;
  if not has_table_privilege('service_role','public.hq_workforce_verifier_assignments','SELECT')
     or has_table_privilege('service_role','public.hq_workforce_verifier_assignments','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_verifier_assignments','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_verifier_assignments','DELETE') then
    raise exception 'verifier assignment evidence privilege contract invalid';
  end if;
end $$;

-- Public verifier is assignment-bound; deterministic comparison remains in an inaccessible body.
do $$
declare wrapper text; inner_d text; assign_d text;
begin
  if to_regprocedure('public.hq_workforce_verify_consequential_execution(uuid,text)') is null then raise exception 'consequential verifier missing'; end if;
  if to_regprocedure('public.hq_workforce_verify_consequential_execution_r14_unbound_internal(uuid,text)') is null then raise exception 'deterministic verifier body missing'; end if;
  if to_regprocedure('public.hq_workforce_assign_independent_verifier(uuid,uuid)') is null then raise exception 'verifier assignment gateway missing'; end if;
  select lower(pg_get_functiondef('public.hq_workforce_verify_consequential_execution(uuid,text)'::regprocedure)) into wrapper;
  select lower(pg_get_functiondef('public.hq_workforce_verify_consequential_execution_r14_unbound_internal(uuid,text)'::regprocedure)) into inner_d;
  select lower(pg_get_functiondef('public.hq_workforce_assign_independent_verifier(uuid,uuid)'::regprocedure)) into assign_d;

  if position('independent_verifier_assignment_required' in wrapper)=0 then raise exception 'assignment-bound verifier gate missing'; end if;
  if position('verifier_identity_not_assignment_bound' in wrapper)=0 then raise exception 'verifier identity binding missing'; end if;
  if position('approved_plan_hash' in wrapper)=0 or position('verification_task_assignment_no_longer_valid' in wrapper)=0 then raise exception 'approved plan / verification task recheck missing'; end if;
  if position('executor_and_verifier_worker_must_differ' in assign_d)=0 then raise exception 'worker separation-of-duty missing'; end if;
  if position('role=''verification''' in assign_d)=0 then raise exception 'verification capability role binding missing'; end if;
  if position('verifier_identity_invalid' in assign_d)=0 or position('verifier_certification_invalid' in assign_d)=0 then raise exception 'verifier identity/certification gate missing'; end if;

  if position('worker_cannot_verify_own_execution' in inner_d)=0 then raise exception 'deterministic verifier self-check missing'; end if;
  if position('verification_execution_intent_not_committed' in inner_d)=0 then raise exception 'committed intent gate missing'; end if;
  if position('verification_contract_missing' in inner_d)=0 then raise exception 'verification contract gate missing'; end if;
  if position('negative evidence is deliberately persisted' in inner_d)=0 then raise exception 'negative evidence persistence contract missing'; end if;
  if position('execution_intent_id' in inner_d)=0 or position('authority_grant_id' in inner_d)=0 or position('plan_step_id' in inner_d)=0 then raise exception 'verification lineage comparison incomplete'; end if;

  if has_function_privilege('service_role','public.hq_workforce_verify_consequential_execution_r14_unbound_internal(uuid,text)','EXECUTE') then
    raise exception 'service_role can bypass verifier assignment';
  end if;
end $$;

-- Verification receipts are immutable after insert.
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgrelid='public.hq_workforce_execution_verifications'::regclass
      and tgname='trg_hq_workforce_execution_verification_immutable' and not tgisinternal
  ) then raise exception 'verification immutability trigger missing'; end if;
end $$;

-- Invalid/unassigned verification must fail before evidence mutation.
do $$
begin
  begin
    perform public.hq_workforce_verify_consequential_execution(gen_random_uuid(),'verifier_test');
    raise exception 'missing task verification accepted';
  exception when others then
    if sqlerrm='missing task verification accepted' then raise; end if;
    if sqlerrm<>'independent_verifier_assignment_required' then raise exception 'unexpected unassigned verifier failure:%',sqlerrm; end if;
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
     or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'R1.4 verification test changed runtime safety boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'verification test introduced active capability authority'; end if;
end $$;

rollback;
