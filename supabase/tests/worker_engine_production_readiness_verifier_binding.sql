-- Production-readiness adversarial test: independent verifier must be owner-preassigned and identity/capability-bound.
begin;

do $$
declare d text;
begin
  if has_table_privilege('service_role','public.hq_workforce_verifier_assignments','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_verifier_assignments','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_verifier_assignments','DELETE') then
    raise exception 'service_role_can_manufacture_verifier_assignment';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_assign_verifier(uuid,text,timestamptz)','EXECUTE') then
    raise exception 'service_role_can_assign_verifier';
  end if;
  if not has_function_privilege('authenticated','public.hq_workforce_assign_verifier(uuid,text,timestamptz)','EXECUTE') then
    raise exception 'owner_assignment_rpc_not_available_to_authenticated_owner';
  end if;
  select lower(pg_get_functiondef('public.hq_workforce_assign_verifier(uuid,text,timestamptz)'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 or position('auth.uid() is null' in d)=0 then raise exception 'verifier_assignment_not_owner_bound'; end if;
  if position('internal.execution.verify' in d)=0 or position('hq_workforce_identities' in d)=0 or position('hq_workforce_capability_grants' in d)=0 then raise exception 'verifier_assignment_identity_capability_binding_missing'; end if;
end $$;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_bind_verification_identity()'::regprocedure)) into d;
  if position('authorized_verifier_assignment_required' in d)=0 then raise exception 'verification_assignment_gate_missing'; end if;
  if position('verifier_identity_invalid_or_revoked' in d)=0 then raise exception 'verification_identity_recheck_missing'; end if;
  if position('verifier_capability_invalid_or_revoked' in d)=0 then raise exception 'verification_capability_recheck_missing'; end if;
  if position('verifier_assignment_consumption_race' in d)=0 then raise exception 'verification_assignment_single_use_missing'; end if;
  if not exists(
    select 1 from pg_trigger tg join pg_class c on c.oid=tg.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='hq_workforce_execution_verifications'
      and tg.tgname='trg_hq_workforce_bind_verification_identity' and not tg.tgisinternal
  ) then raise exception 'verification_identity_binding_trigger_missing'; end if;
end $$;

-- Evidence schema must retain the exact assignment used.
do $$
begin
  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='hq_workforce_execution_verifications'
      and column_name='verifier_assignment_id'
  ) then raise exception 'verification_assignment_evidence_column_missing'; end if;
end $$;

-- No standing assignment should be created by the migration itself.
do $$
declare n integer;
begin
  select count(*) into n from public.hq_workforce_verifier_assignments;
  if n<>0 then raise exception 'unexpected_persistent_verifier_assignment'; end if;
end $$;

rollback;
