-- WE-R1.3X legacy reconciliation: one canonical intelligence path over preserved safety/execution substrates.
-- Shadow/L0 only. No heartbeat/factory activation, no consequential execution, no worker creation/certification.
-- access: service-only public.hq_workforce_architecture_components
-- authorization-test: public.hq_workforce_architecture_components denies anon/authenticated direct access; service_role manages canonical/superseded architecture declarations.
-- access: service-only public.hq_workforce_competency_requirements
-- authorization-test: public.hq_workforce_competency_requirements denies anon/authenticated direct access; service_role manages objective/work competency rules.
-- access: service-only public.hq_workforce_factory_recommendations
-- authorization-test: public.hq_workforce_factory_recommendations denies anon/authenticated direct access; service_role records recommendation-only gap diagnoses.

create table public.hq_workforce_architecture_components (
  component_key text primary key,
  component_type text not null check(component_type in ('safety','identity','authority','execution_substrate','detector','router','planner','capability','resource','memory','evaluation','factory','scheduler','ui','governance')),
  lineage text not null,
  disposition text not null check(disposition in ('keep','upgrade','supersede','consolidate','remove')),
  canonical boolean not null default false,
  replacement_component_key text,
  rationale text not null,
  activation_allowed boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  check (canonical or disposition<>'keep' or component_type in ('safety','identity','authority','execution_substrate','governance'))
);

insert into public.hq_workforce_architecture_components(component_key,component_type,lineage,disposition,canonical,replacement_component_key,rationale,activation_allowed) values
 ('authority_lifecycle_kernel','authority','WE-L1','keep',true,null,'Identity, lifecycle, capability grants and budgets remain authoritative safety primitives.',false),
 ('task_tool_gateway','execution_substrate','WE-L2','keep',true,null,'Preserved as a future separately-authorized execution substrate; never a planning or routing authority in WE-R1.3X.',false),
 ('legacy_shadow_certification','governance','WE-L3','keep',true,null,'Independent certification evidence remains valid and distinct from operational shadow traces.',false),
 ('autonomous_heartbeat_intelligence','scheduler','WE-L4/WE-L9','supersede',false,'r13x_objective_planning','Heartbeat-driven task intelligence predates objective planning and capability composition.',false),
 ('deterministic_model_gateway','resource','WE-L5','upgrade',false,'r13x_resource_registry','Model access becomes a governed registered resource rather than an isolated intelligence lane.',false),
 ('reference_operations_worker','governance','WE-L6','keep',false,null,'Retained as regression evidence, not the canonical intelligence architecture.',false),
 ('legacy_worker_factory','factory','WE-L7-WE-L13','supersede',false,'r13x_factory_recommendation','Factory creation path remains OFF; capability/routing/resource/capacity diagnosis must occur first.',false),
 ('legacy_workforce_demand_sensor','detector','WE-L11','supersede',false,'r13x_objective_planning','Backlog is operational evidence, not proof that a new worker is required.',false),
 ('lane_worker_router','router','WE-R1.3','supersede',false,'r13x_competency_router','Literal department/lane equality is replaced by certified competency fit.',false),
 ('single_skill_selector','capability','WE-R1.3','supersede',false,'r13x_capability_graph','Single-skill selection is replaced by certified capability composition and plan DAGs.',false),
 ('r13x_resource_registry','resource','WE-R1.3X','keep',true,null,'Canonical governed resource discovery layer.',false),
 ('r13x_competency_router','router','WE-R1.3X','keep',true,null,'Canonical worker-selection model.',false),
 ('r13x_capability_graph','capability','WE-R1.3X','keep',true,null,'Canonical composable capability model.',false),
 ('r13x_objective_planning','planner','WE-R1.3X','keep',true,null,'Canonical objective-first planning and least-powerful-sufficient-plan model.',false),
 ('r13x_memory','memory','WE-R1.3X','keep',true,null,'Canonical provenance-aware organisational memory.',false),
 ('r13x_evaluation','evaluation','WE-R1.3X','keep',true,null,'Canonical empirical reliability and confidence calibration model.',false),
 ('r13x_factory_recommendation','factory','WE-R1.3X','keep',true,null,'Recommendation-only gap diagnosis; cannot create, certify or authorize workers.',false)
on conflict(component_key) do update set component_type=excluded.component_type,lineage=excluded.lineage,disposition=excluded.disposition,canonical=excluded.canonical,replacement_component_key=excluded.replacement_component_key,rationale=excluded.rationale,activation_allowed=excluded.activation_allowed,updated_at=clock_timestamp();

