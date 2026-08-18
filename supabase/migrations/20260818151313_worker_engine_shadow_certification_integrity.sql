-- Worker Engine shadow certification integrity hardening.
-- Closes caller-supplied observed-outcome certification and adds deterministic, side-effect-free
-- shadow adapters for the three Content Factory R2 tool contracts.
-- NON-ACTIVATING: does not enable runtime, issue identities/certifications, or create authority grants.

alter table public.hq_workforce_shadow_runs
  add column if not exists execution_method text not null default 'legacy_supplied_observation';

alter table public.hq_workforce_shadow_runs
  drop constraint if exists hq_workforce_shadow_runs_execution_method_check;
alter table public.hq_workforce_shadow_runs
  add constraint hq_workforce_shadow_runs_execution_method_check
  check (execution_method in ('legacy_supplied_observation','server_shadow_executor_v2'));

create or replace function public.hq_workforce_execute_shadow_tool(p_tool_contract_id uuid,p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare t public.hq_workforce_tool_contracts%rowtype;
begin
  select * into t from public.hq_workforce_tool_contracts where id=p_tool_contract_id and status='approved';
  if not found then raise exception 'approved_shadow_tool_required'; end if;
  if coalesce(jsonb_typeof(p_input),'null')<>'object' then raise exception 'shadow_input_object_required'; end if;

  if t.handler_key='work_item.triage_and_own' then
    if coalesce((p_input->>'approval_required')::boolean,false) then raise exception 'shadow_case_requires_unapproved_work'; end if;
    return jsonb_build_object('decision','triage','side_effects_applied',false,'handler',t.handler_key);
  elsif t.handler_key='content.research.external' then
    if coalesce(btrim(p_input->>'research_job_id'),'')='' then raise exception 'shadow_research_job_id_required'; end if;
    return jsonb_build_object(
      'decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,
      'semantic_self_certification',false,'external_fetch_executed',false,
      'next_boundary','candidate_source_discovery_only'
    );
  elsif t.handler_key='content.evidence.semantic_verify' then
    if coalesce(btrim(p_input->>'source_id'),'')='' then raise exception 'shadow_semantic_source_id_required'; end if;
    if coalesce(btrim(p_input->>'material_sha256'),'')='' then raise exception 'shadow_semantic_material_hash_required'; end if;
    return jsonb_build_object(
      'decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,
      'model_call_executed',false,'actual_material_required',true,
      'verdict_generated',false,'next_boundary','governed_model_authorization'
    );
  elsif t.handler_key='content.authoring.source_grounded' then
    if coalesce(btrim(p_input->>'proposal_id'),'')='' then raise exception 'shadow_authoring_proposal_id_required'; end if;
    if coalesce(btrim(p_input->>'evidence_packet_sha256'),'')='' then raise exception 'shadow_authoring_evidence_packet_hash_required'; end if;
    if coalesce(btrim(p_input->>'current_content_sha256'),'')='' then raise exception 'shadow_authoring_current_content_hash_required'; end if;
    return jsonb_build_object(
      'decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,
      'model_call_executed',false,'publish_authority',false,
      'human_acceptance_required',true,'next_boundary','governed_source_grounded_draft'
    );
  end if;

  raise exception 'shadow_handler_not_certified';
end $$;

revoke all on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) to service_role;

create or replace function public.hq_workforce_record_shadow_run_v2(
  p_worker_key text,
  p_tool_contract_id uuid,
  p_input jsonb,
  p_expected jsonb,
  p_verifier_key text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_id uuid; v_observed jsonb; v_pass boolean; v_state text;
begin
  v_state:=public.hq_workforce_current_lifecycle_state(p_worker_key);
  if v_state not in ('shadow','remediation') then raise exception 'worker_not_in_shadow_or_remediation'; end if;
  if coalesce(trim(p_verifier_key),'')='' or p_verifier_key=p_worker_key then raise exception 'independent_verifier_required'; end if;
  if coalesce(jsonb_typeof(p_expected),'null')<>'object' then raise exception 'shadow_expected_object_required'; end if;

  v_observed:=public.hq_workforce_execute_shadow_tool(p_tool_contract_id,p_input);
  v_pass:=p_expected=v_observed;

  insert into public.hq_workforce_shadow_runs(
    worker_key,tool_contract_id,input_snapshot,expected_outcome,observed_outcome,
    side_effects_applied,verifier_key,passed,executed_at,execution_method
  ) values(
    p_worker_key,p_tool_contract_id,p_input,p_expected,v_observed,
    false,p_verifier_key,v_pass,clock_timestamp(),'server_shadow_executor_v2'
  ) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.hq_workforce_record_shadow_run_v2(text,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_record_shadow_run_v2(text,uuid,jsonb,jsonb,text) to service_role;

create or replace function public.hq_workforce_issue_certification(
  p_worker_key text,
  p_creation_contract_id uuid,
  p_verifier_key text,
  p_required integer default 3,
  p_valid_for interval default interval '30 days'
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_passed int; v_id uuid; v_since timestamptz; v_issued timestamptz;
begin
  if public.hq_workforce_current_lifecycle_state(p_worker_key)<>'certification_pending' then raise exception 'worker_not_certification_pending'; end if;
  if p_verifier_key=p_worker_key or coalesce(trim(p_verifier_key),'')='' then raise exception 'independent_verifier_required'; end if;
  if p_required<3 then raise exception 'minimum_three_shadow_runs'; end if;
  if p_valid_for<=interval '0 seconds' then raise exception 'certification_validity_required'; end if;
  select coalesce(max(issued_at),'-infinity'::timestamptz) into v_since from public.hq_workforce_certifications where worker_key=p_worker_key;
  select count(*) into v_passed
  from public.hq_workforce_shadow_runs
  where worker_key=p_worker_key
    and passed
    and not side_effects_applied
    and verifier_key=p_verifier_key
    and execution_method='server_shadow_executor_v2'
    and executed_at>v_since;
  if v_passed<p_required then raise exception 'insufficient_fresh_server_verified_shadow_runs'; end if;
  v_issued:=clock_timestamp();
  insert into public.hq_workforce_certifications(
    worker_key,creation_contract_id,certification_key,status,required_shadow_runs,
    passed_shadow_runs,verifier_key,issued_at,expires_at
  ) values(
    p_worker_key,p_creation_contract_id,p_worker_key||':'||gen_random_uuid()::text,'active',
    p_required,v_passed,p_verifier_key,v_issued,v_issued+p_valid_for
  ) returning id into v_id;
  return v_id;
end $$;

do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'shadow_certification_integrity_requires_engine_contract'; end if;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'shadow_certification_integrity_violated_fail_closed_runtime';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'shadow_certification_integrity_cannot_activate_authority'; end if;
end $$;
