-- Content Factory production commissioning: R2 execution-governance registration.
-- NON-ACTIVATING. This migration certifies the three R2 capability/skill bindings only.
-- It does not create capability-authority grants, tasks, budgets, workers, runtime execution,
-- heartbeat, Factory, Shadow, autonomy, risk, publication authority, or owner approvals.

insert into public.hq_workforce_capabilities(
  capability_key,version,display_name,purpose,input_contract,output_contract,
  verification_contract,risk_class,autonomy_ceiling,lifecycle_status,provenance
) values
(
  'content.research.execute',1,'Content Factory governed source discovery',
  'Discover candidate curriculum/content sources for one queued research job without self-certifying semantic support.',
  jsonb_build_object('resource_type','curriculum_research_job','max_records',1,'requires_exact_task_job_binding',true,'semantic_support_inference',false),
  jsonb_build_object('mutation','candidate_source_provenance_only','max_records',1,'semantic_verification','separate_certified_capability'),
  jsonb_build_object('task_job_binding',true,'budget_binding',true,'semantic_self_certification_denied',true,'retry_dead_letter_required',true),
  1,1,'certified',
  jsonb_build_object('mission','Content Factory R2 production commissioning','certification','non-activating','contract','content.research.execute@1')
),
(
  'content.evidence.semantic_verify',1,'Content Factory material-bound semantic verification',
  'Classify one candidate source only against retrieved immutable source material and bind the verdict to that material hash.',
  jsonb_build_object('resource_type','curriculum_intelligence_source','max_records',1,'actual_material_required',true,'model_memory_authority',false),
  jsonb_build_object('mutation','immutable_semantic_verdict','max_records',1,'material_hash_binding',true),
  jsonb_build_object('immutable_material',true,'database_quote_verification',true,'decisive_confidence_floor',0.85,'prompt_injection_treated_as_data',true),
  1,1,'certified',
  jsonb_build_object('mission','Content Factory R2 production commissioning','certification','non-activating','contract','content.evidence.semantic_verify@1')
),
(
  'content.authoring.source_grounded',1,'Content Factory source-grounded draft authoring',
  'Create one immutable editorial draft from the verified evidence packet without research, approval, apply, or publication authority.',
  jsonb_build_object('resource_type','curriculum_intelligence_proposal','max_records',1,'verified_evidence_packet_required',true,'outside_knowledge_authority',false),
  jsonb_build_object('mutation','immutable_authoring_draft_only','max_records',1,'human_acceptance_required',true,'publish_authority',false),
  jsonb_build_object('evidence_packet_hash_binding',true,'current_content_hash_binding',true,'database_quote_verification',true,'separate_human_acceptance',true,'separate_apply',true),
  1,1,'certified',
  jsonb_build_object('mission','Content Factory R2 production commissioning','certification','non-activating','contract','content.authoring.source_grounded@1')
)
on conflict(capability_key,version) do update set
  display_name=excluded.display_name,
  purpose=excluded.purpose,
  input_contract=excluded.input_contract,
  output_contract=excluded.output_contract,
  verification_contract=excluded.verification_contract,
  risk_class=excluded.risk_class,
  autonomy_ceiling=excluded.autonomy_ceiling,
  lifecycle_status='certified',
  provenance=excluded.provenance,
  updated_at=clock_timestamp();

insert into public.hq_workforce_skill_manifests(
  skill_key,version,tool_contract_id,autonomy_required,risk_class,allowed_scope_types,
  allowed_data_classes,max_records_affected,max_attempts,max_runtime_ms,
  requires_human_approval,verification_required,compensation_strategy,owner_key,
  certification_status,certified_at,purpose,input_contract,resource_contract,
  preconditions,expected_outcome,verification_contract,failure_handling,retry_policy,
  escalation_contract,shadow_capable,immutable_version_key,capability_mode,certification_evidence
)
select
  v.skill_key,1,tc.id,1,1,array['platform_internal']::text[],array['internal']::text[],
  1,3,v.max_runtime_ms,false,true,v.compensation_strategy,'content_governance',
  'certified',clock_timestamp(),v.purpose,v.input_contract,v.resource_contract,
  v.preconditions,v.expected_outcome,v.verification_contract,v.failure_handling,
  jsonb_build_object('max_attempts',3,'exponential_backoff',true,'dead_letter_on_exhaustion',true),
  jsonb_build_object('terminal_failure','human_review','publication_authority',false),
  false,v.skill_key||'@1','execution',
  jsonb_build_object('mission','Content Factory R2 production commissioning','repository_contracts','R2.1-R2.3 certified','activation',false)
