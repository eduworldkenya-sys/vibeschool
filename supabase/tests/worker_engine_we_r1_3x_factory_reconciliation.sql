-- WE-R1.3X X8 acceptance: Factory is last-resort diagnosis only; no worker creation/certification/authority.
begin;

-- Security and immutability contract.
do $$ begin
  if to_regclass('public.hq_workforce_factory_diagnoses') is null then raise exception 'X8 diagnosis table missing'; end if;
  if not (select relrowsecurity from pg_class where oid='public.hq_workforce_factory_diagnoses'::regclass) then raise exception 'X8 diagnosis RLS disabled'; end if;
  if has_table_privilege('anon','public.hq_workforce_factory_diagnoses','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.hq_workforce_factory_diagnoses','SELECT,INSERT,UPDATE,DELETE') then raise exception 'X8 diagnosis leaked to product roles'; end if;
  if has_function_privilege('anon','public.hq_workforce_diagnose_factory_gap(uuid)','EXECUTE') or has_function_privilege('authenticated','public.hq_workforce_diagnose_factory_gap(uuid)','EXECUTE') then raise exception 'X8 diagnosis executable by product roles'; end if;
end $$;

-- Shared governed resource.
insert into public.hq_workforce_resources(resource_key,version,resource_kind,display_name,enabled,shadow_capable,health_status,reliability,cost_per_unit,cost_unit,required_autonomy,risk_class,allowed_scope_types,jurisdictions,allowed_data_classifications,provenance)
values('test.x8.deterministic',1,'deterministic','X8 deterministic fixture',true,true,'healthy',1,0,'count',0,0,array['platform_internal'],array['global'],array['internal'],'{"suite":"x8"}');

-- REUSE CASE: capability, certified skill and active competent worker all exist.
insert into public.hq_workforce_capabilities(capability_key,version,display_name,purpose,risk_class,autonomy_ceiling,lifecycle_status,provenance)
values('test.x8.reuse',1,'X8 Reuse','Prove reuse before Factory',0,0,'certified','{"suite":"x8"}');
insert into public.hq_workforce_capability_competencies(capability_id,competency_key,required,weight,minimum_proficiency)
select id,'x8.reuse.analysis',true,1,.6 from public.hq_workforce_capabilities where capability_key='test.x8.reuse';
insert into public.hq_workforce_capability_resources(capability_id,resource_id,access_mode,required,minimum_reliability,priority,constraints)
select c.id,r.id,'read',true,.9,100,'{}' from public.hq_workforce_capabilities c cross join public.hq_workforce_resources r where c.capability_key='test.x8.reuse' and r.resource_key='test.x8.deterministic';
insert into public.hq_workforce_tool_contracts(tool_key,version,title,handler_key,required_capability_key,operation,resource_type,side_effect_class,status,approved_at)
values('test_x8_reuse_tool',1,'X8 reuse fixture','test.x8.reuse','test.x8.reuse','read','hq_workforce','read_only','approved',clock_timestamp());
insert into public.hq_workforce_skill_manifests(skill_key,version,tool_contract_id,autonomy_required,risk_class,allowed_scope_types,allowed_data_classes,max_records_affected,max_attempts,max_runtime_ms,requires_human_approval,verification_required,compensation_strategy,owner_key,certification_status,certified_at,purpose,shadow_capable,immutable_version_key)
select 'test_x8_reuse_skill',1,id,0,0,array['platform_internal'],array['internal'],1,1,1000,false,true,'none','platform_governance','certified',clock_timestamp(),'X8 certified reuse fixture',true,'test_x8_reuse_skill@1' from public.hq_workforce_tool_contracts where tool_key='test_x8_reuse_tool' and version=1;
insert into public.hq_workforce_skill_capabilities(skill_manifest_id,capability_id,coverage,role,evidence)
select sm.id,c.id,1,'implements','{"suite":"x8"}' from public.hq_workforce_skill_manifests sm cross join public.hq_workforce_capabilities c where sm.skill_key='test_x8_reuse_skill' and c.capability_key='test.x8.reuse';
insert into public.hq_workforce_workers(worker_key,worker_kind,title,department_key,mission,status)
values('x8-reuse-worker','digital','X8 Reuse Worker','unrelated','Prove reuse before creation','active');
insert into public.hq_workforce_worker_competencies(worker_key,competency_key,version,proficiency,reliability,sample_count,certification_status,evidence,scope_types,jurisdictions)
values('x8-reuse-worker','x8.reuse.analysis',1,.95,.95,50,'certified','{"suite":"x8"}',array['platform_internal'],array['global']);
insert into public.hq_workforce_objectives(objective_key,source_type,source_ref,desired_outcome,scope_type,scope_ref,constraints,success_criteria,evidence_requirements,priority,risk_class,status,provenance)
values('test.x8.reuse.objective','acceptance','x8-reuse','Resolve by reuse','platform_internal','{}','[]','[]','[]',50,0,'planning','{"suite":"x8"}');
insert into public.hq_workforce_plans(objective_id,plan_key,version,strategy_key,status,required_autonomy,required_risk,rationale,verification_contract,compensation_contract,provenance)
select id,'test.x8.reuse.plan',1,'reuse','selected',0,0,'{}','{}','{}','{"suite":"x8"}' from public.hq_workforce_objectives where objective_key='test.x8.reuse.objective';
insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,purpose,actor_mode,status,required_autonomy,required_risk,input_contract,expected_output,verification_contract)
select id,'reuse-step',1,'Reuse existing capability','unassigned','planned',0,0,'{}','{}','{}' from public.hq_workforce_plans where plan_key='test.x8.reuse.plan';
insert into public.hq_workforce_plan_step_capabilities(plan_step_id,capability_id,role)
select s.id,c.id,'required' from public.hq_workforce_plan_steps s cross join public.hq_workforce_capabilities c where s.step_key='reuse-step' and c.capability_key='test.x8.reuse';
insert into public.hq_workforce_plan_step_resources(plan_step_id,capability_id,resource_id,access_mode,required)
select s.id,c.id,r.id,'read',true from public.hq_workforce_plan_steps s cross join public.hq_workforce_capabilities c cross join public.hq_workforce_resources r where s.step_key='reuse-step' and c.capability_key='test.x8.reuse' and r.resource_key='test.x8.deterministic';

