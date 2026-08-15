-- WE-R1.3X bootstrap: decouple reasoning capabilities from execution ToolContracts and
-- install the first deployment-certified, read-only Shadow competency/capability graph.
-- This migration does NOT enable Shadow, heartbeat, Factory, runtime execution or autonomy.

alter table public.hq_workforce_skill_manifests
  alter column tool_contract_id drop not null,
  add column if not exists capability_mode text not null default 'execution',
  add column if not exists certification_evidence jsonb not null default '{}'::jsonb;

alter table public.hq_workforce_skill_manifests
  drop constraint if exists hq_workforce_skill_manifests_capability_mode_check,
  add constraint hq_workforce_skill_manifests_capability_mode_check
    check(capability_mode in ('execution','shadow_reasoning')),
  drop constraint if exists hq_workforce_skill_manifests_tool_mode_check,
  add constraint hq_workforce_skill_manifests_tool_mode_check
    check(
      (capability_mode='execution' and tool_contract_id is not null)
      or
      (capability_mode='shadow_reasoning' and tool_contract_id is null and shadow_capable and autonomy_required=0 and requires_human_approval)
    );

-- Existing manifests retain their historical execution semantics.
update public.hq_workforce_skill_manifests
set capability_mode='execution'
where tool_contract_id is not null and capability_mode<>'execution';

-- Registered production facts are resources, not implicit permissions. Direct table grants remain unchanged.
insert into public.hq_workforce_resources(
 resource_key,version,resource_type,display_name,description,owner_key,provenance,trust_tier,freshness_policy,
 data_classifications,jurisdictions,allowed_scope_types,allowed_operations,required_autonomy,risk_class,
 cost_profile,quota_policy,latency_profile,health_status,enabled,shadow_capable,metadata
) values
 ('vibeschool.internal.work_items',1,'table','Vibeschool internal work queue','Approved operational facts used for Shadow work detection and planning.','platform_governance',
  '{"schema":"public","relation":"hq_work_items","access":"governed_function_only"}',5,'{"mode":"live"}',array['internal'],array['global'],array['platform_internal','global'],array['read'],0,0,'{"unit_cost":0}','{"bounded_by_shadow_scheduler":true}','{"class":"local_database"}','healthy',true,true,'{"canonical":true}'),
 ('vibeschool.worker.engine.evidence',1,'table','Worker Engine evidence store','Existing governed trace/evidence facts available for verification and learning.','platform_governance',
  '{"schema":"public","relation":"hq_workforce_evidence","access":"governed_function_only"}',5,'{"mode":"live"}',array['internal'],array['global'],array['platform_internal','global'],array['read'],0,0,'{"unit_cost":0}','{"read_only_for_planning":true}','{"class":"local_database"}','healthy',true,true,'{"canonical":true}')
on conflict(resource_key,version) do update set health_status='healthy',enabled=true,shadow_capable=true,updated_at=clock_timestamp();

-- Competency vectors are independent of departments. Inserts are conditional so blank/replay environments remain valid.
insert into public.hq_workforce_worker_competencies(worker_key,competency_key,version,proficiency,reliability,certification_status,evidence,allowed_scope_types,jurisdictions,last_evaluated_at)
select x.worker_key,x.competency_key,1,x.proficiency,x.reliability,'certified',
       jsonb_build_object('mode','WE-R1.3X_bootstrap','basis','existing worker mission/title plus repository-certified Shadow contracts'),
       array['platform_internal','global'],array['global'],clock_timestamp()
