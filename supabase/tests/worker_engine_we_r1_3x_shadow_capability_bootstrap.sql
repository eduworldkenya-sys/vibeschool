\set ON_ERROR_STOP on
begin;

-- A reasoning capability must no longer require a mutating ToolContract.
do $$ declare sid uuid; begin
 insert into public.hq_workforce_skill_manifests(
  skill_key,version,tool_contract_id,autonomy_required,risk_class,allowed_scope_types,allowed_data_classes,
  max_records_affected,max_attempts,max_runtime_ms,requires_human_approval,verification_required,compensation_strategy,
  owner_key,certification_status,certified_at,purpose,shadow_capable,immutable_version_key,capability_mode,certification_evidence)
 values('bootstrap.reasoning.proof',99,null,0,0,array['platform_internal'],array['internal'],0,1,1000,true,true,'none_read_only',
  'platform_governance','certified',clock_timestamp(),'Prove reasoning/tool separation',true,'bootstrap.reasoning.proof@99','shadow_reasoning','{"suite":"bootstrap"}') returning id into sid;
 if sid is null then raise exception 'shadow_reasoning_without_tool_not_created'; end if;
 if exists(select 1 from public.hq_workforce_skill_manifests where id=sid and tool_contract_id is not null) then raise exception 'reasoning_capability_gained_tool'; end if;
end $$;

-- The reverse must fail: an execution capability without a ToolContract is invalid.
do $$ declare blocked boolean:=false; begin
 begin
  insert into public.hq_workforce_skill_manifests(
   skill_key,version,tool_contract_id,autonomy_required,risk_class,allowed_scope_types,allowed_data_classes,max_records_affected,max_attempts,max_runtime_ms,
   requires_human_approval,verification_required,compensation_strategy,owner_key,certification_status,certified_at,purpose,shadow_capable,immutable_version_key,capability_mode)
  values('bootstrap.bad.execution',99,null,0,0,array['platform_internal'],array['internal'],0,1,1000,true,true,'manual_review','platform_governance','certified',clock_timestamp(),'must fail',true,'bootstrap.bad.execution@99','execution');
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'execution_capability_without_tool_accepted'; end if;
end $$;

-- Deployment-certified bootstrap capabilities must be L0, human-reviewed and non-executable.
do $$ declare n int; begin
 select count(*) into n from public.hq_workforce_skill_manifests
 where skill_key in ('shadow.operations.triage','shadow.quality.analysis','shadow.content.quality','shadow.curriculum.analysis','shadow.learning.analysis')
   and capability_mode='shadow_reasoning' and tool_contract_id is null and autonomy_required=0 and shadow_capable
   and requires_human_approval and verification_required and certification_status='certified'
   and certification_evidence->>'mode'='deployment_certified';
 if n<>5 then raise exception 'bootstrap_shadow_capability_contract_incomplete:%',n; end if;
 if exists(select 1 from public.hq_workforce_skill_manifests where capability_mode='shadow_reasoning' and tool_contract_id is not null) then raise exception 'shadow_reasoning_tool_coupling_detected'; end if;
end $$;

-- Resource registry must describe access, not grant browser access.
do $$ begin
 if not exists(select 1 from public.hq_workforce_resources where resource_key='vibeschool.internal.work_items' and enabled and shadow_capable and required_autonomy=0 and risk_class=0) then raise exception 'canonical_internal_work_resource_missing'; end if;
 if has_table_privilege('anon','public.hq_workforce_resources','SELECT') or has_table_privilege('authenticated','public.hq_workforce_resources','SELECT') then raise exception 'resource_registry_exposed_to_product_users'; end if;
end $$;

-- The observed production work semantics must resolve to the intended competency sets.
do $$ declare wid uuid; c text[]; begin
 insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,route,approval_required,evidence)
 values('learning','content_backlog','high','open','Learning backlog','Bootstrap semantic proof','workforce_gap','/hq/workforce',false,'{}') returning id into wid;
 c:=public.hq_workforce_required_competencies_for_work(wid);
 if not (c@>array['learning.analysis','curriculum.analysis'] and cardinality(c)=2) then raise exception 'production_learning_semantics_not_bootstrapped:%',c; end if;
end $$;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'bootstrap_test_changed_runtime_boundary'; end if;
end $$;
rollback;
