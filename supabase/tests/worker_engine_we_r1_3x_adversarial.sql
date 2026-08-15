\set ON_ERROR_STOP on
begin;

-- Legacy scheduler authority must remain retired; R1.3X must not accidentally restore a second positive control loop.
do $$ begin
 if has_function_privilege('service_role','public.hq_workforce_scheduled_heartbeat()','EXECUTE') then raise exception 'legacy_scheduler_authority_restored'; end if;
end $$;

-- Resource attacks: disabled, revoked/unavailable, high-risk and autonomy-requiring resources are never discoverable at Shadow/L0.
insert into public.hq_workforce_resources(resource_key,version,resource_type,display_name,trust_tier,allowed_scope_types,allowed_operations,required_autonomy,risk_class,health_status,enabled,shadow_capable)
values
 ('attack.safe',1,'dataset','safe',5,array['global'],array['read'],0,0,'healthy',true,true),
 ('attack.disabled',1,'dataset','disabled',5,array['global'],array['read'],0,0,'healthy',false,true),
 ('attack.revoked',1,'dataset','revoked',5,array['global'],array['read'],0,0,'revoked',true,true),
 ('attack.risk',1,'api','risk',5,array['global'],array['read'],0,5,'healthy',true,true),
 ('attack.autonomy',1,'tool','autonomy',5,array['global'],array['read'],1,0,'healthy',true,true);
do $$ declare n int; begin
 select count(*) into n from public.hq_workforce_discover_shadow_resources('global','global','read',100) where resource_key like 'attack.%';
 if n<>1 then raise exception 'resource_attack_filter_failed:%',n; end if;
end $$;

-- Prepare certified and uncertified skills for plan attacks.
insert into public.hq_workforce_tool_contracts(tool_key,version,title,handler_key,required_capability_key,operation,resource_type,side_effect_class,status,approved_at)
values
 ('attack-certified-tool',1,'certified','work_item.triage_and_own','attack.cap','update','hq_work_items','internal_write','approved',clock_timestamp()),
 ('attack-draft-tool',1,'draft','work_item.triage_and_own','attack.cap','update','hq_work_items','internal_write','approved',clock_timestamp());
insert into public.hq_workforce_skill_manifests(skill_key,version,tool_contract_id,autonomy_required,risk_class,allowed_scope_types,allowed_data_classes,max_records_affected,max_attempts,max_runtime_ms,requires_human_approval,verification_required,compensation_strategy,owner_key,certification_status,certified_at,purpose,shadow_capable,immutable_version_key)
select 'attack.certified',1,id,0,0,array['global'],array['internal'],1,1,1000,true,true,'manual_review','platform_governance','certified',clock_timestamp(),'certified',true,'attack.certified@1' from public.hq_workforce_tool_contracts where tool_key='attack-certified-tool'
union all
select 'attack.draft',1,id,0,0,array['global'],array['internal'],1,1,1000,true,true,'manual_review','platform_governance','draft',null,'draft',true,'attack.draft@1' from public.hq_workforce_tool_contracts where tool_key='attack-draft-tool';

-- Authority attack: a step above the objective's L0/R0 ceiling invalidates the plan.
with o as (insert into public.hq_workforce_objectives(objective_key,statement,scope_type,jurisdiction,required_competencies,risk_ceiling,autonomy_ceiling,status) values('attack-authority','authority test','global','global',array['attack.cap'],0,0,'planning') returning id),
p as (insert into public.hq_workforce_plans(objective_id,strategy_key,required_risk,required_autonomy) select id,'excessive-authority',0,0 from o returning id)
insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,skill_manifest_id,required_risk,required_autonomy) select p.id,'bad-authority',1,m.id,1,1 from p cross join public.hq_workforce_skill_manifests m where m.skill_key='attack.certified';
do $$ declare v jsonb; begin
 v:=public.hq_workforce_validate_plan_dag((select id from public.hq_workforce_plans where strategy_key='excessive-authority' limit 1));
 if (v->>'valid')::boolean or (v->>'authority_violations')::int<1 then raise exception 'authority_attack_not_denied:%',v; end if;
end $$;