from (values
 ('ops-worker-01','operations.triage',0.95::numeric,0.90::numeric),
 ('quality-worker-01','quality.analysis',0.98::numeric,0.92::numeric),
 ('quality-worker-01','product.analysis',0.95::numeric,0.90::numeric),
 ('curriculum-worker-01','content.quality',0.95::numeric,0.90::numeric),
 ('curriculum-worker-01','curriculum.analysis',0.98::numeric,0.93::numeric),
 ('curriculum-worker-01','learning.analysis',0.78::numeric,0.75::numeric),
 ('growth-worker-01','growth.analysis',0.95::numeric,0.90::numeric),
 ('finance-worker-01','finance.analysis',0.95::numeric,0.90::numeric),
 ('hr-worker-01','people.operations',0.94::numeric,0.88::numeric),
 ('school-success-worker-01','school.success',0.96::numeric,0.90::numeric),
 ('security-worker-01','security.analysis',0.97::numeric,0.92::numeric),
 ('support-worker-01','support.operations',0.94::numeric,0.88::numeric),
 ('publishing-worker-01','publishing.operations',0.95::numeric,0.90::numeric)
) as x(worker_key,competency_key,proficiency,reliability)
where exists(select 1 from public.hq_workforce_workers w where w.worker_key=x.worker_key)
on conflict(worker_key,competency_key,version) do nothing;

-- Reasoning-only skills: no ToolContract, no executable handler, L0, human-reviewed, verification required.
insert into public.hq_workforce_skill_manifests(
 skill_key,version,tool_contract_id,autonomy_required,risk_class,allowed_scope_types,allowed_data_classes,
 max_records_affected,max_attempts,max_runtime_ms,requires_human_approval,verification_required,compensation_strategy,
 owner_key,certification_status,certified_at,purpose,input_contract,resource_contract,preconditions,expected_outcome,
 verification_contract,failure_handling,retry_policy,escalation_contract,shadow_capable,immutable_version_key,
 capability_mode,certification_evidence
) values
 ('shadow.operations.triage',1,null,0,0,array['platform_internal','global'],array['internal'],0,1,30000,true,true,'none_read_only','platform_governance','certified',clock_timestamp(),'Analyze operational work and propose evidence-backed priority/ownership without mutation.','{"requires":["work_item"]}','{"read":["vibeschool.internal.work_items"]}','[{"runtime":"shadow"}]','{"recommendation":true}','{"evidence_required":true}','{"on_uncertainty":"escalate"}','{"max_attempts":1}','{"human_review":true}',true,'shadow.operations.triage@1','shadow_reasoning','{"mission":"WE-R1.3X","mode":"deployment_certified","autonomous_execution":false}'),
 ('shadow.quality.analysis',1,null,0,0,array['platform_internal','global'],array['internal'],0,1,30000,true,true,'none_read_only','platform_governance','certified',clock_timestamp(),'Analyze verification/quality backlog and propose evidence-backed remediation.','{"requires":["work_item"]}','{"read":["vibeschool.internal.work_items","vibeschool.worker.engine.evidence"]}','[{"runtime":"shadow"}]','{"quality_recommendation":true}','{"evidence_required":true}','{"on_uncertainty":"escalate"}','{"max_attempts":1}','{"human_review":true}',true,'shadow.quality.analysis@1','shadow_reasoning','{"mission":"WE-R1.3X","mode":"deployment_certified","autonomous_execution":false}'),
 ('shadow.content.quality',1,null,0,0,array['platform_internal','global'],array['internal'],0,1,30000,true,true,'none_read_only','platform_governance','certified',clock_timestamp(),'Analyze content-quality work without publishing or mutating curriculum.','{"requires":["work_item"]}','{"read":["vibeschool.internal.work_items","vibeschool.worker.engine.evidence"]}','[{"runtime":"shadow"}]','{"content_recommendation":true}','{"evidence_required":true}','{"on_uncertainty":"escalate"}','{"max_attempts":1}','{"human_review":true}',true,'shadow.content.quality@1','shadow_reasoning','{"mission":"WE-R1.3X","mode":"deployment_certified","autonomous_execution":false}'),
 ('shadow.curriculum.analysis',1,null,0,0,array['platform_internal','global'],array['internal'],0,1,30000,true,true,'none_read_only','platform_governance','certified',clock_timestamp(),'Reason about curriculum-related operational work using registered evidence only.','{"requires":["work_item"]}','{"read":["vibeschool.internal.work_items"]}','[{"runtime":"shadow"}]','{"curriculum_recommendation":true}','{"evidence_required":true}','{"on_uncertainty":"escalate"}','{"max_attempts":1}','{"human_review":true}',true,'shadow.curriculum.analysis@1','shadow_reasoning','{"mission":"WE-R1.3X","mode":"deployment_certified","autonomous_execution":false}'),
 ('shadow.learning.analysis',1,null,0,0,array['platform_internal','global'],array['internal'],0,1,30000,true,true,'none_read_only','platform_governance','certified',clock_timestamp(),'Analyze learning/content backlog signals and propose nonconsequential next actions.','{"requires":["work_item"]}','{"read":["vibeschool.internal.work_items"]}','[{"runtime":"shadow"}]','{"learning_recommendation":true}','{"evidence_required":true}','{"on_uncertainty":"escalate"}','{"max_attempts":1}','{"human_review":true}',true,'shadow.learning.analysis@1','shadow_reasoning','{"mission":"WE-R1.3X","mode":"deployment_certified","autonomous_execution":false}')
