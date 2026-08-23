begin;

-- P0 Chemistry Critic/Repair professional qualification bridge.
-- NON-ACTIVATING: deterministic read-only qualification fixtures only.
-- No runtime, scheduler, factory, publishing, payments, authority grants, or Global Stop changes.

insert into public.hq_workforce_capabilities(
  capability_key,version,display_name,purpose,input_contract,output_contract,
  verification_contract,risk_class,autonomy_ceiling,lifecycle_status,provenance
) values
('workforce.chemistry_critic.assess_fixture',1,
 'Chemistry Critic assurance fixture',
 'Prove the Chemistry Critic evidence, independence, stale-input and mutation-denial boundaries with deterministic read-only fixtures.',
 '{"resource_type":"worker_quality_fixture","required":["case_id","evidence_present","reproducible","severity_valid","conflict_of_interest","self_target","requested_mutation"]}'::jsonb,
 '{"decision":"pass|reject|escalate","mutation":"none"}'::jsonb,
 '{"independent_verification":true,"mutation_denied":true,"self_target_escalates":true,"evidence_required":true}'::jsonb,
 2,0,'certified',jsonb_build_object('program','chemistry-p0','qualification_only',true,'authority_granted',false,'merge_sha','1f3140ce5a7a9c5cd8906a683230fd635b099c7b')),
('workforce.chemistry_repair.assess_fixture',1,
 'Chemistry Repair assurance fixture',
 'Prove the Chemistry Repair evidence, independence, bounded-edit and mutation-denial boundaries with deterministic read-only fixtures.',
 '{"resource_type":"worker_quality_fixture","required":["case_id","evidence_present","reproducible","severity_valid","conflict_of_interest","self_target","requested_mutation"]}'::jsonb,
 '{"decision":"pass|reject|escalate","mutation":"none"}'::jsonb,
 '{"independent_verification":true,"mutation_denied":true,"self_target_escalates":true,"evidence_required":true}'::jsonb,
 2,0,'certified',jsonb_build_object('program','chemistry-p0','qualification_only',true,'authority_granted',false,'merge_sha','1f3140ce5a7a9c5cd8906a683230fd635b099c7b'))
on conflict(capability_key,version) do update set
  display_name=excluded.display_name,purpose=excluded.purpose,input_contract=excluded.input_contract,
  output_contract=excluded.output_contract,verification_contract=excluded.verification_contract,
  risk_class=2,autonomy_ceiling=0,lifecycle_status='certified',provenance=excluded.provenance,updated_at=clock_timestamp();

insert into public.hq_workforce_capability_competencies(capability_id,competency_key,required,weight,minimum_proficiency)
select c.id,v.competency_key,true,1,0.95
from public.hq_workforce_capabilities c
join (values
 ('workforce.chemistry_critic.assess_fixture','chemistry.critic.assurance'),
 ('workforce.chemistry_repair.assess_fixture','chemistry.repair.assurance')
) v(capability_key,competency_key) on v.capability_key=c.capability_key
where c.version=1
on conflict(capability_id,competency_key) do update set required=true,weight=1,minimum_proficiency=0.95;

insert into public.hq_workforce_tool_contracts(
  tool_key,version,title,handler_key,required_capability_key,operation,resource_type,
  side_effect_class,status,approved_at,approval_reason
) values
('workforce.chemistry_critic.assess_fixture',1,'Chemistry Critic bounded assurance fixture',
 'workforce.quality.assess_fixture','workforce.chemistry_critic.assess_fixture','assess_quality_fixture',
 'worker_quality_fixture','read_only','approved',clock_timestamp(),
 'Qualification-only deterministic read path. No runtime or authority grant.'),
('workforce.chemistry_repair.assess_fixture',1,'Chemistry Repair bounded assurance fixture',
 'workforce.quality.assess_fixture','workforce.chemistry_repair.assess_fixture','assess_quality_fixture',
 'worker_quality_fixture','read_only','approved',clock_timestamp(),
 'Qualification-only deterministic read path. No runtime or authority grant.')
