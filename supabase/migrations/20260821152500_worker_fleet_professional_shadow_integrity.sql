-- Mission #416 tranche 1: evidence-bound professional shadow qualification.
-- NON-ACTIVATING. This adds a current-version, side-effect-free shadow ledger for
-- legacy canonical workers that do not have Worker Creator creation contracts.
-- It does not grant capabilities, authority, autonomy, budget, identity, or activation.

create table if not exists public.hq_workforce_professional_shadow_runs (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
  worker_version text not null,
  tool_contract_id uuid not null references public.hq_workforce_tool_contracts(id) on delete restrict,
  input_snapshot jsonb not null,
  expected_outcome jsonb not null,
  observed_outcome jsonb not null,
  verifier_key text not null,
  passed boolean not null,
  side_effects_applied boolean not null default false check (side_effects_applied = false),
  execution_method text not null default 'professional_server_shadow_v1' check (execution_method = 'professional_server_shadow_v1'),
  executed_at timestamptz not null default clock_timestamp()
);
create index if not exists hq_wf_prof_shadow_worker_idx
  on public.hq_workforce_professional_shadow_runs(worker_key,worker_version,executed_at desc);
alter table public.hq_workforce_professional_shadow_runs enable row level security;
revoke all on table public.hq_workforce_professional_shadow_runs from public,anon,authenticated,service_role;
grant select,insert on table public.hq_workforce_professional_shadow_runs to service_role;

-- Harden the existing side-effect-free executor so semantic verification shadow cases
-- are bound to real retained production material, not arbitrary non-empty identifiers.
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
begin
  select * into t
  from public.hq_workforce_tool_contracts
  where id=p_tool_contract_id and status='approved';
  if not found then raise exception 'approved_shadow_tool_required'; end if;
  if coalesce(jsonb_typeof(p_input),'null')<>'object' then raise exception 'shadow_input_object_required'; end if;

  if t.handler_key='work_item.triage_and_own' then
    if coalesce((p_input->>'approval_required')::boolean,false) then
      raise exception 'shadow_case_requires_unapproved_work';
    end if;
    return jsonb_build_object(
      'decision','triage','side_effects_applied',false,'handler',t.handler_key
    );
  elsif t.handler_key='content.research.external' then
    if coalesce(btrim(p_input->>'research_job_id'),'')='' then raise exception 'shadow_research_job_id_required'; end if;
    if not exists(
      select 1 from public.curriculum_research_jobs
      where id=(p_input->>'research_job_id')::uuid
    ) then raise exception 'shadow_research_job_not_found'; end if;
    return jsonb_build_object(
      'decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,
      'semantic_self_certification',false,'external_fetch_executed',false,
      'next_boundary','candidate_source_discovery_only'
    );
  elsif t.handler_key='content.evidence.semantic_verify' then
    if coalesce(btrim(p_input->>'source_id'),'')='' then raise exception 'shadow_semantic_source_id_required'; end if;
    if coalesce(btrim(p_input->>'material_sha256'),'')='' then raise exception 'shadow_semantic_material_hash_required'; end if;
    select * into v_material
    from public.curriculum_semantic_materials
    where source_id=(p_input->>'source_id')::uuid
      and material_sha256=p_input->>'material_sha256'
    order by retrieved_at desc
    limit 1;
    if not found then raise exception 'shadow_semantic_material_not_found'; end if;
    return jsonb_build_object(
      'decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,
      'model_call_executed',false,'actual_material_required',true,'material_bound',true,
      'verdict_generated',false,'next_boundary','governed_model_authorization'
    );
  elsif t.handler_key='content.authoring.source_grounded' then
    if coalesce(btrim(p_input->>'proposal_id'),'')='' then raise exception 'shadow_authoring_proposal_id_required'; end if;
    if coalesce(btrim(p_input->>'evidence_packet_sha256'),'')='' then raise exception 'shadow_authoring_evidence_packet_hash_required'; end if;
    if coalesce(btrim(p_input->>'current_content_sha256'),'')='' then raise exception 'shadow_authoring_current_content_hash_required'; end if;
    if not exists(
      select 1 from public.curriculum_intelligence_proposals
      where id=(p_input->>'proposal_id')::uuid
    ) then raise exception 'shadow_authoring_proposal_not_found'; end if;
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