on conflict(skill_key,version) do nothing;

-- Explicit skill/resource bindings.
insert into public.hq_workforce_skill_resources(skill_manifest_id,resource_id,usage_role,required,operation)
select s.id,r.id,'input',true,'read'
from public.hq_workforce_skill_manifests s
join public.hq_workforce_resources r on r.resource_key='vibeschool.internal.work_items' and r.version=1
where s.skill_key in ('shadow.operations.triage','shadow.quality.analysis','shadow.content.quality','shadow.curriculum.analysis','shadow.learning.analysis')
on conflict(skill_manifest_id,resource_id,usage_role) do nothing;
insert into public.hq_workforce_skill_resources(skill_manifest_id,resource_id,usage_role,required,operation)
select s.id,r.id,'verification',false,'read'
from public.hq_workforce_skill_manifests s
join public.hq_workforce_resources r on r.resource_key='vibeschool.worker.engine.evidence' and r.version=1
where s.skill_key in ('shadow.quality.analysis','shadow.content.quality')
on conflict(skill_manifest_id,resource_id,usage_role) do nothing;

-- Competency → capability policy. Version 1 is deployment policy, not runtime self-certification.
insert into public.hq_workforce_competency_capabilities(competency_key,skill_key,version,min_skill_version,required,priority,status,approved_at) values
 ('operations.triage','shadow.operations.triage',1,1,true,1000,'approved',clock_timestamp()),
 ('quality.analysis','shadow.quality.analysis',1,1,true,1000,'approved',clock_timestamp()),
 ('content.quality','shadow.content.quality',1,1,true,1000,'approved',clock_timestamp()),
 ('curriculum.analysis','shadow.curriculum.analysis',1,1,true,1000,'approved',clock_timestamp()),
 ('learning.analysis','shadow.learning.analysis',1,1,true,1000,'approved',clock_timestamp())
on conflict(competency_key,skill_key,version) do nothing;

-- Work semantics for the exact first production Shadow signals already observed.
insert into public.hq_workforce_competency_requirements(rule_key,version,department_key,work_type,source_type,competency_keys,priority,status,approved_at) values
 ('prod.quality.verification_backlog',1,'quality','verification_backlog','workforce_gap',array['quality.analysis'],2000,'approved',clock_timestamp()),
 ('prod.content.quality_failure',1,'content','quality_failure','workforce_gap',array['content.quality','curriculum.analysis'],2000,'approved',clock_timestamp()),
 ('prod.learning.content_backlog',1,'learning','content_backlog','workforce_gap',array['learning.analysis','curriculum.analysis'],2000,'approved',clock_timestamp())
on conflict(rule_key,version) do nothing;

-- Certified Shadow reasoning may be evaluated hypothetically, but cannot become executable
-- because it has no ToolContract and runtime execution remains disabled.
do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'shadow_capability_bootstrap_violated_L0_boundary'; end if;
 if exists(select 1 from public.hq_workforce_skill_manifests where capability_mode='shadow_reasoning' and tool_contract_id is not null) then raise exception 'shadow_reasoning_capability_has_execution_tool'; end if;
end $$;
