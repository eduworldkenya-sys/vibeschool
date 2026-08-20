-- Autopilot commissioning: close certified capability -> worker competency routing gap.
-- NON-ACTIVATING. This migration reconstructs the certified Content Factory capability
-- ontology that already exists in production, then tightens qualification/routing semantics.
-- It creates no worker, identity, certification, grant, runtime policy, budget, task,
-- execution intent, or side effect, and it does not release Global Stop.

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

do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_capabilities integer;
  v_bindings integer;
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
end $$;
