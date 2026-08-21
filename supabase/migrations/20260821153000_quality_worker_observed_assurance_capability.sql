-- Quality Worker observed assurance capability.
-- NON-ACTIVATING: no worker activation, capability authority grant, autonomy, budget, factory, heartbeat, or Global Stop change.

alter table public.hq_workforce_tool_contracts
  drop constraint if exists hq_workforce_tool_contracts_handler_key_check;
alter table public.hq_workforce_tool_contracts
  add constraint hq_workforce_tool_contracts_handler_key_check
  check (handler_key = any(array[
    'work_item.triage_and_own'::text,
    'work_item.prioritize'::text,
    'content.research.external'::text,
    'content.evidence.semantic_verify'::text,
    'content.authoring.source_grounded'::text,
    'workforce.quality.assess_fixture'::text
  ]));

alter table public.hq_workforce_tool_contracts
  drop constraint if exists hq_workforce_tool_contracts_side_effect_class_check;
alter table public.hq_workforce_tool_contracts
  add constraint hq_workforce_tool_contracts_side_effect_class_check
  check (side_effect_class = any(array['internal_write'::text,'read_only'::text]));

insert into public.hq_workforce_capabilities(
  capability_key,version,display_name,purpose,input_contract,output_contract,
  verification_contract,risk_class,autonomy_ceiling,lifecycle_status,provenance
) values (
  'workforce.quality.assess_fixture',1,
  'Independent worker-quality evidence assessment',
  'Evaluate bounded quality fixtures using explicit evidence, reproducibility, severity, conflict-of-interest, self-target and mutation boundaries without changing the evaluated worker or release state.',
  '{"resource_type":"worker_quality_fixture","required":["case_id","evidence_present","reproducible","severity_valid","conflict_of_interest","self_target","requested_mutation"]}'::jsonb,
  '{"decision":"pass|reject|escalate","mutation":"none","finding_required_on_reject":true}'::jsonb,
  '{"evidence_required":true,"reproducibility_required":true,"valid_severity_required":true,"conflict_escalates":true,"self_target_escalates":true,"mutation_denied":true}'::jsonb,
  1,0,'certified',
  '{"mission":"Quality Worker professional assurance","contract":"workforce.quality.assess_fixture@1","certification":"non-activating"}'::jsonb
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
  capability_id,competency_key,required,weight,minimum_proficiency
)
select c.id,v.competency_key,true,v.weight,v.minimum_proficiency
from public.hq_workforce_capabilities c
join (values
  ('quality.analysis',0.70::numeric,0.95::numeric),
  ('product.analysis',0.30::numeric,0.90::numeric)
) v(competency_key,weight,minimum_proficiency) on true
where c.capability_key='workforce.quality.assess_fixture' and c.version=1
on conflict(capability_id,competency_key) do update set
  required=excluded.required,
  weight=excluded.weight,
  minimum_proficiency=excluded.minimum_proficiency;

insert into public.hq_workforce_tool_contracts(
  tool_key,version,title,handler_key,required_capability_key,operation,
  resource_type,side_effect_class,status,approved_at,approval_reason
) values (
  'workforce.quality.assess_fixture',1,
  'Quality assurance bounded fixture evaluator',
  'workforce.quality.assess_fixture',
  'workforce.quality.assess_fixture',
  'assess_quality_fixture','worker_quality_fixture','read_only','approved',
  clock_timestamp(),
  'Independent deterministic Quality Worker proving-ground tool; no mutation or authority grant.'
)
on conflict(tool_key,version) do update set
  title=excluded.title,
  handler_key=excluded.handler_key,
  required_capability_key=excluded.required_capability_key,
  operation=excluded.operation,
  resource_type=excluded.resource_type,
  side_effect_class=excluded.side_effect_class,
  status=excluded.status,
  approved_at=excluded.approved_at,
  approval_reason=excluded.approval_reason;