create table public.hq_workforce_competency_requirements (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null,
  version integer not null default 1 check(version>0),
  department_key text,
  work_type text,
  source_type text,
  competency_keys text[] not null check(cardinality(competency_keys)>0),
  priority integer not null default 100 check(priority>=0),
  status text not null default 'draft' check(status in ('draft','approved','superseded','revoked')),
  approved_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique(rule_key,version),
  check(status<>'approved' or approved_at is not null)
);
create index hq_workforce_competency_requirements_lookup_idx on public.hq_workforce_competency_requirements(status,department_key,work_type,source_type,priority);

-- Broad starting ontology. More-specific approved work/source rules outrank department fallback.
insert into public.hq_workforce_competency_requirements(rule_key,version,department_key,competency_keys,priority,status,approved_at) values
 ('department.executive',1,'executive',array['operations.triage','strategy.analysis'],500,'approved',clock_timestamp()),
 ('department.operations',1,'operations',array['operations.triage'],500,'approved',clock_timestamp()),
 ('department.product',1,'product',array['product.analysis','quality.analysis'],500,'approved',clock_timestamp()),
 ('department.engineering',1,'engineering',array['engineering.analysis','quality.analysis'],500,'approved',clock_timestamp()),
 ('department.content',1,'content',array['content.quality','curriculum.analysis'],500,'approved',clock_timestamp()),
 ('department.quality',1,'quality',array['quality.analysis'],500,'approved',clock_timestamp()),
 ('department.learning',1,'learning',array['learning.analysis','curriculum.analysis'],500,'approved',clock_timestamp()),
 ('department.growth',1,'growth',array['growth.analysis'],500,'approved',clock_timestamp()),
 ('department.finance',1,'finance',array['finance.analysis'],500,'approved',clock_timestamp()),
 ('department.people',1,'people',array['people.operations'],500,'approved',clock_timestamp()),
 ('department.school_success',1,'school_success',array['school.success'],500,'approved',clock_timestamp())
on conflict(rule_key,version) do nothing;

create or replace function public.hq_workforce_required_competencies_for_work(p_work_item_id uuid)
returns text[] language plpgsql security definer set search_path=public,pg_temp stable as $$
declare w public.hq_work_items%rowtype; v text[];
begin
 select * into w from public.hq_work_items where id=p_work_item_id;
 if not found then raise exception 'work_item_not_found'; end if;
 select r.competency_keys into v
 from public.hq_workforce_competency_requirements r
 where r.status='approved'
   and (r.department_key is null or r.department_key=w.department_key)
   and (r.work_type is null or r.work_type=w.work_type)
   and (r.source_type is null or r.source_type=w.source_type)
 order by ((r.work_type is not null)::int+(r.source_type is not null)::int+(r.department_key is not null)::int) desc,r.priority desc,r.version desc
 limit 1;
 return coalesce(v,array['operations.triage']::text[]);
end $$;

create table public.hq_workforce_factory_recommendations (
 id uuid primary key default gen_random_uuid(), trace_id uuid not null default gen_random_uuid(), objective_id uuid references public.hq_workforce_objectives(id) on delete set null,
 diagnosis text not null check(diagnosis in ('routing_gap','resource_gap','capability_gap','skill_gap','collaboration_gap','capacity_gap','worker_gap','no_gap')),
 evidence jsonb not null default '{}'::jsonb, proposed_action jsonb not null default '{}'::jsonb,
 worker_creation_recommended boolean not null default false,
 status text not null default 'proposed' check(status in ('proposed','reviewed','rejected','closed')),
 created_at timestamptz not null default clock_timestamp(),
 check(worker_creation_recommended=false or diagnosis='worker_gap')
);

