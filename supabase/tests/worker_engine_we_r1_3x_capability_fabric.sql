-- WE-R1.3X acceptance: resource/competency/capability + planning + learning/memory, all L0 fail-closed.
begin;

do $$ begin
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='hq_workforce_resources') then raise exception 'missing_resource_registry'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='hq_workforce_worker_competencies') then raise exception 'missing_competency_graph'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='hq_workforce_capability_edges') then raise exception 'missing_capability_graph'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='hq_workforce_objectives') then raise exception 'missing_objectives'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='hq_workforce_plans') then raise exception 'missing_plans'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='hq_workforce_memory') then raise exception 'missing_memory'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='hq_workforce_skill_candidates') then raise exception 'missing_skill_genesis'; end if;
end $$;

insert into public.hq_workforce_resources(resource_key,version,resource_type,display_name,trust_tier,allowed_scope_types,allowed_operations,health_status,enabled,shadow_capable,risk_class)
values ('test.safe.resource',1,'dataset','Safe',5,array['global'],array['read'],'healthy',true,true,0),('test.disabled.resource',1,'dataset','Disabled',5,array['global'],array['read'],'healthy',false,true,0),('test.highrisk.resource',1,'api','High risk',5,array['global'],array['read'],'healthy',true,true,5);
do $$ declare n integer; begin select count(*) into n from public.hq_workforce_discover_shadow_resources('global','global','read',25) where resource_key like 'test.%'; if n<>1 then raise exception 'resource_resolver_fail_closed %',n; end if; end $$;

insert into public.hq_workforce_worker_competencies(worker_key,competency_key,version,proficiency,reliability,certification_status,allowed_scope_types,jurisdictions)
values ('test-worker-a','quality.analysis',1,.95,.90,'certified',array['global'],array['global']),('test-worker-b','quality.analysis',1,.80,.99,'certified',array['global'],array['global']),('test-worker-draft','quality.analysis',1,1,1,'draft',array['global'],array['global']);
do $$ declare winner text; begin select worker_key into winner from public.hq_workforce_rank_workers_by_competency(array['quality.analysis'],'global','global',10) limit 1; if winner<>'test-worker-a' then raise exception 'competency_router_wrong_winner %',winner; end if; if exists(select 1 from public.hq_workforce_rank_workers_by_competency(array['quality.analysis'],'global','global',10) where worker_key='test-worker-draft') then raise exception 'uncertified_competency_routed'; end if; end $$;

-- Skills use the real WE-R1.2 manifest contract; no parallel schema is invented.
insert into public.hq_workforce_tool_contracts(tool_key,version,title,handler_key,required_capability_key,operation,resource_type,side_effect_class,status,approved_at)
values ('test-r13x-certified-tool',1,'R1.3X certified test tool','work_item.triage_and_own','test.quality','update','hq_work_items','internal_write','approved',clock_timestamp()),
       ('test-r13x-draft-tool',1,'R1.3X draft test tool','work_item.triage_and_own','test.quality','update','hq_work_items','internal_write','approved',clock_timestamp());
insert into public.hq_workforce_skill_manifests(skill_key,version,tool_contract_id,autonomy_required,risk_class,allowed_scope_types,allowed_data_classes,max_records_affected,max_attempts,max_runtime_ms,requires_human_approval,verification_required,compensation_strategy,owner_key,certification_status,certified_at,purpose,input_contract,resource_contract,preconditions,expected_outcome,verification_contract,failure_handling,retry_policy,escalation_contract,shadow_capable,immutable_version_key)
select 'test.quality.inspect',1,id,0,0,array['global'],array['internal'],1,2,30000,true,true,'manual_review','platform_governance','certified',clock_timestamp(),'test','{}'::jsonb,'{}'::jsonb,'[]'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,true,'test.quality.inspect@1' from public.hq_workforce_tool_contracts where tool_key='test-r13x-certified-tool'
union all
select 'test.quality.draft',1,id,0,0,array['global'],array['internal'],1,2,30000,true,true,'manual_review','platform_governance','draft',null,'test','{}'::jsonb,'{}'::jsonb,'[]'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,true,'test.quality.draft@1' from public.hq_workforce_tool_contracts where tool_key='test-r13x-draft-tool';

