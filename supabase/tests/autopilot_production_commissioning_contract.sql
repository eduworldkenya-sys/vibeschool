begin;

do $$
declare d text;
begin
  if to_regprocedure('public.hq_autopilot_constitution_snapshot()') is null
     or to_regprocedure('public.hq_autopilot_founder_brief()') is null then
    raise exception 'commissioning_founder_read_model_missing';
  end if;

  select lower(pg_get_functiondef('public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)'::regprocedure)) into d;
  if position('effective_from' in d)>0 then raise exception 'commissioning_runtime_uses_noncanonical_effective_from'; end if;
  if position('activated_at is not null' in d)=0 or position('revoked_at is null' in d)=0 or position('expires_at>clock_timestamp()' in d)=0 then
    raise exception 'commissioning_runtime_authority_clock_incomplete';
  end if;
  if position('hq_assert_owner' in d)=0 or position('runtime_activation_active_capability_authority_required' in d)=0 then
    raise exception 'commissioning_runtime_owner_gate_incomplete';
  end if;

  select lower(pg_get_functiondef('public.hq_autopilot_constitution_snapshot()'::regprocedure)) into d;
  if position('effective_from' in d)>0 then raise exception 'commissioning_constitution_uses_noncanonical_effective_from'; end if;
  if position('activated_at is not null' in d)=0 or position('revoked_at is null' in d)=0 or position('expires_at>clock_timestamp()' in d)=0 then
    raise exception 'commissioning_constitution_authority_clock_incomplete';
  end if;
  if position('hq_assert_owner' in d)=0 or position('worker_names_are_authority' in d)=0 then
    raise exception 'commissioning_constitution_owner_or_alias_contract_missing';
  end if;
end $$;

do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'commissioning_engine_contract_missing'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'commissioning_runtime_not_fail_closed';
  end if;
  if exists(select 1 from public.hq_workforce_capability_authority_grants where status='active') then
    raise exception 'commissioning_active_authority_detected';
  end if;
end $$;

do $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.hq_workforce_capabilities c
  join public.hq_workforce_capability_competencies cc on cc.capability_id=c.id and cc.required
  where c.capability_key='content.research.execute' and c.version=1
    and cc.competency_key='curriculum.analysis' and cc.minimum_proficiency>=0.90;
  if v_count<>1 then raise exception 'research_capability_competency_contract_missing'; end if;

  select count(*) into v_count
  from public.hq_workforce_capabilities c
  join public.hq_workforce_capability_competencies cc on cc.capability_id=c.id and cc.required
  where c.capability_key='content.evidence.semantic_verify' and c.version=1
    and cc.competency_key='quality.analysis' and cc.minimum_proficiency>=0.90;
  if v_count<>1 then raise exception 'semantic_verifier_competency_contract_missing'; end if;

  select count(*) into v_count
  from public.hq_workforce_capabilities c
  join public.hq_workforce_capability_competencies cc on cc.capability_id=c.id and cc.required
  where c.capability_key='content.authoring.source_grounded' and c.version=1
    and cc.competency_key in ('curriculum.analysis','content.quality') and cc.minimum_proficiency>=0.90;
  if v_count<>2 then raise exception 'authoring_capability_competency_contract_incomplete'; end if;

  if not exists(
    select 1 from public.hq_workforce_worker_competencies wc
    join public.hq_workforce_workers w on w.worker_key=wc.worker_key
    where wc.worker_key='curriculum-worker-01' and w.status='active'
      and wc.competency_key='curriculum.analysis' and wc.certification_status='certified'
      and wc.proficiency>=0.90 and (wc.expires_at is null or wc.expires_at>clock_timestamp())
  ) then raise exception 'research_canary_candidate_not_competency_qualified'; end if;

  if not exists(
    select 1 from public.hq_workforce_worker_competencies wc
    join public.hq_workforce_workers w on w.worker_key=wc.worker_key
    where wc.worker_key='quality-worker-01' and w.status='active'
      and wc.competency_key='quality.analysis' and wc.certification_status='certified'
      and wc.proficiency>=0.90 and (wc.expires_at is null or wc.expires_at>clock_timestamp())
  ) then raise exception 'semantic_verifier_candidate_not_competency_qualified'; end if;
end $$;

do $$
begin
  if has_function_privilege('anon','public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)','EXECUTE')
     or has_function_privilege('public','public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)','EXECUTE') then
    raise exception 'commissioning_runtime_owner_rpc_exposed';
  end if;
  if has_function_privilege('anon','public.hq_autopilot_constitution_snapshot()','EXECUTE')
     or has_function_privilege('service_role','public.hq_autopilot_constitution_snapshot()','EXECUTE')
     or has_function_privilege('public','public.hq_autopilot_constitution_snapshot()','EXECUTE') then
    raise exception 'commissioning_constitution_rpc_exposed';
  end if;
  if has_function_privilege('anon','public.hq_autopilot_founder_brief()','EXECUTE')
     or has_function_privilege('service_role','public.hq_autopilot_founder_brief()','EXECUTE')
     or has_function_privilege('public','public.hq_autopilot_founder_brief()','EXECUTE') then
    raise exception 'commissioning_founder_brief_rpc_exposed';
  end if;
end $$;

rollback;