create or replace function public.hq_workforce_diagnose_capability_gap(p_objective_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.hq_workforce_objectives%rowtype; v_workers int; v_skills int; v_resources int; v_collaborators int; v_diagnosis text; v_create boolean:=false; v_id uuid;
begin
 select * into o from public.hq_workforce_objectives where id=p_objective_id; if not found then raise exception 'objective_not_found'; end if;
 select count(*) into v_workers from public.hq_workforce_rank_workers_by_competency(o.required_competencies,o.scope_type,o.jurisdiction,100);
 select count(*) into v_skills from public.hq_workforce_skill_manifests m where m.certification_status='certified' and m.shadow_capable and (m.expires_at is null or m.expires_at>clock_timestamp()) and (o.scope_type=any(m.allowed_scope_types) or 'global'=any(m.allowed_scope_types));
 select count(*) into v_resources from public.hq_workforce_discover_shadow_resources(o.scope_type,o.jurisdiction,'read',100);
 select count(distinct worker_key) into v_collaborators from public.hq_workforce_rank_workers_by_competency(o.required_competencies,o.scope_type,o.jurisdiction,100);
 if cardinality(o.required_competencies)=0 then v_diagnosis:='routing_gap';
 elsif v_resources=0 then v_diagnosis:='resource_gap';
 elsif v_skills=0 then v_diagnosis:='skill_gap';
 elsif v_workers=0 then v_diagnosis:='routing_gap';
 elsif v_collaborators>0 then v_diagnosis:='no_gap';
 else v_diagnosis:='worker_gap'; v_create:=true;
 end if;
 insert into public.hq_workforce_factory_recommendations(objective_id,diagnosis,evidence,proposed_action,worker_creation_recommended)
 values(o.id,v_diagnosis,jsonb_build_object('required_competencies',o.required_competencies,'matching_workers',v_workers,'certified_shadow_skills',v_skills,'registered_resources',v_resources),
        case when v_diagnosis='resource_gap' then jsonb_build_object('action','register_or_restore_resource')
             when v_diagnosis='skill_gap' then jsonb_build_object('action','propose_skill_candidate')
             when v_diagnosis='routing_gap' then jsonb_build_object('action','review_competency_mapping_or_certify_existing_worker_competency')
             when v_diagnosis='worker_gap' then jsonb_build_object('action','propose_worker_specification_for_human_review')
             else jsonb_build_object('action','use_existing_capability') end,
        v_create) returning id into v_id;
 if v_diagnosis='skill_gap' then perform public.hq_workforce_propose_skill_candidate(jsonb_build_object('objective_id',o.id,'required_competencies',o.required_competencies),jsonb_build_object('purpose',o.statement,'scope_type',o.scope_type,'autonomy_ceiling',0),'[]','[]'); end if;
 return jsonb_build_object('recommendation_id',v_id,'diagnosis',v_diagnosis,'worker_creation_recommended',v_create,'factory_execution',false);
end $$;

-- Replace the WE-R1.3 lane-equality recommendation router with objective/competency/plan-first Shadow routing.
create or replace function public.hq_workforce_shadow_recommend_candidate(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ec public.hq_workforce_engine_contract%rowtype; c public.hq_workforce_shadow_candidates%rowtype; wi public.hq_work_items%rowtype;
 req text[]; v_worker text; sm public.hq_workforce_skill_manifests%rowtype; obj uuid; plan uuid; step uuid; dag jsonb; tr uuid; auth_result jsonb; proposed jsonb; expected jsonb; v_confidence numeric:=0.8500; resource_count int;
begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true; if not found then raise exception 'runtime_contract_missing'; end if;
 if not ec.shadow_enabled or not ec.shadow_scheduler_enabled or ec.shadow_global_stop then raise exception 'shadow_scheduler_global_stop'; end if;
 if ec.shadow_anomaly_paused then return jsonb_build_object('mode','shadow','status','paused','reason','shadow_scheduler_anomaly_paused','consequential_execution',false); end if;
 if ec.runtime_execution_enabled or ec.runtime_autonomy_level>0 or ec.heartbeat_enabled or ec.factory_enabled then raise exception 'r13x_requires_runtime_factory_heartbeat_off'; end if;
 select * into c from public.hq_workforce_shadow_candidates where id=p_candidate_id for update; if not found then raise exception 'shadow_candidate_not_found'; end if;
 if c.status not in ('candidate','escalated') then return jsonb_build_object('mode','shadow','status',c.status,'candidate_id',c.id,'trace_id',c.trace_id,'consequential_execution',false); end if;
 select * into wi from public.hq_work_items where id=c.source_work_item_id; if not found or wi.status<>'open' then update public.hq_workforce_shadow_candidates set status='closed',reasoning_summary='Source work is no longer open.' where id=c.id; return jsonb_build_object('mode','shadow','status','closed','reason','source_work_not_open','consequential_execution',false); end if;
 req:=public.hq_workforce_required_competencies_for_work(wi.id);

 insert into public.hq_workforce_objectives(objective_key,statement,scope_type,scope_key,jurisdiction,required_competencies,desired_outcome,constraints,risk_ceiling,autonomy_ceiling,status)
 values('shadow-candidate:'||c.id::text,coalesce(wi.title,'Operational work'), 'platform_internal',wi.id::text,'global',req,
        jsonb_build_object('work_item_id',wi.id,'target','evidence-backed recommendation'),jsonb_build_object('consequential_execution',false),2,0,'planning') returning id into obj;

 select rw.worker_key into v_worker from public.hq_workforce_rank_workers_by_competency(req,'platform_internal','global',100) rw
 join public.hq_workforce_workers w on w.worker_key=rw.worker_key and w.status='active'
 where public.hq_workforce_current_lifecycle_state(rw.worker_key)='active'
 order by rw.matched_competencies desc,rw.fit_score desc,rw.worker_key limit 1;
 if v_worker is null then
   update public.hq_workforce_objectives set status='escalated',updated_at=clock_timestamp() where id=obj;
   update public.hq_workforce_shadow_candidates set status='escalated',reasoning_summary='No active certified competency match; lane equality was not used.' where id=c.id;
   return jsonb_build_object('mode','shadow','status','escalated','reason','competency_routing_gap','objective_id',obj,'gap',public.hq_workforce_diagnose_capability_gap(obj),'consequential_execution',false);
 end if;

 select m.* into sm from public.hq_workforce_skill_manifests m
 where m.certification_status='certified' and m.shadow_capable and (m.expires_at is null or m.expires_at>clock_timestamp())
   and ('platform_internal'=any(m.allowed_scope_types) or 'global'=any(m.allowed_scope_types))
   and exists(select 1 from public.hq_workforce_skill_resources sr join public.hq_workforce_resources r on r.id=sr.resource_id where sr.skill_manifest_id=m.id and r.enabled and r.shadow_capable and r.health_status in ('healthy','degraded') and r.required_autonomy=0 and r.risk_class<=2)
 order by m.risk_class,m.autonomy_required,m.version desc limit 1;
 if not found then
   update public.hq_workforce_objectives set status='escalated',updated_at=clock_timestamp() where id=obj;
   update public.hq_workforce_shadow_candidates set status='escalated',worker_key=v_worker,reasoning_summary='No certified shadow capability with an authorized registered resource.' where id=c.id;
   return jsonb_build_object('mode','shadow','status','escalated','reason','capability_or_resource_gap','objective_id',obj,'worker_key',v_worker,'gap',public.hq_workforce_diagnose_capability_gap(obj),'consequential_execution',false);
 end if;

 insert into public.hq_workforce_plans(objective_id,strategy_key,status,expected_quality,confidence,required_risk,required_autonomy,estimated_cost,estimated_latency_ms,rationale,verification_contract)
 values(obj,'least-powerful-certified-shadow','draft',0.85,v_confidence,sm.risk_class,0,0,0,jsonb_build_object('worker_key',v_worker,'competencies',req,'skill_key',sm.skill_key),jsonb_build_object('requires_evidence',true,'human_decision',true)) returning id into plan;
 insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,skill_manifest_id,worker_key,required_competencies,input_contract,expected_output,verification_contract,required_risk,required_autonomy)
 values(plan,'analyze-and-propose',1,sm.id,v_worker,req,jsonb_build_object('work_item_id',wi.id),jsonb_build_object('recommendation',true),jsonb_build_object('evidence_required',true),sm.risk_class,0) returning id into step;
 select count(*) into resource_count from public.hq_workforce_resolve_step_resources(step,'read',25);
 dag:=public.hq_workforce_validate_plan_dag(plan);
 if not coalesce((dag->>'valid')::boolean,false) or resource_count=0 then
   update public.hq_workforce_plan_steps set status='blocked' where id=step; update public.hq_workforce_objectives set status='escalated',updated_at=clock_timestamp() where id=obj;
   return jsonb_build_object('mode','shadow','status','escalated','reason','plan_validation_or_resource_resolution_failed','objective_id',obj,'plan_id',plan,'dag',dag,'resources',resource_count,'consequential_execution',false);
 end if;
 update public.hq_workforce_plans set status='simulated' where id=plan; update public.hq_workforce_objectives set status='planned',updated_at=clock_timestamp() where id=obj;

 insert into public.hq_workforce_shadow_traces(cycle_key,worker_key,lane_key,skill_manifest_id,scope_type,scope_ref,status,confidence)
 values('r13x-objective:'||obj::text,v_worker,c.lane_key,sm.id,'platform_internal',c.scope_ref,'reasoning',v_confidence) returning trace_id into tr;
 update public.hq_workforce_shadow_candidates set trace_id=tr,worker_key=v_worker,skill_manifest_id=sm.id,status='recommended',confidence=v_confidence,reasoning_summary='R1.3X objective-first routing: certified competencies → plan → capability → registered resources; no lane equality.' where id=c.id;
 insert into public.hq_workforce_evidence(trace_id,evidence_kind,source_type,source_ref,observed_at,classification,payload)
 values(tr,'fact','hq_work_items',wi.id::text,clock_timestamp(),'internal',jsonb_build_object('work_item',to_jsonb(wi),'objective_id',obj,'plan_id',plan,'required_competencies',req,'resource_count',resource_count));
 insert into public.hq_workforce_shadow_events(trace_id,event_kind,sequence_no,payload) values
 (tr,'observation',1,jsonb_build_object('work_item_id',wi.id)),(tr,'candidate_job',2,jsonb_build_object('candidate_id',c.id)),
 (tr,'reasoning',3,jsonb_build_object('architecture','WE-R1.3X','objective_id',obj,'plan_id',plan,'competencies',req,'dag',dag)),
 (tr,'skill_selection',4,jsonb_build_object('skill_key',sm.skill_key,'version',sm.version,'worker_key',v_worker,'resource_count',resource_count));
 proposed:=jsonb_build_object('action_key','recommend_internal_work_response','work_item_id',wi.id,'worker_key',v_worker,'objective_id',obj,'plan_id',plan,'execute',false);
 expected:=jsonb_build_object('expected_state','human-reviewed evidence-backed recommendation','verification','human decision and later measured outcome');
 insert into public.hq_workforce_shadow_events(trace_id,event_kind,sequence_no,payload) values (tr,'proposed_action',5,proposed),(tr,'expected_outcome',6,expected);
 auth_result:=public.hq_workforce_shadow_evaluate_authority(tr,sm.id,0::smallint,sm.risk_class::smallint,'platform_internal',c.scope_ref);
 insert into public.hq_workforce_shadow_events(trace_id,event_kind,sequence_no,payload) values(tr,'authority_result',7,auth_result);
 insert into public.hq_workforce_shadow_decisions(trace_id,decision_key,proposed_action,required_authority,hypothetical_authority_result,authority_reason,state)
 values(tr,'WE-R13X-'||c.id::text,proposed,jsonb_build_object('autonomy_level',0,'risk_class',sm.risk_class,'scope_type','platform_internal'),case when auth_result->>'decision'='allow' then 'allow' else 'deny' end,coalesce(auth_result->>'reason','fail_closed'),'awaiting_review');
 update public.hq_workforce_shadow_traces set status='awaiting_review',predicted_outcome=expected,confidence=v_confidence where trace_id=tr;
 insert into public.hq_workforce_shadow_resource_usage(trace_id,worker_key,resource_kind,window_started_at,amount) values(tr,v_worker,'recommendation',date_trunc('hour',clock_timestamp()),1);
 return jsonb_build_object('mode','shadow','architecture','WE-R1.3X','status','awaiting_review','candidate_id',c.id,'trace_id',tr,'objective_id',obj,'plan_id',plan,'worker_key',v_worker,'skill_key',sm.skill_key,'required_competencies',req,'resource_count',resource_count,'authority',auth_result,'consequential_execution',false);
end $$;

alter table public.hq_workforce_architecture_components enable row level security;
alter table public.hq_workforce_competency_requirements enable row level security;
alter table public.hq_workforce_factory_recommendations enable row level security;
revoke all on public.hq_workforce_architecture_components,public.hq_workforce_competency_requirements,public.hq_workforce_factory_recommendations from public,anon,authenticated;
grant select,insert,update on public.hq_workforce_architecture_components,public.hq_workforce_competency_requirements,public.hq_workforce_factory_recommendations to service_role;
revoke all on function public.hq_workforce_required_competencies_for_work(uuid),public.hq_workforce_diagnose_capability_gap(uuid),public.hq_workforce_shadow_recommend_candidate(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_required_competencies_for_work(uuid),public.hq_workforce_diagnose_capability_gap(uuid),public.hq_workforce_shadow_recommend_candidate(uuid) to service_role;

-- Reconciliation invariant: legacy safety substrate stays present but all autonomous positive controls remain OFF.
do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'WE-R1.3X reconciliation violated L0/factory/heartbeat boundary'; end if;
 if exists(select 1 from public.hq_workforce_architecture_components where component_key in ('autonomous_heartbeat_intelligence','legacy_worker_factory','lane_worker_router','single_skill_selector') and canonical) then raise exception 'inferior_legacy_intelligence_remains_canonical'; end if;
end $$;