do $$ declare v jsonb; before_n bigint; after_n bigint; begin
  select count(*) into before_n from public.hq_workforce_workers;
  v:=public.hq_workforce_diagnose_factory_gap((select id from public.hq_workforce_objectives where objective_key='test.x8.reuse.objective'));
  select count(*) into after_n from public.hq_workforce_workers;
  if v->>'status'<>'reuse_or_collaboration' or coalesce((v->>'factory_recommendation')::boolean,true) then raise exception 'X8 reuse incorrectly reached Factory: %',v; end if;
  if before_n<>after_n then raise exception 'X8 diagnosis created worker during reuse case'; end if;
end $$;

-- PERSISTENT GAP CASE: all cheaper prerequisites exist, but no worker carries the certified competency.
insert into public.hq_workforce_capabilities(capability_key,version,display_name,purpose,risk_class,autonomy_ceiling,lifecycle_status,provenance)
values('test.x8.worker-gap',1,'X8 Worker Gap','Prove worker recommendation is final option',0,0,'certified','{"suite":"x8"}');
insert into public.hq_workforce_capability_competencies(capability_id,competency_key,required,weight,minimum_proficiency)
select id,'x8.missing.specialist',true,1,.8 from public.hq_workforce_capabilities where capability_key='test.x8.worker-gap';
insert into public.hq_workforce_capability_resources(capability_id,resource_id,access_mode,required,minimum_reliability,priority,constraints)
select c.id,r.id,'read',true,.9,100,'{}' from public.hq_workforce_capabilities c cross join public.hq_workforce_resources r where c.capability_key='test.x8.worker-gap' and r.resource_key='test.x8.deterministic';
insert into public.hq_workforce_tool_contracts(tool_key,version,title,handler_key,required_capability_key,operation,resource_type,side_effect_class,status,approved_at)
values('test_x8_gap_tool',1,'X8 gap fixture','test.x8.gap','test.x8.worker-gap','read','hq_workforce','read_only','approved',clock_timestamp());
insert into public.hq_workforce_skill_manifests(skill_key,version,tool_contract_id,autonomy_required,risk_class,allowed_scope_types,allowed_data_classes,max_records_affected,max_attempts,max_runtime_ms,requires_human_approval,verification_required,compensation_strategy,owner_key,certification_status,certified_at,purpose,shadow_capable,immutable_version_key)
select 'test_x8_gap_skill',1,id,0,0,array['platform_internal'],array['internal'],1,1,1000,false,true,'none','platform_governance','certified',clock_timestamp(),'X8 certified gap fixture',true,'test_x8_gap_skill@1' from public.hq_workforce_tool_contracts where tool_key='test_x8_gap_tool' and version=1;
insert into public.hq_workforce_skill_capabilities(skill_manifest_id,capability_id,coverage,role,evidence)
select sm.id,c.id,1,'implements','{"suite":"x8"}' from public.hq_workforce_skill_manifests sm cross join public.hq_workforce_capabilities c where sm.skill_key='test_x8_gap_skill' and c.capability_key='test.x8.worker-gap';
insert into public.hq_workforce_objectives(objective_key,source_type,source_ref,desired_outcome,scope_type,scope_ref,constraints,success_criteria,evidence_requirements,priority,risk_class,status,provenance)
values('test.x8.gap.objective','acceptance','x8-gap','Prove persistent worker gap','platform_internal','{}','[]','[]','[]',50,0,'planning','{"suite":"x8"}');
insert into public.hq_workforce_plans(objective_id,plan_key,version,strategy_key,status,required_autonomy,required_risk,rationale,verification_contract,compensation_contract,provenance)
select id,'test.x8.gap.plan',1,'last-resort-gap','selected',0,0,'{}','{}','{}','{"suite":"x8"}' from public.hq_workforce_objectives where objective_key='test.x8.gap.objective';
insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,purpose,actor_mode,status,required_autonomy,required_risk,input_contract,expected_output,verification_contract)
select id,'gap-step',1,'Require unavailable specialist','unassigned','blocked',0,0,'{}','{}','{}' from public.hq_workforce_plans where plan_key='test.x8.gap.plan';
insert into public.hq_workforce_plan_step_capabilities(plan_step_id,capability_id,role)
select s.id,c.id,'required' from public.hq_workforce_plan_steps s cross join public.hq_workforce_capabilities c where s.step_key='gap-step' and c.capability_key='test.x8.worker-gap';
insert into public.hq_workforce_plan_step_resources(plan_step_id,capability_id,resource_id,access_mode,required)
select s.id,c.id,r.id,'read',true from public.hq_workforce_plan_steps s cross join public.hq_workforce_capabilities c cross join public.hq_workforce_resources r where s.step_key='gap-step' and c.capability_key='test.x8.worker-gap' and r.resource_key='test.x8.deterministic';
update public.hq_workforce_resources set enabled=false where resource_kind='human_reviewer';

