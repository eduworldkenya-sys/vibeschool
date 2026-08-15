\set ON_ERROR_STOP on
begin;

-- Two specialist workers must compose into one complete plan rather than forcing a generic worker.
insert into public.hq_workforce_workers(worker_key,worker_kind,title,department_key,mission,status,reasoning_mode,paid_ai_allowed)
values
 ('quality-specialist-a','digital','Quality Specialist','product','Quality analysis','active','deterministic',false),
 ('curriculum-specialist-b','digital','Curriculum Specialist','content','Curriculum analysis','active','deterministic',false),
 ('quality-alternate-c','digital','Alternate Quality Specialist','engineering','Alternative quality analysis','active','deterministic',false)
on conflict(worker_key) do update set status='active';

insert into public.hq_workforce_worker_competencies(worker_key,competency_key,version,proficiency,reliability,certification_status,allowed_scope_types,jurisdictions)
values
 ('quality-specialist-a','quality.analysis',1,.99,.96,'certified',array['platform_internal','global'],array['global']),
 ('curriculum-specialist-b','curriculum.analysis',1,.98,.97,'certified',array['platform_internal','global'],array['global']),
 ('quality-alternate-c','quality.analysis',1,.90,.95,'certified',array['platform_internal','global'],array['global']);

insert into public.hq_workforce_resources(resource_key,version,resource_type,display_name,trust_tier,allowed_scope_types,allowed_operations,required_autonomy,risk_class,health_status,enabled,shadow_capable,cost_profile,latency_profile)
values
 ('planning.quality.data',1,'dataset','Quality data',5,array['platform_internal','global'],array['read'],0,0,'healthy',true,true,'{"unit_cost":0}','{"p95_ms":10}'),
 ('planning.curriculum.data',1,'dataset','Curriculum data',5,array['platform_internal','global'],array['read'],0,0,'healthy',true,true,'{"unit_cost":0}','{"p95_ms":10}');

insert into public.hq_workforce_tool_contracts(tool_key,version,title,handler_key,required_capability_key,operation,resource_type,side_effect_class,status,approved_at)
values
 ('planning-quality-tool',1,'Quality planning tool','work_item.triage_and_own','quality.analysis','update','hq_work_items','internal_write','approved',clock_timestamp()),
 ('planning-curriculum-tool',1,'Curriculum planning tool','work_item.triage_and_own','curriculum.analysis','update','hq_work_items','internal_write','approved',clock_timestamp());

insert into public.hq_workforce_skill_manifests(skill_key,version,tool_contract_id,autonomy_required,risk_class,allowed_scope_types,allowed_data_classes,max_records_affected,max_attempts,max_runtime_ms,requires_human_approval,verification_required,compensation_strategy,owner_key,certification_status,certified_at,purpose,shadow_capable,immutable_version_key)
select 'planning.quality.inspect',1,id,0,0,array['platform_internal','global'],array['internal'],1,1,5000,true,true,'manual_review','platform_governance','certified',clock_timestamp(),'Quality analysis',true,'planning.quality.inspect@1' from public.hq_workforce_tool_contracts where tool_key='planning-quality-tool'
union all
select 'planning.curriculum.inspect',1,id,0,0,array['platform_internal','global'],array['internal'],1,1,5000,true,true,'manual_review','platform_governance','certified',clock_timestamp(),'Curriculum analysis',true,'planning.curriculum.inspect@1' from public.hq_workforce_tool_contracts where tool_key='planning-curriculum-tool';

insert into public.hq_workforce_skill_resources(skill_manifest_id,resource_id,usage_role,operation)
select s.id,r.id,'input','read' from public.hq_workforce_skill_manifests s join public.hq_workforce_resources r on
 (s.skill_key='planning.quality.inspect' and r.resource_key='planning.quality.data') or
 (s.skill_key='planning.curriculum.inspect' and r.resource_key='planning.curriculum.data');
insert into public.hq_workforce_competency_capabilities(competency_key,skill_key,version,min_skill_version,priority,status,approved_at)
values
 ('quality.analysis','planning.quality.inspect',99,1,2000,'approved',clock_timestamp()),
 ('curriculum.analysis','planning.curriculum.inspect',99,1,2000,'approved',clock_timestamp());

-- Empirical calibration should influence ranking when there is enough evidence.
insert into public.hq_workforce_calibration(dimension_type,dimension_key,sample_count,mean_predicted,mean_observed,calibration_error,reliability,last_evaluated_at)
values('worker','quality-specialist-a',20,.95,.91,.04,.91,clock_timestamp()),('worker','quality-alternate-c',20,.90,.96,.06,.96,clock_timestamp())
on conflict(dimension_type,dimension_key) do update set sample_count=excluded.sample_count,reliability=excluded.reliability,last_evaluated_at=excluded.last_evaluated_at;

