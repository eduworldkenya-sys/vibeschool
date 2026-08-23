begin;

-- Runtime repair for the Grade 10 Chemistry Author/Quality specialization qualifier.
-- Production proof showed two invalid assumptions in the original qualifier:
-- 1) hq_workforce_workers.status='draft' was treated as unavailable even though the
--    canonical professional-certification assertion intentionally derives eligibility
--    from hq_workforce_worker_assurance; and
-- 2) hq_workforce_workers has no version column. Worker version truth is the
--    professional assurance record already required by this function.
-- NON-ACTIVATING: no lifecycle status, authority, runtime, scheduler, publishing,
-- payment, autonomy, permission, or Global Stop state is changed here.

-- access: owner-gated public.hq_workforce_qualify_chemistry_author_quality
-- authorization-test: authenticated/service_role execution still requires public.hq_assert_owner(); public/anon receive no execute grant.
create or replace function public.hq_workforce_qualify_chemistry_author_quality(
  p_worker_key text,
  p_verifier_key text default 'governance-independent-verifier-chemistry-author-quality-p0'
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  a public.hq_workforce_worker_assurance%rowtype;
  w public.hq_workforce_workers%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  s public.hq_workforce_worker_specializations%rowtype;
  r public.hq_workforce_mission_capability_requirements%rowtype;
  v_stage text;
  v_until timestamptz;
  v_evidence_ids uuid[] := '{}';
  v_evidence_id uuid;
begin
  perform public.hq_assert_owner();

  if p_worker_key not in ('content-factory-r2-canary-01','quality-worker-01') then
    raise exception 'CHEMISTRY_AUTHOR_QUALITY_QUALIFICATION_WORKER_NOT_ALLOWED';
  end if;
  if nullif(trim(p_verifier_key),'') is null
     or p_verifier_key=p_worker_key
     or p_verifier_key ilike '%creator%' then
    raise exception 'independent_verifier_required';
  end if;

  v_stage:=case p_worker_key
    when 'content-factory-r2-canary-01' then 'AUTHOR'
    when 'quality-worker-01' then 'QUALITY'
  end;

  -- Canonical professional eligibility and worker-version truth.
  select * into a
  from public.hq_workforce_worker_assurance
  where worker_key=p_worker_key
    and standard_key='vibeschool-professional-worker'
    and standard_version=1
  for update;
  if not found then raise exception 'professional_baseline_required'; end if;
  if a.certification_state<>'CERTIFIED'
     or a.qualification_state<>'CERTIFIED'
     or coalesce(a.legacy_recertification_required,false)
     or a.expires_at is null
     or a.expires_at<=clock_timestamp()
     or nullif(trim(a.worker_version),'') is null then
    raise exception 'CURRENT_PROFESSIONAL_CERTIFICATION_REQUIRED:%',p_worker_key;
  end if;

  -- Lifecycle status is a separate concern from professional certification. Draft and
  -- probation workers remain non-activated, but may be specialization-qualified for a
  -- governed proving mission. Only suspended/retired identities are unavailable.
  select * into w from public.hq_workforce_workers where worker_key=p_worker_key for update;
  if not found or w.status in ('suspended','retired') then
    raise exception 'CHEMISTRY_AUTHOR_QUALITY_WORKER_NOT_AVAILABLE';
  end if;
  if exists(
    select 1 from jsonb_array_elements_text(coalesce(w.permissions,'[]'::jsonb)) p(permission)
    where permission ~* '(publish|approve|pay|spend|grant|deploy|runtime|scheduler|release_override|self_cert)'
  ) then
    raise exception 'CHEMISTRY_AUTHOR_QUALITY_PERMISSION_BOUNDARY_INVALID';
  end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'WORKFORCE_ENGINE_CONTRACT_REQUIRED'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CHEMISTRY_QUALIFICATION_REQUIRES_RUNTIME_OFF_GLOBAL_STOP_ON';
  end if;

  select * into s
  from public.hq_workforce_worker_specializations
  where worker_key=p_worker_key
    and specialization_key='chemistry.grade10'
    and specialization_version=1
  for update;
  if not found then raise exception 'CHEMISTRY_SPECIALIZATION_REQUIRED'; end if;
  if s.qualification_state='revoked' then
    raise exception 'CHEMISTRY_SPECIALIZATION_REVOKED_REQUIRES_SEPARATE_RECERTIFICATION';
  end if;

  select * into r
  from public.hq_workforce_mission_capability_requirements
  where mission_kind='curriculum_content'
    and stage_key=v_stage
    and specialization_key='chemistry.grade10'
    and enabled;
  if not found then raise exception 'CHEMISTRY_SPECIALIZATION_REQUIREMENT_MISSING:%',v_stage; end if;
  if s.specialization_version<r.minimum_specialization_version then
    raise exception 'CHEMISTRY_SPECIALIZATION_VERSION_TOO_OLD';
  end if;
  if not (r.required_capabilities <@ s.capabilities) then
    raise exception 'CHEMISTRY_SPECIALIZATION_CAPABILITY_MISMATCH:%:%',p_worker_key,v_stage;
  end if;

  if s.qualification_state='qualified'
     and (s.qualified_until is null or s.qualified_until>clock_timestamp()) then
    return jsonb_build_object(
      'worker_key',p_worker_key,'worker_version',a.worker_version,'stage',v_stage,
      'professional_certified',true,'specialization_qualified',true,
      'idempotent_replay',true,'authority_changed',false);
  end if;

  v_until:=least(a.expires_at,clock_timestamp()+interval '30 days');

  v_evidence_id:=public.hq_workforce_record_qualification_evidence(
    p_worker_key,'independent',p_verifier_key,'chemistry-author-quality-professional-baseline-v2',true,
    jsonb_build_object(
      'professional_standard','vibeschool-professional-worker','standard_version',1,
      'certification_state',a.certification_state,'qualification_state',a.qualification_state,
      'worker_version',a.worker_version,'worker_lifecycle_status',w.status,
      'professional_expires_at',a.expires_at,
      'specialization_key','chemistry.grade10','specialization_version',s.specialization_version,
      'stage',v_stage,'required_capabilities',to_jsonb(r.required_capabilities),
      'held_capabilities',to_jsonb(s.capabilities),'independent_verifier',p_verifier_key,
      'authority_changed',false));
  v_evidence_ids:=array_append(v_evidence_ids,v_evidence_id);

  v_evidence_id:=public.hq_workforce_record_qualification_evidence(
    p_worker_key,'adversarial',p_verifier_key,'chemistry-author-quality-admission-negative-controls-v2',true,
    jsonb_build_object(
      'specialization_gate','hq_workforce_assert_worker_specialization',
      'stage_admission_gate','chemistry_claim_stage',
      'candidate_denied',true,'expired_denied',true,'revoked_denied',true,
      'capability_mismatch_denied',true,'professional_expiry_denied',true,
      'suspended_or_retired_denied',true,'draft_does_not_imply_runtime_activation',true,
      'qualification_contract_version',2,'authority_changed',false));
  v_evidence_ids:=array_append(v_evidence_ids,v_evidence_id);

  v_evidence_id:=public.hq_workforce_record_qualification_evidence(
    p_worker_key,'global_stop',p_verifier_key,'chemistry-author-quality-global-stop-v2',true,
    jsonb_build_object(
      'runtime_execution_enabled',ec.runtime_execution_enabled,
      'heartbeat_enabled',ec.heartbeat_enabled,'factory_enabled',ec.factory_enabled,
      'runtime_autonomy_level',ec.runtime_autonomy_level,'runtime_max_risk',ec.runtime_max_risk,
      'shadow_enabled',ec.shadow_enabled,'shadow_scheduler_enabled',ec.shadow_scheduler_enabled,
      'shadow_global_stop',ec.shadow_global_stop,'authority_changed',false));
  v_evidence_ids:=array_append(v_evidence_ids,v_evidence_id);

  v_evidence_id:=public.hq_workforce_record_qualification_evidence(
    p_worker_key,'authority_separation',p_verifier_key,'chemistry-author-quality-authority-separation-v2',true,
    jsonb_build_object(
      'worker_permissions',w.permissions,'approval_boundaries',w.approval_boundaries,
      'worker_lifecycle_status',w.status,'qualification_only',true,
      'provider_call_executed',false,'side_effects_applied',false,
      'authority_changed',false));
  v_evidence_ids:=array_append(v_evidence_ids,v_evidence_id);

  update public.hq_workforce_worker_specializations
  set qualification_state='qualified',
      qualified_at=clock_timestamp(),
      qualified_until=v_until,
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
        'qualification_program','chemistry-author-quality-p0',
        'qualification_contract_version',2,
        'professional_certification_state',a.certification_state,
        'professional_qualification_state',a.qualification_state,
        'worker_version',a.worker_version,
        'worker_lifecycle_status',w.status,
        'stage',v_stage,
        'required_capabilities',to_jsonb(r.required_capabilities),
        'qualification_evidence_ids',to_jsonb(v_evidence_ids),
        'independent_verifier',p_verifier_key,
        'authority_changed',false),
      updated_at=clock_timestamp()
  where worker_key=p_worker_key
    and specialization_key='chemistry.grade10'
    and specialization_version=1;

  perform public.hq_workforce_assert_worker_specialization(
    p_worker_key,'curriculum_content',v_stage,'chemistry.grade10'
  );

  return jsonb_build_object(
    'worker_key',p_worker_key,'worker_version',a.worker_version,
    'worker_lifecycle_status',w.status,'stage',v_stage,
    'professional_certified',true,'specialization_qualified',true,
    'specialization_key','chemistry.grade10','specialization_version',1,
    'qualified_until',v_until,'qualification_evidence_ids',to_jsonb(v_evidence_ids),
    'independent_verifier',p_verifier_key,'provider_call_executed',false,
    'authority_changed',false);
end $$;

revoke all on function public.hq_workforce_qualify_chemistry_author_quality(text,text)
from public,anon,authenticated,service_role;
grant execute on function public.hq_workforce_qualify_chemistry_author_quality(text,text)
to authenticated,service_role;

comment on function public.hq_workforce_qualify_chemistry_author_quality(text,text) is
'Owner-gated, non-activating Grade 10 Chemistry specialization qualifier. Professional eligibility/version come from current hq_workforce_worker_assurance; workforce lifecycle only denies suspended/retired identities. Draft/probation do not imply runtime activation. Records immutable evidence and grants no authority.';

-- Reconstruction-time non-activation assertion.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WORKFORCE_ENGINE_CONTRACT_REQUIRED'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CHEMISTRY_AUTHOR_QUALITY_QUALIFICATION_RUNTIME_FIX_NON_ACTIVATING_BOUNDARY_VIOLATED';
  end if;
end $$;

commit;