create or replace function public.hq_workforce_run_professional_shadow(
  p_worker_key text,
  p_tool_contract_id uuid,
  p_input jsonb,
  p_expected jsonb,
  p_verifier_key text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  a public.hq_workforce_worker_assurance%rowtype;
  t public.hq_workforce_tool_contracts%rowtype;
  v_observed jsonb;
  v_pass boolean;
  v_run_id uuid;
  v_evidence_id uuid;
begin
  select * into a
  from public.hq_workforce_worker_assurance
  where worker_key=p_worker_key
    and standard_key='vibeschool-professional-worker'
    and standard_version=1;
  if not found then raise exception 'professional_baseline_required'; end if;
  if coalesce(a.worker_version,'')='' then raise exception 'worker_version_required'; end if;
  if coalesce(trim(p_verifier_key),'')='' or p_verifier_key=p_worker_key or p_verifier_key ilike '%creator%' then
    raise exception 'independent_verifier_required';
  end if;
  if coalesce(jsonb_typeof(p_expected),'null')<>'object' then raise exception 'shadow_expected_object_required'; end if;

  select * into t
  from public.hq_workforce_tool_contracts
  where id=p_tool_contract_id and status='approved';
  if not found then raise exception 'approved_shadow_tool_required'; end if;

  -- A legacy worker may be professionally tested without granting runtime authority, but
  -- its certified competency must cover the tool's required capability.
  if not exists (
    select 1
    from public.hq_workforce_capabilities c
    join public.hq_workforce_capability_competencies cc
      on cc.capability_id=c.id and cc.required
    join public.hq_workforce_worker_competencies wc
      on wc.worker_key=p_worker_key
     and wc.competency_key=cc.competency_key
     and wc.certification_status='certified'
     and wc.proficiency>=cc.minimum_proficiency
     and (wc.expires_at is null or wc.expires_at>clock_timestamp())
    where c.capability_key=t.required_capability_key
      and c.lifecycle_status='certified'
  ) then
    raise exception 'worker_not_competent_for_shadow_tool';
  end if;

  v_observed:=public.hq_workforce_execute_shadow_tool(p_tool_contract_id,p_input);
  v_pass:=p_expected=v_observed;

  insert into public.hq_workforce_professional_shadow_runs(
    worker_key,worker_version,tool_contract_id,input_snapshot,expected_outcome,
    observed_outcome,verifier_key,passed,side_effects_applied,execution_method
  ) values(
    p_worker_key,a.worker_version,p_tool_contract_id,p_input,p_expected,
    v_observed,p_verifier_key,v_pass,false,'professional_server_shadow_v1'
  ) returning id into v_run_id;

  if v_pass then
    v_evidence_id:=public.hq_workforce_record_qualification_evidence(
      p_worker_key,'shadow',p_verifier_key,'professional-server-shadow-v1',true,
      jsonb_build_object(
        'run_id',v_run_id,
        'worker_version',a.worker_version,
        'tool_contract_id',p_tool_contract_id,
        'execution_method','professional_server_shadow_v1',
        'side_effects_applied',false,
        'observed',v_observed
      )
    );
  end if;

  return jsonb_build_object(
    'run_id',v_run_id,'passed',v_pass,'evidence_id',v_evidence_id,
    'worker_key',p_worker_key,'worker_version',a.worker_version,
    'authority_changed',false,'side_effects_applied',false
  );
end $$;
revoke all on function public.hq_workforce_run_professional_shadow(text,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_run_professional_shadow(text,uuid,jsonb,jsonb,text) to service_role;

-- Tighten professional certification: a shadow evidence row must point to a real,
-- successful current-version professional shadow run (or the pre-existing content canary
-- evidence suite, which remains independently governed).
create or replace function public.hq_workforce_decide_professional_certification(
  p_worker_key text,
  p_decider text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  a public.hq_workforce_worker_assurance%rowtype;
  v_latest_repair timestamptz;
  v_ids uuid[];
  v_ok boolean;
  v_need text[]:='{}';
begin
  select * into a from public.hq_workforce_worker_assurance
  where worker_key=p_worker_key and standard_key='vibeschool-professional-worker' and standard_version=1
  for update;
  if not found then raise exception 'professional_baseline_required'; end if;
  if p_decider=p_worker_key or coalesce(trim(p_decider),'')='' or p_decider ilike '%creator%' then
    raise exception 'creator_or_self_certification_forbidden';
  end if;

  select max(created_at) into v_latest_repair
  from public.hq_workforce_qualification_evidence
  where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='repair';

  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='independent' and passed) then v_need:=array_append(v_need,'independent'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='adversarial' and passed) then v_need:=array_append(v_need,'adversarial'); end if;
  if v_latest_repair is not null and not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='reverification' and passed and created_at>v_latest_repair) then v_need:=array_append(v_need,'fresh_reverification'); end if;

  if a.risk_class in ('R1','R2','R3') and not exists(
    select 1
    from public.hq_workforce_qualification_evidence qe
    where qe.worker_key=p_worker_key and qe.worker_version=a.worker_version
      and qe.evidence_kind='shadow' and qe.passed
      and (
        (qe.suite_version='professional-server-shadow-v1' and exists(
          select 1 from public.hq_workforce_professional_shadow_runs sr
          where sr.id=(qe.evidence->>'run_id')::uuid
            and sr.worker_key=p_worker_key
            and sr.worker_version=a.worker_version
            and sr.passed and not sr.side_effects_applied
            and sr.execution_method='professional_server_shadow_v1'
            and sr.verifier_key=qe.evaluator_key
        ))
        or (p_worker_key='content-factory-r2-canary-01' and qe.suite_version='existing-server-shadow-v2')
      )
  ) then v_need:=array_append(v_need,'shadow'); end if;

  if a.risk_class in ('R2','R3') and not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='canary' and passed) then v_need:=array_append(v_need,'canary'); end if;
  if a.risk_class='R3' and not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='human_authority' and passed) then v_need:=array_append(v_need,'human_authority'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='global_stop' and passed) then v_need:=array_append(v_need,'global_stop'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='authority_separation' and passed) then v_need:=array_append(v_need,'authority_separation'); end if;

  v_ok:=coalesce(array_length(v_need,1),0)=0;
  select coalesce(array_agg(id order by created_at),'{}') into v_ids
  from public.hq_workforce_qualification_evidence
  where worker_key=p_worker_key and worker_version=a.worker_version and passed;

  update public.hq_workforce_worker_assurance
  set certification_state=case when v_ok then 'CERTIFIED' else 'NEEDS_REPAIR' end,
      qualification_state=case when v_ok then 'CERTIFIED' else 'FAILED_QUALIFICATION' end,
      legacy_recertification_required=not v_ok,
      certified_at=case when v_ok then clock_timestamp() else null end,
      expires_at=case when v_ok then clock_timestamp()+interval '30 days' else null end,
      certification_evidence_ids=v_ids
  where id=a.id;

  return jsonb_build_object(
    'worker_key',p_worker_key,'certified',v_ok,'missing_evidence',v_need,
    'authority_changed',false,'evidence_ids',v_ids
  );
end $$;
revoke all on function public.hq_workforce_decide_professional_certification(text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_decide_professional_certification(text,text) to service_role;