create or replace function public.hq_workforce_execute_shadow_tool(
  p_tool_contract_id uuid,
  p_input jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_tool_contracts%rowtype;
  v_material public.curriculum_semantic_materials%rowtype;
  v_decision text;
  v_reason text;
begin
  select * into t
  from public.hq_workforce_tool_contracts
  where id=p_tool_contract_id and status='approved';
  if not found then raise exception 'approved_shadow_tool_required'; end if;
  if coalesce(jsonb_typeof(p_input),'null')<>'object' then raise exception 'shadow_input_object_required'; end if;

  if t.handler_key='work_item.triage_and_own' then
    if coalesce((p_input->>'approval_required')::boolean,false) then raise exception 'shadow_case_requires_unapproved_work'; end if;
    return jsonb_build_object('decision','triage','side_effects_applied',false,'handler',t.handler_key);
  elsif t.handler_key='content.research.external' then
    if coalesce(btrim(p_input->>'research_job_id'),'')='' then raise exception 'shadow_research_job_id_required'; end if;
    if not exists(select 1 from public.curriculum_research_jobs where id=(p_input->>'research_job_id')::uuid) then raise exception 'shadow_research_job_not_found'; end if;
    return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'semantic_self_certification',false,'external_fetch_executed',false,'next_boundary','candidate_source_discovery_only');
  elsif t.handler_key='content.evidence.semantic_verify' then
    if coalesce(btrim(p_input->>'source_id'),'')='' then raise exception 'shadow_semantic_source_id_required'; end if;
    if coalesce(btrim(p_input->>'material_sha256'),'')='' then raise exception 'shadow_semantic_material_hash_required'; end if;
    select * into v_material from public.curriculum_semantic_materials
    where source_id=(p_input->>'source_id')::uuid and material_sha256=p_input->>'material_sha256'
    order by retrieved_at desc limit 1;
    if not found then raise exception 'shadow_semantic_material_not_found'; end if;
    return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'model_call_executed',false,'actual_material_required',true,'material_bound',true,'verdict_generated',false,'next_boundary','governed_model_authorization');
  elsif t.handler_key='content.authoring.source_grounded' then
    if coalesce(btrim(p_input->>'proposal_id'),'')='' then raise exception 'shadow_authoring_proposal_id_required'; end if;
    if coalesce(btrim(p_input->>'evidence_packet_sha256'),'')='' then raise exception 'shadow_authoring_evidence_packet_hash_required'; end if;
    if coalesce(btrim(p_input->>'current_content_sha256'),'')='' then raise exception 'shadow_authoring_current_content_hash_required'; end if;
    if not exists(select 1 from public.curriculum_intelligence_proposals where id=(p_input->>'proposal_id')::uuid) then raise exception 'shadow_authoring_proposal_not_found'; end if;
    return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'model_call_executed',false,'publish_authority',false,'human_acceptance_required',true,'next_boundary','governed_source_grounded_draft');
  elsif t.handler_key='workforce.quality.assess_fixture' then
    if coalesce(btrim(p_input->>'case_id'),'')='' then raise exception 'quality_case_id_required'; end if;
    if not (p_input ?& array['evidence_present','reproducible','severity_valid','conflict_of_interest','self_target','requested_mutation']) then raise exception 'quality_fixture_contract_incomplete'; end if;
    if coalesce((p_input->>'requested_mutation')::boolean,false) then
      v_decision:='reject'; v_reason:='mutation_denied';
    elsif coalesce((p_input->>'conflict_of_interest')::boolean,false) or coalesce((p_input->>'self_target')::boolean,false) then
      v_decision:='escalate'; v_reason:='independence_boundary';
    elsif not coalesce((p_input->>'evidence_present')::boolean,false) then
      v_decision:='reject'; v_reason:='evidence_missing';
    elsif not coalesce((p_input->>'reproducible')::boolean,false) then
      v_decision:='reject'; v_reason:='not_reproducible';
    elsif not coalesce((p_input->>'severity_valid')::boolean,false) then
      v_decision:='reject'; v_reason:='severity_invalid';
    else
      v_decision:='pass'; v_reason:='quality_contract_satisfied';
    end if;
    return jsonb_build_object(
      'decision',v_decision,'reason',v_reason,'handler',t.handler_key,
      'finding_required',v_decision='reject','side_effects_applied',false,'authority_changed',false
    );
  end if;
  raise exception 'shadow_handler_not_certified';
end $$;
revoke all on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) to service_role;

-- Refresh the baseline after the Quality-specific capability is present. This invalidates stale
-- certification when the worker contract changed; it does not certify the worker.
select public.hq_workforce_professional_baseline('quality-worker-01');
