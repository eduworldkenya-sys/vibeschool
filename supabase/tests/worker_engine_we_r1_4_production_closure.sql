-- WE-R1.4 production-closure adversarial contract suite.
begin;

-- Legacy external authority plane must be closed.
do $$
declare v_bad text[];
begin
  select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) into v_bad
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'hq_workforce_execute_safe_queue','hq_workforce_enqueue_unrouted_work','hq_workforce_verify_run',
      'hq_workforce_verify_assignment','hq_workforce_transition_decision','hq_workforce_promote_learning',
      'hq_workforce_promote_learning_candidate','hq_workforce_finalize_skill_probation','hq_workforce_record_skill_benchmark',
      'hq_workforce_scheduled_factory_heartbeat','hq_workforce_runtime_self_certify','hq_workforce_capture_founder_decision',
      'hq_workforce_certify_learning_pipeline','hq_workforce_issue_certification','hq_workforce_record_shadow_run'
    ) and has_function_privilege('service_role',p.oid,'EXECUTE');
  if v_bad is not null then raise exception 'legacy service authority remains:%',v_bad; end if;
end $$;

-- Runtime, policy and capability authority are governance-owned, not service writable.
do $$
begin
  if has_table_privilege('service_role','public.hq_workforce_engine_contract','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_engine_contract','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_engine_contract','DELETE')
     or has_table_privilege('service_role','public.hq_workforce_engine_contract','TRUNCATE') then raise exception 'service_role can mutate engine contract'; end if;
  if has_table_privilege('service_role','public.hq_workforce_runtime_policies','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_runtime_policies','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_runtime_policies','DELETE')
     or has_table_privilege('service_role','public.hq_workforce_runtime_policies','TRUNCATE') then raise exception 'service_role can mutate runtime policy'; end if;
  if has_table_privilege('service_role','public.hq_workforce_capability_authority_grants','UPDATE') then raise exception 'service_role can activate capability authority directly'; end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_owner_put_runtime_policy(text,text,text,boolean,smallint,smallint,integer,integer,text,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_owner_transition_capability_authority(uuid,text,text,jsonb)','EXECUTE') then
    raise exception 'service_role can invoke owner governance transitions';
  end if;
end $$;

-- Execution control-plane rows cannot be forged by service transport.
do $$
begin
  if has_table_privilege('service_role','public.hq_workforce_tool_contracts','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_tool_contracts','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_task_contracts','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_task_contracts','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_task_contracts','DELETE')
     or has_table_privilege('service_role','public.hq_workforce_canary_queue_memberships','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_canary_queue_memberships','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_canary_queue_memberships','DELETE') then
    raise exception 'service_role retains raw execution control-plane writes';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_set_tool_contract_status(uuid,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_owner_set_canary_membership(uuid,boolean,text)','EXECUTE') then
    raise exception 'service_role can impersonate owner execution-control governance';
  end if;
end $$;

-- Executable worker credentials/ontology cannot be manufactured with raw DML.
do $$
begin
  if has_table_privilege('service_role','public.hq_workforce_workers','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_identities','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_identities','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_certifications','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_certifications','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_skill_manifests','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_skill_manifests','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_capabilities','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_capabilities','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_skill_capabilities','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_worker_competencies','UPDATE') then
    raise exception 'service_role can manufacture executable worker credential truth';
  end if;
end $$;

-- No explicit global policy means runtime authorization fails closed.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_assert_runtime_task_authorized(uuid)'::regprocedure)) into d;
  if position('worker_runtime_explicit_global_policy_required' in d)=0 then raise exception 'explicit global runtime policy gate missing'; end if;
  if has_function_privilege('service_role','public.hq_workforce_assert_runtime_task_authorized_r12_internal(uuid)','EXECUTE') then raise exception 'service_role bypasses explicit global policy wrapper'; end if;
end $$;

-- Planning approval truth is owner-bound and exact-plan-bound.
do $$
declare d text;
begin
  if has_table_privilege('service_role','public.hq_workforce_objectives','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_plans','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_plan_steps','UPDATE') then raise exception 'service_role retains direct planning approval writes'; end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_review_objective(uuid,text,text,jsonb)','EXECUTE') then raise exception 'service_role can impersonate objective owner review'; end if;
  select lower(pg_get_functiondef('public.hq_workforce_owner_review_objective(uuid,text,text,jsonb)'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 or position('auth.uid()' in d)=0 or position('approved_plan_hash' in d)=0 then raise exception 'objective owner/plan approval binding incomplete'; end if;
end $$;

-- Service transport may record observations, never verified or authoritative truth.
do $$
declare m_count bigint;
begin
  select count(*) into m_count from public.hq_workforce_memory_records;
  begin
    perform public.hq_workforce_add_memory(
      'closure.verified-denial','fact','{"value":"x"}'::jsonb,'{"source":"test"}'::jsonb,
      'test','closure',1.0,'verified',true,'platform_internal','{}'::jsonb,
      array['internal']::text[],array['global']::text[],clock_timestamp(),null,clock_timestamp(),null,null,null
    );
    raise exception 'service memory wrapper accepted verified authoritative truth';
  exception when others then
    if sqlerrm='service memory wrapper accepted verified authoritative truth' then raise; end if;
    if sqlerrm not in ('service_transport_cannot_create_authoritative_memory','verified_memory_requires_identity_bound_review') then raise; end if;
  end;
  if (select count(*) from public.hq_workforce_memory_records)<>m_count then raise exception 'denied truth injection changed memory state'; end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_verify_memory(uuid,text,jsonb,boolean)','EXECUTE') then raise exception 'service_role can impersonate owner memory verification'; end if;
end $$;

-- Verifier assignment and deterministic verifier are separated.
do $$
begin
  if has_function_privilege('service_role','public.hq_workforce_verify_consequential_execution_r14_unbound_internal(uuid,text)','EXECUTE') then raise exception 'unbound verifier externally callable'; end if;
  if to_regclass('public.hq_workforce_verifier_assignments') is null then raise exception 'verifier assignment evidence missing'; end if;
  if has_table_privilege('service_role','public.hq_workforce_verifier_assignments','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_verifier_assignments','UPDATE') then raise exception 'service_role can forge verifier assignment evidence'; end if;
end $$;

-- Work-item mutations have a monotonic version source, closing A->B->A snapshots.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_advance_work_item_version()'::regprocedure)) into d;
  if position('old.worker_state_revision+1' in d)=0 or position('new.updated_at:=clock_timestamp()' in d)=0 then raise exception 'work item version clock incomplete'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.hq_work_items'::regclass and tgname='trg_hq_workforce_advance_work_item_version' and not tgisinternal) then raise exception 'work item version trigger missing'; end if;
end $$;

-- Breaker denial evidence is emitted after failed execution rollback and explicit deny is failure.
do $$
declare gd text; qd text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure)) into gd;
  select lower(pg_get_functiondef('public.hq_workforce_execute_task_queue(integer,integer)'::regprocedure)) into qd;
  if position('durable_after_execution_rollback' in gd)=0 or position('mutation_performed'',false' in gd)=0 then raise exception 'durable breaker denial contract missing'; end if;
  if position('evidence->>''decision''' in qd)=0 or position('status=''failed''' in qd)=0 then raise exception 'queue breaker deny semantics missing'; end if;
end $$;

-- Installation remains non-activating.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then raise exception 'production closure changed fail-closed posture'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'production closure activated authority'; end if;
end $$;

rollback;
