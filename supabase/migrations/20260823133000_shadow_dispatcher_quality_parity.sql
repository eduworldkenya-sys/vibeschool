begin;

-- Restore the canonical Quality fixture handler after later specialist migrations
-- replaced the shared shadow dispatcher without carrying this branch forward.
-- NON-ACTIVATING: deterministic read-only shadow evaluation only.
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
    if coalesce(btrim(p_input->>'research_job_id'),'')='' or not exists(select 1 from public.curriculum_research_jobs where id=(p_input->>'research_job_id')::uuid) then raise exception 'shadow_research_job_not_found'; end if;
    return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'semantic_self_certification',false,'external_fetch_executed',false,'next_boundary','candidate_source_discovery_only');
  elsif t.handler_key='content.evidence.semantic_verify' then
    if coalesce(btrim(p_input->>'source_id'),'')='' or coalesce(btrim(p_input->>'material_sha256'),'')='' then raise exception 'shadow_semantic_material_required'; end if;
    select * into v_material from public.curriculum_semantic_materials where source_id=(p_input->>'source_id')::uuid and material_sha256=p_input->>'material_sha256' order by retrieved_at desc limit 1;
    if not found then raise exception 'shadow_semantic_material_not_found'; end if;
    return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'model_call_executed',false,'actual_material_required',true,'material_bound',true,'verdict_generated',false,'next_boundary','governed_model_authorization');
  elsif t.handler_key='content.authoring.source_grounded' then
    if coalesce(btrim(p_input->>'proposal_id'),'')='' or coalesce(btrim(p_input->>'evidence_packet_sha256'),'')='' or coalesce(btrim(p_input->>'current_content_sha256'),'')='' or not exists(select 1 from public.curriculum_intelligence_proposals where id=(p_input->>'proposal_id')::uuid) then raise exception 'shadow_authoring_evidence_required'; end if;
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

revoke all on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) to service_role;

-- Reconstruction regression: the Chemistry qualification tools must dispatch through the
-- canonical Quality fixture handler and stay read-only.
do $$
declare
  v_tool uuid;
  v_result jsonb;
  ec public.hq_workforce_engine_contract%rowtype;
begin
  select id into v_tool
  from public.hq_workforce_tool_contracts
  where tool_key='workforce.chemistry_critic.assess_fixture' and version=1 and status='approved';
  if v_tool is null then raise exception 'CHEMISTRY_CRITIC_QUALIFICATION_TOOL_REQUIRED'; end if;

  v_result:=public.hq_workforce_execute_shadow_tool(v_tool,
    '{"case_id":"dispatcher-parity-pass","evidence_present":true,"reproducible":true,"severity_valid":true,"conflict_of_interest":false,"self_target":false,"requested_mutation":false}'::jsonb);
  if v_result->>'decision'<>'pass' or coalesce((v_result->>'side_effects_applied')::boolean,true) then
    raise exception 'CHEMISTRY_QUALITY_DISPATCH_PASS_CONTRACT_FAILED';
  end if;

  v_result:=public.hq_workforce_execute_shadow_tool(v_tool,
    '{"case_id":"dispatcher-parity-mutation","evidence_present":true,"reproducible":true,"severity_valid":true,"conflict_of_interest":false,"self_target":false,"requested_mutation":true}'::jsonb);
  if v_result->>'decision'<>'reject' or v_result->>'reason'<>'mutation_denied' or coalesce((v_result->>'side_effects_applied')::boolean,true) then
    raise exception 'CHEMISTRY_QUALITY_DISPATCH_MUTATION_CONTRACT_FAILED';
  end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'SHADOW_DISPATCHER_PARITY_NON_ACTIVATING_BOUNDARY_VIOLATED';
  end if;
end $$;

commit;