do $$ declare oid uuid; built jsonb; pid uuid; alt jsonb; aid uuid; selected uuid; ctx jsonb; gap jsonb; begin
 insert into public.hq_workforce_objectives(objective_key,statement,source_type,source_ref,provenance,scope_type,jurisdiction,required_competencies,desired_outcome,constraints,success_criteria,evidence_requirements,risk_ceiling,autonomy_ceiling,status)
 values('planning-quality-'||gen_random_uuid()::text,'Assess content quality and curriculum alignment','acceptance','planning-quality',jsonb_build_object('suite','planning-quality'),'platform_internal','global',array['quality.analysis','curriculum.analysis'],jsonb_build_object('quality_checked',true),'{}','[{"metric":"complete_coverage"}]','[{"kind":"registered_resource","required":true}]',2,0,'planning') returning id into oid;

 insert into public.hq_workforce_memory(memory_key,version,memory_type,content,provenance,confidence,scope_type,jurisdictions,authoritative,valid_until)
 values('planning-quality-context',1,'lesson','{"lesson":"Prefer curriculum source of truth"}','{"source":"acceptance"}',.95,'platform_internal',array['global'],true,clock_timestamp()+interval '1 hour');
 ctx:=public.hq_workforce_collect_objective_context(oid,25);
 if jsonb_array_length(ctx->'memory')<1 or ctx->'source'->'provenance'='{}'::jsonb then raise exception 'objective_context_not_collected:%',ctx; end if;

 built:=public.hq_workforce_build_shadow_plan(oid);
 if built->>'status'<>'simulated' then raise exception 'multi_worker_plan_not_built:%',built; end if;
 if (built->>'competency_count')::int<>2 or jsonb_array_length(built->'workers')<>2 then raise exception 'full_specialist_composition_failed:%',built; end if;
 if (built->>'collaborations')::int<>1 then raise exception 'collaboration_not_created:%',built; end if;
 pid:=(built->>'plan_id')::uuid;
 if (select count(*) from public.hq_workforce_plan_steps where plan_id=pid)<>2 then raise exception 'plan_step_count_wrong'; end if;
 if not exists(select 1 from public.hq_workforce_collaborations where plan_id=pid and authority_snapshot->>'authority_transfer'='false') then raise exception 'collaboration_authority_transfer_not_explicitly_false'; end if;

 alt:=public.hq_workforce_generate_shadow_plan_alternative(pid);
 if alt->>'status'<>'simulated' then raise exception 'real_alternative_plan_not_generated:%',alt; end if;
 aid:=(alt->>'alternative_plan_id')::uuid;
 if not exists(select 1 from public.hq_workforce_plan_steps p join public.hq_workforce_plan_steps a on a.ordinal=p.ordinal where p.plan_id=pid and a.plan_id=aid and p.worker_key<>a.worker_key) then raise exception 'alternative_plan_has_no_real_assignment_difference'; end if;
 selected:=public.hq_workforce_select_least_powerful_plan(oid);
 if selected is null or selected not in (pid,aid) then raise exception 'least_powerful_selection_not_among_valid_plans:%',selected; end if;

 gap:=public.hq_workforce_diagnose_capability_gap(oid);
 if gap->>'diagnosis'<>'no_gap' or coalesce((gap->>'worker_creation_recommended')::boolean,true) then raise exception 'healthy_objective_misdiagnosed:%',gap; end if;
end $$;

-- Missing skill must be diagnosed by the missing competency, even when unrelated skills/resources exist.
do $$ declare oid uuid; d jsonb; begin
 insert into public.hq_workforce_objectives(objective_key,statement,source_type,provenance,scope_type,jurisdiction,required_competencies,status)
 values('missing-specialist-'||gen_random_uuid()::text,'Need a competency that does not exist','acceptance',jsonb_build_object('suite','planning-quality'),'platform_internal','global',array['nonexistent.deep.specialism'],'planning') returning id into oid;
 d:=public.hq_workforce_diagnose_capability_gap(oid);
 if d->>'diagnosis'<>'skill_gap' then raise exception 'unrelated_global_resources_masked_skill_gap:%',d; end if;
 if coalesce((d->>'worker_creation_recommended')::boolean,true) then raise exception 'skill_gap_improperly_became_worker_creation:%',d; end if;
 if not exists(select 1 from public.hq_workforce_skill_candidates where detected_gap->>'objective_id'=oid::text) then raise exception 'skill_genesis_not_triggered_for_real_gap'; end if;
end $$;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'planning_quality_test_changed_runtime_boundary'; end if;
end $$;
rollback;
