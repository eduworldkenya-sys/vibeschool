-- WE-R1.4.20: executable credential and ontology closure.
-- NON-ACTIVATING. R1.4 authorization depends on worker lifecycle, identity,
-- certification, skill certification, capability certification and competency evidence.
-- service_role is transport and must not be able to manufacture those predicates by raw
-- table DML. Existing governed SECURITY DEFINER lifecycle/factory/certification routines
-- continue to execute as their function owner; this migration only closes direct callers.

revoke insert,update,delete,truncate on table public.hq_workforce_workers from service_role;
revoke insert,update,delete,truncate on table public.hq_workforce_identities from service_role;
revoke insert,update,delete,truncate on table public.hq_workforce_certifications from service_role;
revoke insert,update,delete,truncate on table public.hq_workforce_skill_manifests from service_role;
revoke insert,update,delete,truncate on table public.hq_workforce_capabilities from service_role;
revoke insert,update,delete,truncate on table public.hq_workforce_capability_edges from service_role;
revoke insert,update,delete,truncate on table public.hq_workforce_skill_capabilities from service_role;
revoke insert,update,delete,truncate on table public.hq_workforce_worker_competencies from service_role;

-- Read access remains available to deterministic routing/authorization transport.
grant select on table public.hq_workforce_workers to service_role;
grant select on table public.hq_workforce_identities to service_role;
grant select on table public.hq_workforce_certifications to service_role;
grant select on table public.hq_workforce_skill_manifests to service_role;
grant select on table public.hq_workforce_capabilities to service_role;
grant select on table public.hq_workforce_capability_edges to service_role;
grant select on table public.hq_workforce_skill_capabilities to service_role;
grant select on table public.hq_workforce_worker_competencies to service_role;

-- Legacy promotion/certification helpers that accept caller-provided truth must not be
-- externally invokable. Revoke every overload if it exists; this is drift tolerant.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array[
      'hq_workforce_issue_certification',
      'hq_workforce_record_shadow_run',
      'hq_workforce_prepare_skill_promotion',
      'hq_workforce_record_skill_benchmark',
      'hq_workforce_finalize_skill_probation',
      'hq_workforce_promote_learning',
      'hq_workforce_promote_learning_candidate'
    ])
  loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
  end loop;
end $$;

-- Deliberately retain hq_workforce_revoke_identity for service_role if earlier migrations
-- granted it: revocation only removes authority and is a fail-safe operation. Creation,
-- certification and activation paths remain closed.

-- Structural/non-activation attestation.
do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_active integer;
  v_bad integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.20 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.20 violated fail_closed_activation_boundary';
  end if;
  select count(*) into v_active
    from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.20 installation activated authority'; end if;

  if has_table_privilege('service_role','public.hq_workforce_workers','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_identities','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_certifications','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_skill_manifests','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_capabilities','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_skill_capabilities','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_worker_competencies','UPDATE') then
    raise exception 'WE-R1.4.20 direct executable credential write remains';
  end if;

  select count(*) into v_bad
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname = any(array[
      'hq_workforce_issue_certification','hq_workforce_record_shadow_run',
      'hq_workforce_prepare_skill_promotion','hq_workforce_record_skill_benchmark',
      'hq_workforce_finalize_skill_probation','hq_workforce_promote_learning',
      'hq_workforce_promote_learning_candidate'
    ])
    and has_function_privilege('service_role',p.oid,'EXECUTE');
  if v_bad<>0 then raise exception 'WE-R1.4.20 legacy credential promotion surface remains:%',v_bad; end if;
end $$;
