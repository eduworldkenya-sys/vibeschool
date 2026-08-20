-- Autopilot commissioning: close certified capability -> worker competency routing gap.
-- NON-ACTIVATING. This migration reconstructs the certified Content Factory capability
-- ontology plus the two production-proven catalog workers and minimum competency evidence
-- needed to route those capabilities. Worker catalog status does not enable execution:
-- runtime remains OFF/L0/R0, Global Stop remains ON, and no authority grant is created.

insert into public.hq_workforce_capabilities(
  capability_key, version, display_name, purpose,
  input_contract, output_contract, verification_contract,
  risk_class, autonomy_ceiling, lifecycle_status, provenance
) values
(
  'content.research.execute', 1,
  'Content Factory governed source discovery',
  'Discover candidate curriculum/content sources for one queued research job without self-certifying semantic support.',
  '{"max_records":1,"resource_type":"curriculum_research_job","semantic_support_inference":false,"requires_exact_task_job_binding":true}'::jsonb,
  '{"mutation":"candidate_source_provenance_only","max_records":1,"semantic_verification":"separate_certified_capability"}'::jsonb,
  '{"budget_binding":true,"task_job_binding":true,"retry_dead_letter_required":true,"semantic_self_certification_denied":true}'::jsonb,
  1, 1, 'certified',
  '{"mission":"Content Factory R2 production commissioning","contract":"content.research.execute@1","certification":"non-activating"}'::jsonb
),
(
  'content.evidence.semantic_verify', 1,
  'Content Factory material-bound semantic verification',
  'Classify one candidate source only against retrieved immutable source material and bind the verdict to that material hash.',
  '{"max_records":1,"resource_type":"curriculum_intelligence_source","model_memory_authority":false,"actual_material_required":true}'::jsonb,
  '{"mutation":"immutable_semantic_verdict","max_records":1,"material_hash_binding":true}'::jsonb,
  '{"immutable_material":true,"decisive_confidence_floor":0.85,"database_quote_verification":true,"prompt_injection_treated_as_data":true}'::jsonb,
  1, 1, 'certified',
  '{"mission":"Content Factory R2 production commissioning","contract":"content.evidence.semantic_verify@1","certification":"non-activating"}'::jsonb
),
(
  'content.authoring.source_grounded', 1,
  'Content Factory source-grounded draft authoring',
  'Create one immutable editorial draft from the verified evidence packet without research, approval, apply, or publication authority.',
  '{"max_records":1,"resource_type":"curriculum_intelligence_proposal","outside_knowledge_authority":false,"verified_evidence_packet_required":true}'::jsonb,
  '{"mutation":"immutable_authoring_draft_only","max_records":1,"publish_authority":false,"human_acceptance_required":true}'::jsonb,
  '{"separate_apply":true,"separate_human_acceptance":true,"database_quote_verification":true,"current_content_hash_binding":true,"evidence_packet_hash_binding":true}'::jsonb,
  1, 1, 'certified',
  '{"mission":"Content Factory R2 production commissioning","contract":"content.authoring.source_grounded@1","certification":"non-activating"}'::jsonb
)
on conflict(capability_key,version) do update set
  display_name=excluded.display_name,
  purpose=excluded.purpose,
  input_contract=excluded.input_contract,
  output_contract=excluded.output_contract,
  verification_contract=excluded.verification_contract,
  risk_class=excluded.risk_class,
  autonomy_ceiling=excluded.autonomy_ceiling,
  lifecycle_status=excluded.lifecycle_status,
  provenance=excluded.provenance,
  updated_at=clock_timestamp();

insert into public.hq_workforce_capability_competencies(
  capability_id, competency_key, required, weight, minimum_proficiency
)
select c.id, v.competency_key, true, v.weight, v.minimum_proficiency
from public.hq_workforce_capabilities c
join (values
  ('content.research.execute', 1, 'curriculum.analysis', 1.00::numeric, 0.90::numeric),
  ('content.evidence.semantic_verify', 1, 'quality.analysis', 1.00::numeric, 0.90::numeric),
  ('content.authoring.source_grounded', 1, 'curriculum.analysis', 0.60::numeric, 0.90::numeric),
  ('content.authoring.source_grounded', 1, 'content.quality', 0.40::numeric, 0.90::numeric)
) as v(capability_key, version, competency_key, weight, minimum_proficiency)
  on c.capability_key=v.capability_key and c.version=v.version
on conflict(capability_id,competency_key) do update set
  required=excluded.required,
  weight=excluded.weight,
  minimum_proficiency=excluded.minimum_proficiency;