-- Certification attack: a draft skill cannot make a valid plan.
with o as (insert into public.hq_workforce_objectives(objective_key,statement,scope_type,jurisdiction,required_competencies,risk_ceiling,autonomy_ceiling,status) values('attack-draft-skill','draft skill test','global','global',array['attack.cap'],0,0,'planning') returning id),
p as (insert into public.hq_workforce_plans(objective_id,strategy_key) select id,'draft-skill' from o returning id)
insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,skill_manifest_id) select p.id,'draft',1,m.id from p cross join public.hq_workforce_skill_manifests m where m.skill_key='attack.draft';
do $$ declare v jsonb; begin v:=public.hq_workforce_validate_plan_dag((select id from public.hq_workforce_plans where strategy_key='draft-skill' limit 1)); if (v->>'valid')::boolean then raise exception 'uncertified_skill_attack_not_denied'; end if; end $$;

-- Reasoning attack: cyclic dependencies must invalidate a plan.
with o as (insert into public.hq_workforce_objectives(objective_key,statement,scope_type,jurisdiction,required_competencies,status) values('attack-cycle','cycle test','global','global',array['attack.cap'],'planning') returning id),
p as (insert into public.hq_workforce_plans(objective_id,strategy_key) select id,'cyclic' from o returning id),
s1 as (insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,skill_manifest_id) select p.id,'a',1,m.id from p cross join public.hq_workforce_skill_manifests m where m.skill_key='attack.certified' returning id,plan_id),
s2 as (insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,skill_manifest_id) select p.id,'b',2,m.id from p cross join public.hq_workforce_skill_manifests m where m.skill_key='attack.certified' returning id,plan_id)
insert into public.hq_workforce_plan_step_dependencies(plan_id,step_id,depends_on_step_id)
select s1.plan_id,s1.id,s2.id from s1 cross join s2 union all select s2.plan_id,s2.id,s1.id from s1 cross join s2;
do $$ declare v jsonb; begin v:=public.hq_workforce_validate_plan_dag((select id from public.hq_workforce_plans where strategy_key='cyclic' limit 1)); if (v->>'valid')::boolean or not (v->>'cycle')::boolean then raise exception 'cyclic_plan_not_denied:%',v; end if; end $$;

-- Collaboration attack: self-delegation cannot be inserted and therefore cannot manufacture authority or fake collaboration.
do $$ declare blocked boolean:=false; begin
 begin insert into public.hq_workforce_collaborations(trace_id,from_worker_key,to_worker_key,collaboration_type,authority_snapshot) values(gen_random_uuid(),'same-worker','same-worker','delegate','{}'); exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'self_delegation_not_blocked'; end if;
end $$;

-- Memory attack: stale and contradictory facts must be surfaced, never silently normalized to truth.
insert into public.hq_workforce_memory(memory_key,version,memory_type,content,provenance,confidence,contradiction_group,valid_until)
values('attack.memory',1,'fact','{"value":"old"}','{"source":"a"}',.9,'attack-memory',clock_timestamp()-interval '1 minute'),
      ('attack.memory',2,'fact','{"value":"new-a"}','{"source":"b"}',.8,'attack-memory',clock_timestamp()+interval '1 hour'),
      ('attack.memory',3,'fact','{"value":"new-b"}','{"source":"c"}',.8,'attack-memory',clock_timestamp()+interval '1 hour');
do $$ declare stale_n int; conflict_n int; begin
 select count(*) into stale_n from public.hq_workforce_recall_memory('attack.memory') where stale;
 select count(*) into conflict_n from public.hq_workforce_recall_memory('attack.memory') where contradictory;
 if stale_n<1 or conflict_n<2 then raise exception 'memory_attack_not_exposed stale=% conflict=%',stale_n,conflict_n; end if;
end $$;

-- Skill Genesis attack: schema-level invariant makes self-certification impossible.
do $$ declare sid uuid; allowed boolean; begin
 sid:=public.hq_workforce_propose_skill_candidate('{"attack":"missing-skill"}','{"skill_key":"attack.generated"}','[]','[]');
 select certification_allowed into allowed from public.hq_workforce_skill_candidates where id=sid;
 if allowed then raise exception 'skill_genesis_self_certification_attack_succeeded'; end if;
end $$;

-- Final safety assertion: no intelligence test may enable consequential controls.
do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'adversarial_suite_found_autonomous_control_enabled'; end if;
end $$;
rollback;