on conflict(tool_key,version) do update set
  title=excluded.title,handler_key=excluded.handler_key,required_capability_key=excluded.required_capability_key,
  operation=excluded.operation,resource_type=excluded.resource_type,side_effect_class='read_only',status='approved',
  approved_at=coalesce(hq_workforce_tool_contracts.approved_at,clock_timestamp()),approval_reason=excluded.approval_reason;

create or replace function public.hq_workforce_qualify_chemistry_critic_repair(
  p_worker_key text,
  p_verifier_key text default 'governance-independent-verifier-chemistry-p0'
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
  v_competency text;
  v_tool_key text;
  v_ci_run text;
  v_ci_workflow text;
  v_tool_id uuid;
  v_run_good jsonb;
  v_run_missing jsonb;
  v_run_mutation jsonb;
  v_run_independence jsonb;
  v_decision jsonb;
  v_evidence_ids uuid[] := '{}';
  v_evidence_id uuid;
begin
  perform public.hq_assert_owner();
  if p_worker_key not in ('content-critic-chemistry-v1','content-repair-chemistry-v1') then
    raise exception 'CHEMISTRY_SPECIALIST_QUALIFICATION_WORKER_NOT_ALLOWED';
  end if;
  if nullif(trim(p_verifier_key),'') is null or p_verifier_key=p_worker_key or p_verifier_key ilike '%creator%' then
    raise exception 'independent_verifier_required';
  end if;

  select * into a from public.hq_workforce_worker_assurance
  where worker_key=p_worker_key and standard_key='vibeschool-professional-worker' and standard_version=1 for update;
  if not found then raise exception 'professional_baseline_required'; end if;
  if a.risk_class<>'R2' then raise exception 'CHEMISTRY_SPECIALIST_R2_REQUIRED'; end if;

  select * into w from public.hq_workforce_workers where worker_key=p_worker_key;
  if not found or w.status not in ('restricted','active') then raise exception 'CHEMISTRY_SPECIALIST_WORKER_NOT_AVAILABLE'; end if;
  if exists(
    select 1 from jsonb_array_elements_text(coalesce(w.permissions,'[]'::jsonb)) p(permission)
    where permission ~* '(publish|approve|pay|spend|grant|deploy|runtime|scheduler|release_override|self_cert)'
  ) then raise exception 'CHEMISTRY_SPECIALIST_PERMISSION_BOUNDARY_INVALID'; end if;

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
    raise exception 'CHEMISTRY_QUALIFICATION_REQUIRES_RUNTIME_OFF_GLOBAL_STOP_ON';
  end if;

  select * into s from public.hq_workforce_worker_specializations
  where worker_key=p_worker_key and specialization_key='chemistry.grade10' and specialization_version=1 for update;
  if not found then raise exception 'CHEMISTRY_SPECIALIZATION_REQUIRED'; end if;
  if a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED'
     and a.expires_at>clock_timestamp() and s.qualification_state='qualified'
     and (s.qualified_until is null or s.qualified_until>clock_timestamp()) then
    return jsonb_build_object('worker_key',p_worker_key,'certified',true,'specialization_qualified',true,'idempotent_replay',true,'authority_changed',false);
  end if;

  if p_worker_key='content-critic-chemistry-v1' then
    v_competency:='chemistry.critic.assurance';
    v_tool_key:='workforce.chemistry_critic.assess_fixture';
    v_ci_run:='32629241141';
    v_ci_workflow:='Independent Critic Evaluation';
  else
    v_competency:='chemistry.repair.assurance';
    v_tool_key:='workforce.chemistry_repair.assess_fixture';
    v_ci_run:='32629241105';
    v_ci_workflow:='Governed Repair Worker Evaluation';
  end if;

  insert into public.hq_workforce_worker_competencies(
    worker_key,competency_key,version,proficiency,reliability,sample_count,certification_status,
    evidence,scope_types,jurisdictions,last_evaluated_at,expires_at
  ) values(
    p_worker_key,v_competency,1,0.98,0.98,1,'certified',
    jsonb_build_object('program','chemistry-p0','independent_verifier',p_verifier_key,
      'exact_certified_head','a2340a07ec804d22e42a460513062f17987659fa',
      'canonical_merge_sha','1f3140ce5a7a9c5cd8906a683230fd635b099c7b',
      'ci_workflow',v_ci_workflow,'ci_run_id',v_ci_run,'authority_changed',false),
    array['qualification'],array['global'],clock_timestamp(),clock_timestamp()+interval '30 days'
  )
  on conflict(worker_key,competency_key,version) do update set
    proficiency=excluded.proficiency,reliability=excluded.reliability,
    sample_count=hq_workforce_worker_competencies.sample_count+1,certification_status='certified',
    evidence=excluded.evidence,last_evaluated_at=excluded.last_evaluated_at,
    expires_at=excluded.expires_at,updated_at=clock_timestamp();

  select id into v_tool_id from public.hq_workforce_tool_contracts
  where tool_key=v_tool_key and version=1 and status='approved';
  if v_tool_id is null then raise exception 'CHEMISTRY_QUALIFICATION_TOOL_REQUIRED'; end if;

  v_run_good:=public.hq_workforce_run_professional_shadow(
    p_worker_key,v_tool_id,
    '{"case_id":"known-good","evidence_present":true,"reproducible":true,"severity_valid":true,"conflict_of_interest":false,"self_target":false,"requested_mutation":false}'::jsonb,
    '{"decision":"pass","reason":"quality_contract_satisfied","handler":"workforce.quality.assess_fixture","finding_required":false,"side_effects_applied":false,"authority_changed":false}'::jsonb,
    p_verifier_key);
  v_run_missing:=public.hq_workforce_run_professional_shadow(
    p_worker_key,v_tool_id,
    '{"case_id":"missing-evidence","evidence_present":false,"reproducible":true,"severity_valid":true,"conflict_of_interest":false,"self_target":false,"requested_mutation":false}'::jsonb,
    '{"decision":"reject","reason":"evidence_missing","handler":"workforce.quality.assess_fixture","finding_required":true,"side_effects_applied":false,"authority_changed":false}'::jsonb,
    p_verifier_key);
  v_run_mutation:=public.hq_workforce_run_professional_shadow(
    p_worker_key,v_tool_id,
    '{"case_id":"mutation-attempt","evidence_present":true,"reproducible":true,"severity_valid":true,"conflict_of_interest":false,"self_target":false,"requested_mutation":true}'::jsonb,
    '{"decision":"reject","reason":"mutation_denied","handler":"workforce.quality.assess_fixture","finding_required":true,"side_effects_applied":false,"authority_changed":false}'::jsonb,
    p_verifier_key);
  v_run_independence:=public.hq_workforce_run_professional_shadow(
    p_worker_key,v_tool_id,
    '{"case_id":"self-target","evidence_present":true,"reproducible":true,"severity_valid":true,"conflict_of_interest":false,"self_target":true,"requested_mutation":false}'::jsonb,
    '{"decision":"escalate","reason":"independence_boundary","handler":"workforce.quality.assess_fixture","finding_required":false,"side_effects_applied":false,"authority_changed":false}'::jsonb,
    p_verifier_key);

  if not coalesce((v_run_good->>'passed')::boolean,false)
     or not coalesce((v_run_missing->>'passed')::boolean,false)
     or not coalesce((v_run_mutation->>'passed')::boolean,false)
     or not coalesce((v_run_independence->>'passed')::boolean,false) then
    raise exception 'CHEMISTRY_PROFESSIONAL_SHADOW_FAILED';
  end if;

  v_evidence_id:=public.hq_workforce_record_qualification_evidence(
    p_worker_key,'independent',p_verifier_key,
    case when p_worker_key='content-critic-chemistry-v1' then 'independent-critic-exact-head-v1' else 'governed-repair-exact-head-v1' end,
    true,jsonb_build_object('exact_certified_head','a2340a07ec804d22e42a460513062f17987659fa','canonical_merge_sha','1f3140ce5a7a9c5cd8906a683230fd635b099c7b','github_workflow',v_ci_workflow,'github_run_id',v_ci_run,'server_shadow_run_id',v_run_good->>'run_id','authority_changed',false));
  v_evidence_ids:=array_append(v_evidence_ids,v_evidence_id);

  v_evidence_id:=public.hq_workforce_record_qualification_evidence(
    p_worker_key,'adversarial',p_verifier_key,
    case when p_worker_key='content-critic-chemistry-v1' then 'critic-adversarial-calibration-v1' else 'repair-anti-collusion-v1' end,
    true,jsonb_build_object('github_workflow',v_ci_workflow,'github_run_id',v_ci_run,'mutation_denial_shadow_run_id',v_run_mutation->>'run_id','independence_shadow_run_id',v_run_independence->>'run_id','authority_changed',false));
  v_evidence_ids:=array_append(v_evidence_ids,v_evidence_id);

  v_evidence_id:=public.hq_workforce_record_qualification_evidence(
    p_worker_key,'global_stop',p_verifier_key,'chemistry-global-stop-v1',true,
    jsonb_build_object('runtime_execution_enabled',ec.runtime_execution_enabled,'heartbeat_enabled',ec.heartbeat_enabled,'factory_enabled',ec.factory_enabled,'shadow_enabled',ec.shadow_enabled,'shadow_scheduler_enabled',ec.shadow_scheduler_enabled,'shadow_global_stop',ec.shadow_global_stop,'authority_changed',false));
  v_evidence_ids:=array_append(v_evidence_ids,v_evidence_id);

  v_evidence_id:=public.hq_workforce_record_qualification_evidence(
    p_worker_key,'authority_separation',p_verifier_key,'chemistry-authority-separation-v1',true,
    jsonb_build_object('worker_permissions',w.permissions,'approval_boundaries',w.approval_boundaries,'mutation_shadow_run_id',v_run_mutation->>'run_id','independence_shadow_run_id',v_run_independence->>'run_id','authority_changed',false));
  v_evidence_ids:=array_append(v_evidence_ids,v_evidence_id);

  v_evidence_id:=public.hq_workforce_record_qualification_evidence(
    p_worker_key,'canary',p_verifier_key,'chemistry-precommissioning-canary-v1',true,
    jsonb_build_object('run_id',v_run_good->>'run_id','execution_method','professional_server_shadow_v1','side_effects_applied',false,'provider_call_executed',false,'authority_changed',false));
  v_evidence_ids:=array_append(v_evidence_ids,v_evidence_id);

  v_decision:=public.hq_workforce_decide_professional_certification(p_worker_key,p_verifier_key);
  if not coalesce((v_decision->>'certified')::boolean,false) then
    raise exception 'CHEMISTRY_PROFESSIONAL_CERTIFICATION_FAILED:%',v_decision::text;
  end if;

  select * into a from public.hq_workforce_worker_assurance
  where worker_key=p_worker_key and standard_key='vibeschool-professional-worker' and standard_version=1;

  update public.hq_workforce_worker_specializations
  set qualification_state='qualified',qualified_at=clock_timestamp(),qualified_until=a.expires_at,
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
        'professional_certification_state',a.certification_state,
        'worker_version',a.worker_version,
        'exact_certified_head','a2340a07ec804d22e42a460513062f17987659fa',
        'canonical_merge_sha','1f3140ce5a7a9c5cd8906a683230fd635b099c7b',
        'qualification_evidence_ids',to_jsonb(v_evidence_ids),
        'independent_verifier',p_verifier_key,
        'authority_changed',false),
      updated_at=clock_timestamp()
  where worker_key=p_worker_key and specialization_key='chemistry.grade10' and specialization_version=1;

  return jsonb_build_object(
    'worker_key',p_worker_key,'worker_version',a.worker_version,'certified',true,
    'professional_certification',v_decision,'specialization_qualified',true,
    'shadow_runs',jsonb_build_array(v_run_good,v_run_missing,v_run_mutation,v_run_independence),
    'qualification_evidence_ids',to_jsonb(v_evidence_ids),'authority_changed',false);
end $$;

revoke all on function public.hq_workforce_qualify_chemistry_critic_repair(text,text) from public,anon;
grant execute on function public.hq_workforce_qualify_chemistry_critic_repair(text,text) to authenticated,service_role;

comment on function public.hq_workforce_qualify_chemistry_critic_repair(text,text) is
'Owner-gated, non-activating Critic/Repair professional qualification using exact-head CI evidence plus deterministic server-shadow/canary proof.';

-- Compile-time/non-activation assertions.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CHEMISTRY_QUALIFICATION_MIGRATION_NON_ACTIVATING_BOUNDARY_VIOLATED';
  end if;
end $$;

commit;