-- These are durable catalog identities already present in production. They have no direct
-- runtime authority. job_key is deliberately left NULL here because historical job catalog
-- bootstrap rows were production-only; routing authority comes from capability/skill/grant
-- contracts, not this legacy metadata pointer.
insert into public.hq_workforce_workers(
  worker_key,worker_kind,title,department_key,job_key,manager_worker_key,mission,status,
  reasoning_mode,paid_ai_allowed,competencies,permissions,approval_boundaries,kpis
) values
(
  'curriculum-worker-01','digital','Curriculum Intelligence Worker','content',null,null,
  'Maintain authoritative curriculum intelligence and reviewed updates.','active',
  'deterministic',false,
  '["research","source evaluation","curriculum"]'::jsonb,
  '["read_curriculum_sources","draft_change","record_sources","request_review"]'::jsonb,
  '["no_auto_publish","no_unverified_external_fact"]'::jsonb,
  '["source_quality_rate","review_pass_rate","stale_content_rate"]'::jsonb
),
(
  'quality-worker-01','digital','Product Quality Worker','product',null,null,
  'Detect and verify product quality problems and fixes.','active',
  'deterministic',false,
  '["verification","evidence","product quality"]'::jsonb,
  '["read_quality_signals","record_findings","verify_outcomes","request_approval"]'::jsonb,
  '["no_destructive_actions","no_release_override"]'::jsonb,
  '["verification_rate","regression_escape_rate","reopen_rate"]'::jsonb
)
on conflict(worker_key) do update set
  worker_kind=excluded.worker_kind,
  title=excluded.title,
  department_key=excluded.department_key,
  mission=excluded.mission,
  reasoning_mode=excluded.reasoning_mode,
  paid_ai_allowed=false,
  competencies=excluded.competencies,
  permissions=excluded.permissions,
  approval_boundaries=excluded.approval_boundaries,
  kpis=excluded.kpis,
  updated_at=clock_timestamp();

insert into public.hq_workforce_worker_competencies(
  worker_key, competency_key, version, proficiency, reliability, sample_count,
  certification_status, evidence, scope_types, jurisdictions, last_evaluated_at, expires_at
)
select v.worker_key, v.competency_key, 1, v.proficiency, v.reliability, 0,
       'certified',
       jsonb_build_object(
         'mode','WE-R1.3X_bootstrap',
         'basis','existing worker mission/title plus repository-certified Shadow contracts',
         'lineage_convergence',jsonb_build_object(
           'source','production-only WE-R1.3X 20260815053502..20260815054004',
           'mapping','allowed_scope_types -> scope_types',
           'repository_reconstruction','20260819190600'
         )
       ),
       array['platform_internal','global']::text[], array['global']::text[],
       clock_timestamp(), null
from (values
  ('curriculum-worker-01','curriculum.analysis',0.98::numeric,0.93::numeric),
  ('curriculum-worker-01','content.quality',0.95::numeric,0.90::numeric),
  ('quality-worker-01','quality.analysis',0.98::numeric,0.92::numeric)
) as v(worker_key,competency_key,proficiency,reliability)
join public.hq_workforce_workers w on w.worker_key=v.worker_key and w.status='active'
on conflict(worker_key,competency_key,version) do update set
  proficiency=excluded.proficiency,
  reliability=excluded.reliability,
  certification_status='certified',
  evidence=excluded.evidence,
  scope_types=excluded.scope_types,
  jurisdictions=excluded.jurisdictions,
  last_evaluated_at=excluded.last_evaluated_at,
  expires_at=null,
  updated_at=clock_timestamp();

do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_capabilities integer;
  v_bindings integer;
  v_candidates integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'autopilot_competency_binding_requires_engine_contract'; end if;

  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'autopilot_competency_binding_changed_fail_closed_posture';
  end if;

  if exists(select 1 from public.hq_workforce_capability_authority_grants where status='active') then
    raise exception 'autopilot_competency_binding_activated_authority';
  end if;

  select count(*) into v_capabilities
  from public.hq_workforce_capabilities c
  where (c.capability_key,c.version) in (
    ('content.research.execute',1),
    ('content.evidence.semantic_verify',1),
    ('content.authoring.source_grounded',1)
  ) and c.lifecycle_status='certified';
  if v_capabilities<>3 then
    raise exception 'autopilot_certified_content_capability_reconstruction_incomplete:%',v_capabilities;
  end if;

  select count(*) into v_bindings
  from public.hq_workforce_capabilities c
  join public.hq_workforce_capability_competencies cc on cc.capability_id=c.id and cc.required
  where c.version=1 and (
    (c.capability_key='content.research.execute' and cc.competency_key='curriculum.analysis' and cc.minimum_proficiency>=0.90)
    or (c.capability_key='content.evidence.semantic_verify' and cc.competency_key='quality.analysis' and cc.minimum_proficiency>=0.90)
    or (c.capability_key='content.authoring.source_grounded' and cc.competency_key='curriculum.analysis' and cc.minimum_proficiency>=0.90)
    or (c.capability_key='content.authoring.source_grounded' and cc.competency_key='content.quality' and cc.minimum_proficiency>=0.90)
  );
  if v_bindings<>4 then
    raise exception 'autopilot_certified_capability_competency_contract_incomplete:%',v_bindings;
  end if;

  select count(*) into v_candidates
  from public.hq_workforce_worker_competencies wc
  join public.hq_workforce_workers w on w.worker_key=wc.worker_key and w.status='active'
  where wc.version=1 and wc.certification_status='certified'
    and (wc.expires_at is null or wc.expires_at>clock_timestamp())
    and (
      (wc.worker_key='curriculum-worker-01' and wc.competency_key='curriculum.analysis' and wc.proficiency>=0.90)
      or (wc.worker_key='curriculum-worker-01' and wc.competency_key='content.quality' and wc.proficiency>=0.90)
      or (wc.worker_key='quality-worker-01' and wc.competency_key='quality.analysis' and wc.proficiency>=0.90)
    );
  if v_candidates<>3 then
    raise exception 'autopilot_content_worker_competency_reconstruction_incomplete:%',v_candidates;
  end if;
end $$;