insert into public.hq_workforce_skill_resources(skill_manifest_id,resource_id,usage_role,operation)
select s.id,r.id,'input','read' from public.hq_workforce_skill_manifests s cross join public.hq_workforce_resources r where s.skill_key='test.quality.inspect' and r.resource_key='test.safe.resource';

with o as (insert into public.hq_workforce_objectives(objective_key,statement,required_competencies,risk_ceiling,autonomy_ceiling) values('test-objective','Inspect quality',array['quality.analysis'],2,0) returning id),
p as (insert into public.hq_workforce_plans(objective_id,strategy_key,expected_quality,required_risk,required_autonomy,estimated_cost,estimated_latency_ms) select id,'safe',.90,0,0,1,100 from o returning id,objective_id)
insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,skill_manifest_id,worker_key,required_competencies) select p.id,'inspect',1,m.id,'test-worker-a',array['quality.analysis'] from p cross join public.hq_workforce_skill_manifests m where m.skill_key='test.quality.inspect';

do $$ declare pid uuid; v jsonb; rid uuid; begin
 select id into pid from public.hq_workforce_plans where strategy_key='safe' order by created_at desc limit 1;
 v=public.hq_workforce_validate_plan_dag(pid); if not (v->>'valid')::boolean then raise exception 'valid_plan_rejected %',v; end if;
 select resource_id into rid from public.hq_workforce_resolve_step_resources((select id from public.hq_workforce_plan_steps where plan_id=pid limit 1),'read',10) limit 1; if rid is null then raise exception 'step_resource_not_resolved'; end if;
 if public.hq_workforce_select_least_powerful_plan((select objective_id from public.hq_workforce_plans where id=pid))<>pid then raise exception 'least_powerful_plan_selection_failed'; end if;
end $$;

with o as (select id from public.hq_workforce_objectives where objective_key='test-objective' limit 1),
p as (insert into public.hq_workforce_plans(objective_id,strategy_key,expected_quality,required_risk,required_autonomy) select id,'uncertified',1,0,0 from o returning id)
insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,skill_manifest_id) select p.id,'bad',1,m.id from p cross join public.hq_workforce_skill_manifests m where m.skill_key='test.quality.draft';
do $$ declare v jsonb; begin v=public.hq_workforce_validate_plan_dag((select id from public.hq_workforce_plans where strategy_key='uncertified' limit 1)); if (v->>'valid')::boolean or (v->>'uncertified_steps')::int<>1 then raise exception 'uncertified_plan_not_denied %',v; end if; end $$;

do $$ declare sid uuid; allowed boolean; begin sid=public.hq_workforce_propose_skill_candidate('{"gap":"missing"}','{"skill_key":"candidate.test"}','[]','[]'); select certification_allowed into allowed from public.hq_workforce_skill_candidates where id=sid; if allowed then raise exception 'skill_genesis_self_certification_possible'; end if; end $$;

insert into public.hq_workforce_memory(memory_key,version,memory_type,content,provenance,confidence,contradiction_group,valid_until)
values ('test.memory',1,'fact','{"value":"A"}','{"source":"test"}',.9,'test-c',clock_timestamp()+interval '1 hour'),('test.memory',2,'fact','{"value":"B"}','{"source":"test"}',.8,'test-c',clock_timestamp()+interval '1 hour');
do $$ declare n integer; begin select count(*) into n from public.hq_workforce_recall_memory('test.memory') where contradictory; if n<>2 then raise exception 'memory_contradiction_not_exposed %',n; end if; end $$;

insert into public.hq_workforce_evaluations(trace_id,worker_key,predicted_confidence,score,evaluator_key) values(gen_random_uuid(),'test-worker-a',.9,.8,'test'),(gen_random_uuid(),'test-worker-a',.7,.6,'test');
do $$ declare v jsonb; begin v=public.hq_workforce_refresh_calibration('worker','test-worker-a'); if (v->>'samples')::int<>2 then raise exception 'calibration_sample_count_wrong %',v; end if; end $$;

insert into public.hq_workforce_collaborations(trace_id,from_worker_key,to_worker_key,collaboration_type,requested_competencies,authority_snapshot) values(gen_random_uuid(),'test-worker-a','test-worker-b','consult',array['quality.analysis'],'{"autonomy":0,"risk":0}');

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin select * into ec from public.hq_workforce_engine_contract where singleton=true; if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'R1.3X acceptance found consequential runtime enabled'; end if; end $$;
rollback;