from (values
  (
    'content.research.execute',
    'Discover candidate sources for one governed research job; never self-certify semantic support.',
    jsonb_build_object('task_job_binding',true,'domain_restrictions_enforced',true),
    jsonb_build_object('resource_type','curriculum_research_job','max_records',1),
    jsonb_build_array(jsonb_build_object('worker_runtime_authority','required'),jsonb_build_object('exact_job_binding','required')),
    jsonb_build_object('candidate_sources_persisted',true,'semantic_support','unverified_until_separate_verifier'),
    jsonb_build_object('no_model_call',true,'semantic_self_certification_denied',true,'budget_and_dead_letter_evidence',true),
    jsonb_build_object('on_failure','release_budget_retry_or_dead_letter'),
    'cancel_or_retry_research_job_without_publishing',
    60000
  ),
  (
    'content.evidence.semantic_verify',
    'Verify one source semantically against retrieved immutable material and persist a material-bound immutable verdict.',
    jsonb_build_object('source_id',true,'retrieved_material',true,'material_hash',true),
    jsonb_build_object('resource_type','curriculum_intelligence_source','max_records',1),
    jsonb_build_array(jsonb_build_object('worker_runtime_authority','required'),jsonb_build_object('actual_source_material','required')),
    jsonb_build_object('immutable_verdict',true,'material_hash_binding',true),
    jsonb_build_object('database_quote_verification',true,'confidence_floor',0.85,'outside_knowledge_denied',true),
    jsonb_build_object('on_failure','finalize_model_failure_retry_or_dead_letter'),
    'preserve_source_and_material; retry_or escalate without trusting verdict',
    90000
  ),
  (
    'content.authoring.source_grounded',
    'Draft one evidence-grounded content change; never research, approve, apply, or publish.',
    jsonb_build_object('verified_evidence_packet',true,'target_content_hash',true,'claim_hash',true),
    jsonb_build_object('resource_type','curriculum_intelligence_proposal','max_records',1),
    jsonb_build_array(jsonb_build_object('worker_runtime_authority','required'),jsonb_build_object('verified_proposal','required'),jsonb_build_object('evidence_ready_research','required')),
    jsonb_build_object('immutable_authoring_draft',true,'human_acceptance_required',true),
    jsonb_build_object('citation_material_binding',true,'target_staleness_check',true,'self_approval_denied',true,'publish_denied',true),
    jsonb_build_object('on_failure','finalize_model_failure_retry_or_dead_letter'),
    'discard unaccepted draft; target content remains unchanged',
    90000
  )
) as v(skill_key,purpose,input_contract,resource_contract,preconditions,expected_outcome,verification_contract,failure_handling,compensation_strategy,max_runtime_ms)
join public.hq_workforce_tool_contracts tc
  on tc.tool_key=case when v.skill_key='content.research.execute' then 'content.research.external' else v.skill_key end
 and tc.version=1 and tc.status='approved'
on conflict(tool_contract_id) do update set
  skill_key=excluded.skill_key,
  version=excluded.version,
  autonomy_required=excluded.autonomy_required,
  risk_class=excluded.risk_class,
  allowed_scope_types=excluded.allowed_scope_types,
  allowed_data_classes=excluded.allowed_data_classes,
  max_records_affected=excluded.max_records_affected,
  max_attempts=excluded.max_attempts,
  max_runtime_ms=excluded.max_runtime_ms,
  requires_human_approval=excluded.requires_human_approval,
  verification_required=excluded.verification_required,
  compensation_strategy=excluded.compensation_strategy,
  owner_key=excluded.owner_key,
  certification_status='certified',
  certified_at=coalesce(public.hq_workforce_skill_manifests.certified_at,clock_timestamp()),
  purpose=excluded.purpose,
  input_contract=excluded.input_contract,
  resource_contract=excluded.resource_contract,
  preconditions=excluded.preconditions,
  expected_outcome=excluded.expected_outcome,
  verification_contract=excluded.verification_contract,
  failure_handling=excluded.failure_handling,
  retry_policy=excluded.retry_policy,
  escalation_contract=excluded.escalation_contract,
  shadow_capable=false,
  immutable_version_key=excluded.immutable_version_key,
  capability_mode='execution',
  certification_evidence=excluded.certification_evidence;

insert into public.hq_workforce_skill_capabilities(skill_manifest_id,capability_id,coverage,role,evidence)
select sm.id,c.id,1,'implements',jsonb_build_object('mission','Content Factory R2 production commissioning','non_activating',true)
from public.hq_workforce_skill_manifests sm
join public.hq_workforce_tool_contracts tc on tc.id=sm.tool_contract_id
join public.hq_workforce_capabilities c on c.capability_key=sm.skill_key and c.version=1
where tc.handler_key in ('content.research.external','content.evidence.semantic_verify','content.authoring.source_grounded')
on conflict(skill_manifest_id,capability_id,role) do update set coverage=1,evidence=excluded.evidence;

do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_active integer;
  v_caps integer;
  v_skills integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'CF-R2 governance registration requires Worker Engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CF-R2 governance registration violated fail_closed_runtime_boundary';
  end if;

  select count(*) into v_caps from public.hq_workforce_capabilities
   where capability_key in ('content.research.execute','content.evidence.semantic_verify','content.authoring.source_grounded')
     and version=1 and lifecycle_status='certified';
  if v_caps<>3 then raise exception 'CF-R2 governance capability certification incomplete:%',v_caps; end if;

  select count(*) into v_skills
  from public.hq_workforce_skill_manifests sm
  join public.hq_workforce_tool_contracts tc on tc.id=sm.tool_contract_id
  where tc.handler_key in ('content.research.external','content.evidence.semantic_verify','content.authoring.source_grounded')
    and sm.certification_status='certified' and sm.autonomy_required=1 and sm.risk_class=1
    and sm.max_records_affected=1 and sm.verification_required;
  if v_skills<>3 then raise exception 'CF-R2 governance skill certification incomplete:%',v_skills; end if;

  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'CF-R2 governance registration cannot activate authority'; end if;
end $$;
