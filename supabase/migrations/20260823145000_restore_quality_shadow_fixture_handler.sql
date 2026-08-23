begin;

-- Restore the deterministic Quality assurance handler required by the
-- Chemistry Critic/Repair professional qualification bridge.
-- NON-ACTIVATING: read-only deterministic fixture evaluation only.
-- authorization-test: owner/service qualification paths remain governed by their
-- existing caller functions; this dispatcher performs no authority grant, runtime
-- activation, scheduling, publishing, payments, or persistent mutation.

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
  v_worker text;
begin
  select * into t
  from public.hq_workforce_tool_contracts
  where id=p_tool_contract_id and status='approved';
  if not found then raise exception 'approved_shadow_tool_required'; end if;

  if coalesce(jsonb_typeof(p_input),'null')<>'object' then
    raise exception 'shadow_input_object_required';
  end if;

  if t.handler_key='work_item.triage_and_own' then
    if coalesce((p_input->>'approval_required')::boolean,false) then
      raise exception 'shadow_case_requires_unapproved_work';
    end if;
    return jsonb_build_object('decision','triage','side_effects_applied',false,'handler',t.handler_key);

  elsif t.handler_key='content.research.external' then
    if coalesce(btrim(p_input->>'research_job_id'),'')=''
       or not exists(select 1 from public.curriculum_research_jobs where id=(p_input->>'research_job_id')::uuid) then
      raise exception 'shadow_research_job_not_found';
    end if;
    return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'semantic_self_certification',false,'external_fetch_executed',false,'next_boundary','candidate_source_discovery_only');

  elsif t.handler_key='content.evidence.semantic_verify' then
    if coalesce(btrim(p_input->>'source_id'),'')=''
       or coalesce(btrim(p_input->>'material_sha256'),'')='' then
      raise exception 'shadow_semantic_material_required';
    end if;
    select * into v_material
    from public.curriculum_semantic_materials
    where source_id=(p_input->>'source_id')::uuid
      and material_sha256=p_input->>'material_sha256'
    order by retrieved_at desc limit 1;
    if not found then raise exception 'shadow_semantic_material_not_found'; end if;
    return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'model_call_executed',false,'actual_material_required',true,'material_bound',true,'verdict_generated',false,'next_boundary','governed_model_authorization');

  elsif t.handler_key='content.authoring.source_grounded' then
    if coalesce(btrim(p_input->>'proposal_id'),'')=''
       or coalesce(btrim(p_input->>'evidence_packet_sha256'),'')=''
       or coalesce(btrim(p_input->>'current_content_sha256'),'')=''
       or not exists(select 1 from public.curriculum_intelligence_proposals where id=(p_input->>'proposal_id')::uuid) then
      raise exception 'shadow_authoring_evidence_required';
    end if;
    return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'model_call_executed',false,'publish_authority',false,'human_acceptance_required',true,'next_boundary','governed_source_grounded_draft');

  elsif t.handler_key='workforce.quality.assess_fixture' then
    if not (p_input ? 'case_id')
       or not (p_input ? 'evidence_present')
       or not (p_input ? 'reproducible')
       or not (p_input ? 'severity_valid')
       or not (p_input ? 'conflict_of_interest')
       or not (p_input ? 'self_target')
       or not (p_input ? 'requested_mutation') then
      raise exception 'quality_shadow_fixture_contract_required';
    end if;

    if coalesce((p_input->>'requested_mutation')::boolean,false) then
      return jsonb_build_object('decision','reject','reason','mutation_denied','handler',t.handler_key,'finding_required',true,'side_effects_applied',false,'authority_changed',false);
    elsif coalesce((p_input->>'self_target')::boolean,false)
       or coalesce((p_input->>'conflict_of_interest')::boolean,false) then
      return jsonb_build_object('decision','escalate','reason','independence_boundary','handler',t.handler_key,'finding_required',false,'side_effects_applied',false,'authority_changed',false);
    elsif not coalesce((p_input->>'evidence_present')::boolean,false) then
      return jsonb_build_object('decision','reject','reason','evidence_missing','handler',t.handler_key,'finding_required',true,'side_effects_applied',false,'authority_changed',false);
    elsif not coalesce((p_input->>'reproducible')::boolean,false)
       or not coalesce((p_input->>'severity_valid')::boolean,false) then
      return jsonb_build_object('decision','reject','reason','quality_contract_failed','handler',t.handler_key,'finding_required',true,'side_effects_applied',false,'authority_changed',false);
    end if;

    return jsonb_build_object('decision','pass','reason','quality_contract_satisfied','handler',t.handler_key,'finding_required',false,'side_effects_applied',false,'authority_changed',false);

  elsif t.handler_key='finance.reconciliation.readonly' then
    if p_input<>'{}'::jsonb then raise exception 'finance_shadow_input_must_be_empty'; end if;
    return public.hq_workforce_finance_readonly_snapshot();

  elsif t.handler_key='security.assurance.readonly' then
    if p_input<>'{}'::jsonb then raise exception 'security_shadow_input_must_be_empty'; end if;
    return public.hq_workforce_security_readonly_snapshot();

  elsif t.handler_key='publishing.release_readiness.readonly' then
    if p_input<>'{}'::jsonb then raise exception 'publishing_shadow_input_must_be_empty'; end if;
    return public.hq_workforce_publishing_readonly_snapshot();

  elsif t.handler_key='platform.reliability.readonly' then
    if p_input<>'{}'::jsonb then raise exception 'platform_shadow_input_must_be_empty'; end if;
    return public.hq_workforce_platform_readonly_snapshot();

  elsif t.handler_key in ('operations.queue.readonly','support.case_health.readonly','curriculum.coverage.readonly','growth.metrics.readonly','workforce.capability_gaps.readonly','school.success.readonly') then
    if p_input<>'{}'::jsonb then raise exception 'remaining_specialist_shadow_input_must_be_empty'; end if;
    v_worker:=case t.handler_key
      when 'operations.queue.readonly' then 'ops-worker-01'
      when 'support.case_health.readonly' then 'support-worker-01'
      when 'curriculum.coverage.readonly' then 'curriculum-worker-01'
      when 'growth.metrics.readonly' then 'growth-worker-01'
      when 'workforce.capability_gaps.readonly' then 'hr-worker-01'
      when 'school.success.readonly' then 'school-success-worker-01'
    end;
    return public.hq_workforce_remaining_specialist_snapshot(v_worker);
  end if;

  raise exception 'shadow_handler_not_certified';
end $$;

-- Preserve the existing execution boundary. This function is an internal dispatcher;
-- callers retain their own owner/service authorization gates.
revoke all on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) from public,anon;

comment on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) is
'Internal deterministic shadow dispatcher. Includes the certified workforce.quality.assess_fixture path required for Chemistry Critic/Repair qualification; applies no consequential side effects.';

commit;
