\set ON_ERROR_STOP on
begin;

-- The safety/execution substrate remains, but inferior intelligence components are explicitly non-canonical.
do $$ declare n int; begin
 if to_regclass('public.hq_workforce_architecture_components') is null then raise exception 'architecture_registry_missing'; end if;
 select count(*) into n from public.hq_workforce_architecture_components where component_key in ('autonomous_heartbeat_intelligence','legacy_worker_factory','legacy_workforce_demand_sensor','lane_worker_router','single_skill_selector') and canonical;
 if n<>0 then raise exception 'legacy_intelligence_still_canonical:%',n; end if;
 if not exists(select 1 from public.hq_workforce_architecture_components where component_key='r13x_objective_planning' and canonical) then raise exception 'r13x_planner_not_canonical'; end if;
 if not exists(select 1 from public.hq_workforce_architecture_components where component_key='authority_lifecycle_kernel' and canonical and disposition='keep') then raise exception 'safety_kernel_not_preserved'; end if;
end $$;

-- Build a worker deliberately outside the work item's department. Competency, not org-chart equality, must route it.
insert into public.hq_workforce_workers(worker_key,worker_kind,title,department_key,mission,status,reasoning_mode,paid_ai_allowed)
values('r13x-cross-lane-worker','digital','Cross-lane Quality Worker','product','Prove competency-first routing','active','deterministic',false)
on conflict(worker_key) do update set department_key='product',status='active';
insert into public.hq_workforce_worker_competencies(worker_key,competency_key,version,proficiency,reliability,certification_status,allowed_scope_types,jurisdictions)
values('r13x-cross-lane-worker','quality.analysis',1,.99,.98,'certified',array['platform_internal','global'],array['global']);

insert into public.hq_workforce_resources(resource_key,version,resource_type,display_name,trust_tier,allowed_scope_types,allowed_operations,health_status,enabled,shadow_capable,risk_class)
values('r13x.reconciliation.quality_source',1,'dataset','Reconciliation quality evidence',5,array['platform_internal','global'],array['read'],'healthy',true,true,0);

insert into public.hq_workforce_tool_contracts(tool_key,version,title,handler_key,required_capability_key,operation,resource_type,side_effect_class,status,approved_at)
values('r13x-reconciliation-shadow-tool',1,'R1.3X reconciliation shadow tool','work_item.triage_and_own','quality.analysis','update','hq_work_items','internal_write','approved',clock_timestamp()) returning id \gset
insert into public.hq_workforce_skill_manifests(skill_key,version,tool_contract_id,autonomy_required,risk_class,allowed_scope_types,allowed_data_classes,max_records_affected,max_attempts,max_runtime_ms,requires_human_approval,verification_required,compensation_strategy,owner_key,certification_status,certified_at,purpose,input_contract,resource_contract,preconditions,expected_outcome,verification_contract,failure_handling,retry_policy,escalation_contract,shadow_capable,immutable_version_key)
values('r13x.quality.inspect',1,:'id',0,0,array['platform_internal','global'],array['internal'],1,2,30000,true,true,'manual_review','platform_governance','certified',clock_timestamp(),'Inspect quality evidence in Shadow Mode','{}','{}','[]','{}','{}','{}','{}','{}',true,'r13x.quality.inspect@1') returning id \gset skill_
insert into public.hq_workforce_skill_resources(skill_manifest_id,resource_id,usage_role,operation)
select :'skill_id',id,'input','read' from public.hq_workforce_resources where resource_key='r13x.reconciliation.quality_source';

insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,route,approval_required,evidence)
values('quality','r13x_reconciliation','high','open','Cross-lane quality objective','Must route by competency instead of department equality','acceptance','/hq/workforce',false,'{}') returning id \gset work_

-- Add a specific rule so the objective requires quality.analysis.
insert into public.hq_workforce_competency_requirements(rule_key,version,department_key,work_type,source_type,competency_keys,priority,status,approved_at)
values('test.cross_lane_quality',1,'quality','r13x_reconciliation','acceptance',array['quality.analysis'],1000,'approved',clock_timestamp());

-- Shadow scheduler remains an observation mechanism; production execution/factory stay OFF.
update public.hq_workforce_engine_contract set shadow_enabled=true,shadow_scheduler_enabled=true,shadow_global_stop=false,shadow_anomaly_paused=false,shadow_max_cycles_per_hour=10,shadow_max_candidates_per_cycle=20,shadow_max_queue_depth=100 where singleton=true;
select public.hq_workforce_run_shadow_cycle('r13x-reconciliation-cycle',20);
select id from public.hq_workforce_shadow_candidates where source_work_item_id=:'work_id' into temporary table r13x_candidate;

do $$ declare cid uuid; rr jsonb; chosen text; oid uuid; pid uuid; v jsonb; begin
 select id into cid from r13x_candidate;
 if cid is null then raise exception 'reconciliation_candidate_missing'; end if;
 rr:=public.hq_workforce_shadow_recommend_candidate(cid);
 if rr->>'status'<>'awaiting_review' then raise exception 'r13x_recommendation_not_ready:%',rr; end if;
 chosen:=rr->>'worker_key';
 if chosen<>'r13x-cross-lane-worker' then raise exception 'competency_router_failed_cross_lane:%',rr; end if;
 if (select department_key from public.hq_workforce_workers where worker_key=chosen)='quality' then raise exception 'test_did_not_prove_cross_lane_routing'; end if;
 oid:=(rr->>'objective_id')::uuid; pid:=(rr->>'plan_id')::uuid;
 if oid is null or pid is null then raise exception 'objective_or_plan_missing:%',rr; end if;
 v:=public.hq_workforce_validate_plan_dag(pid); if not (v->>'valid')::boolean then raise exception 'canonical_plan_invalid:%',v; end if;
 if not exists(select 1 from public.hq_workforce_plan_steps where plan_id=pid and worker_key=chosen and required_competencies@>array['quality.analysis']) then raise exception 'plan_not_competency_bound'; end if;
 if not exists(select 1 from public.hq_workforce_shadow_traces where trace_id=(rr->>'trace_id')::uuid and consequential_action_performed=false) then raise exception 'nonconsequential_trace_missing'; end if;
end $$;

-- Factory reasoning is recommendation-only and cannot jump directly from an unresolved gap to worker creation.
do $$ declare oid uuid; d jsonb; begin
 insert into public.hq_workforce_objectives(objective_key,statement,scope_type,jurisdiction,required_competencies,status)
 values('r13x-missing-capability-test','Need an unavailable specialist capability','platform_internal','global',array['never.certified.capability'],'planning') returning id into oid;
 d:=public.hq_workforce_diagnose_capability_gap(oid);
 if coalesce((d->>'factory_execution')::boolean,true) then raise exception 'factory_recommendation_executed'; end if;
 if coalesce((d->>'worker_creation_recommended')::boolean,true) then raise exception 'factory_skipped_capability_diagnosis:%',d; end if;
 if d->>'diagnosis' not in ('routing_gap','resource_gap','skill_gap','capability_gap','collaboration_gap','capacity_gap','no_gap') then raise exception 'unexpected_gap_diagnosis:%',d; end if;
end $$;

-- The old autonomous controls remain disabled throughout reconciliation.
do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'legacy_positive_control_reactivated'; end if;
end $$;

rollback;