do $$ declare v jsonb; before_n bigint; after_n bigint; begin
  select count(*) into before_n from public.hq_workforce_workers;
  v:=public.hq_workforce_diagnose_factory_gap((select id from public.hq_workforce_objectives where objective_key='test.x8.gap.objective'));
  select count(*) into after_n from public.hq_workforce_workers;
  if v->>'status'<>'persistent_worker_gap' or not coalesce((v->>'factory_recommendation')::boolean,false) then raise exception 'X8 failed to identify final persistent worker gap: %',v; end if;
  if coalesce((v->>'worker_created')::boolean,true) or coalesce((v->>'worker_certified')::boolean,true) or coalesce((v->>'authority_granted')::boolean,true) or coalesce((v->>'consequential_execution')::boolean,true) then raise exception 'X8 recommendation crossed non-activating boundary: %',v; end if;
  if before_n<>after_n then raise exception 'X8 Factory recommendation created a worker'; end if;
  if (v->'alternatives_checked'->>'resource_gap_count')::integer<>0 or (v->'alternatives_checked'->>'capability_gap_count')::integer<>0 or (v->'alternatives_checked'->>'skill_gap_count')::integer<>0 then raise exception 'X8 recommended Factory before cheaper prerequisites were exhausted: %',v; end if;
end $$;

-- Evidence is append-only.
do $$ begin
  begin update public.hq_workforce_factory_diagnoses set factory_recommendation=false where objective_id=(select id from public.hq_workforce_objectives where objective_key='test.x8.gap.objective'); raise exception 'X8 diagnosis evidence was mutable';
  exception when others then if sqlerrm='X8 diagnosis evidence was mutable' then raise; end if; if position('worker_engine_factory_diagnosis_is_append_only' in sqlerrm)=0 then raise; end if; end;
end $$;

-- Safety boundary must remain fully OFF/L0/R0.
do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 or ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop then raise exception 'X8 acceptance crossed fail-closed boundary'; end if;
end $$;

rollback;