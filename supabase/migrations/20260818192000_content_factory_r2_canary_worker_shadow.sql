-- Content Factory R2 dedicated canary worker.
-- Creates a bounded worker, approved blueprint, and creation contract, then stops in shadow.
-- NON-ACTIVATING: no identity, certification, capability grants, model budget, runtime, or publication authority.

do $$
declare
  v_worker_key constant text := 'content-factory-r2-canary-01';
  v_blueprint_id uuid;
  v_contract_id uuid;
  v_scope jsonb := jsonb_build_object('programme','content_factory_r2_canary');
begin
  if exists(select 1 from public.hq_workforce_workers where worker_key=v_worker_key) then
    raise exception 'content_factory_canary_worker_already_exists';
  end if;

  insert into public.hq_workforce_workers(
    worker_key,worker_kind,title,department_key,job_key,mission,status,reasoning_mode,
    paid_ai_allowed,competencies,permissions,approval_boundaries,kpis
  ) values(
    v_worker_key,'digital','Content Factory R2 Canary Worker','content',null,
    'Prove the governed R2 research to semantic verification to source-grounded authoring chain under a single-record canary scope.',
    'draft','deterministic',false,
    jsonb_build_array('source discovery','semantic evidence verification','source-grounded authoring'),
    jsonb_build_array('execute_certified_skill','read_scoped_context','write_evidence','request_review'),
    jsonb_build_array('no_auto_publish','no_self_approval','no_authority_change','no_unverified_external_fact','no_spend_without_budget'),
    jsonb_build_object('max_records_per_operation',1,'publication_authority',false,'required_chain','research>verify>author')
  );

  insert into public.hq_workforce_blueprints(
    blueprint_key,version,title,mission,authority_ceiling,required_capabilities,required_skill_keys,
    approval_boundaries,scope_type,scope_ref,status,approved_at
  ) values(
    'content_factory_r2_canary_bp',1,'Content Factory R2 Canary Blueprint',
    'Bounded proof of the R2 content-factory trust chain without publication authority.',
    jsonb_build_array('content.research.execute','content.evidence.semantic_verify','content.authoring.source_grounded'),
    jsonb_build_array('content.research.execute','content.evidence.semantic_verify','content.authoring.source_grounded'),
    jsonb_build_array('content.research.execute','content.evidence.semantic_verify','content.authoring.source_grounded'),
    jsonb_build_array('human_acceptance_required','separate_apply_required','publication_denied','one_record_per_operation'),
    'platform_internal',v_scope,'approved',clock_timestamp()
  ) returning id into v_blueprint_id;

  insert into public.hq_workforce_creation_contracts(
    contract_key,worker_key,blueprint_id,authority_ceiling,scope_type,scope_ref,status,issued_at,expires_at
  ) values(
    'content_factory_r2_canary_creation',v_worker_key,v_blueprint_id,
    jsonb_build_array('content.research.execute','content.evidence.semantic_verify','content.authoring.source_grounded'),
    'platform_internal',v_scope,'issued',clock_timestamp(),clock_timestamp()+interval '7 days'
  ) returning id into v_contract_id;

  perform public.hq_workforce_transition_worker(v_worker_key,'requested','Content Factory R2 controlled commissioning',null);
  perform public.hq_workforce_transition_worker(v_worker_key,'instantiated','Content Factory R2 creation contract issued',v_contract_id);
  perform public.hq_workforce_transition_worker(v_worker_key,'provisioned','Content Factory R2 bounded worker provisioned',v_contract_id);
  perform public.hq_workforce_transition_worker(v_worker_key,'shadow','Content Factory R2 mandatory shadow certification entry',v_contract_id);

  if public.hq_workforce_current_lifecycle_state(v_worker_key)<>'shadow' then
    raise exception 'content_factory_canary_shadow_transition_failed';
  end if;
end $$;

-- Installation must not widen production execution.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'content_factory_canary_requires_engine_contract'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'content_factory_canary_violated_fail_closed_runtime';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'content_factory_canary_cannot_activate_authority'; end if;
end $$;
