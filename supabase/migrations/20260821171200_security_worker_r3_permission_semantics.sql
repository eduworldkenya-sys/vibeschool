-- Priority 5 assurance repair: `block_release_recommendation` is advisory evidence,
-- not release mutation authority. Use an exact allowlist instead of substring matching.
-- NON-ACTIVATING: worker permissions and authority are unchanged.

create or replace function public.hq_workforce_verify_security_r3_baseline(p_verifier_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a public.hq_workforce_worker_assurance%rowtype;
  w public.hq_workforce_workers%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  v_competent boolean; v_permissions_safe boolean; v_no_security_runtime_mutation boolean;
  v_independent boolean; v_adversarial boolean; v_global_stop boolean; v_authority_separated boolean;
  v_baseline_id uuid; v_independent_id uuid; v_adversarial_id uuid; v_stop_id uuid; v_sep_id uuid;
begin
  perform public.hq_workforce_professional_baseline('security-worker-01');
  select * into a from public.hq_workforce_worker_assurance where worker_key='security-worker-01' and standard_key='vibeschool-professional-worker' and standard_version=1;
  select * into w from public.hq_workforce_workers where worker_key='security-worker-01';
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if a.worker_version is null or a.risk_class<>'R3' then raise exception 'security_r3_baseline_required'; end if;
  if coalesce(trim(p_verifier_key),'')='' or p_verifier_key='security-worker-01' or p_verifier_key ilike '%creator%' then raise exception 'independent_verifier_required'; end if;

  v_competent:=exists(select 1 from public.hq_workforce_worker_competencies where worker_key='security-worker-01' and competency_key='security.analysis' and certification_status='certified' and proficiency>=0.95 and (expires_at is null or expires_at>clock_timestamp()));
  v_permissions_safe:=not exists(
    select 1 from jsonb_array_elements_text(coalesce(w.permissions,'[]'::jsonb)) p(permission)
    where permission not in ('read_security_metadata','record_finding','block_release_recommendation','request_approval')
  );
  v_no_security_runtime_mutation:=not exists(select 1 from public.hq_workforce_runtime_capability_allowlist where enabled and (capability_key ilike 'security.%' or operation ~* '(grant|revoke|rls|policy|secret|credential|disable|delete|rotate|release)'));
  v_independent:=v_competent and v_permissions_safe and coalesce(btrim(w.mission),'')<>'';
  v_adversarial:=v_permissions_safe and v_no_security_runtime_mutation and not exists(select 1 from public.hq_workforce_capability_authority_grants where status='active' and permitted_worker_key='security-worker-01');
  v_global_stop:=coalesce(ec.shadow_global_stop,false) and not coalesce(ec.runtime_execution_enabled,false) and coalesce(ec.runtime_autonomy_level,0)=0 and coalesce(ec.runtime_max_risk,0)=0;
  v_authority_separated:=v_no_security_runtime_mutation and not exists(select 1 from public.hq_workforce_capability_authority_grants where status='active' and permitted_worker_key='security-worker-01');

  if not (v_independent and v_adversarial and v_global_stop and v_authority_separated) then
    return jsonb_build_object('passed',false,'competent',v_competent,'permissions_safe',v_permissions_safe,'no_security_runtime_mutation',v_no_security_runtime_mutation,'global_stop',v_global_stop,'authority_separated',v_authority_separated,'authority_changed',false);
  end if;

  v_baseline_id:=public.hq_workforce_record_qualification_evidence('security-worker-01','baseline',p_verifier_key,'security-r3-baseline-v1',true,jsonb_build_object('risk_class','R3','worker_version',a.worker_version,'competency','security.analysis','competency_certified',v_competent));
  v_independent_id:=public.hq_workforce_record_qualification_evidence('security-worker-01','independent',p_verifier_key,'security-r3-independent-v1',true,jsonb_build_object('mission_present',true,'permissions_safe',v_permissions_safe,'competency_certified',v_competent));
  v_adversarial_id:=public.hq_workforce_record_qualification_evidence('security-worker-01','adversarial',p_verifier_key,'security-r3-adversarial-v1',true,jsonb_build_object('cases',jsonb_build_array('self_authority','rls_mutation','grant_escalation','identity_disable','secret_rotation','release_bypass'),'release_recommendation_is_advisory',true,'mutation_permissions_present',false,'security_runtime_mutation_enabled',false,'active_worker_authority',false));
  v_stop_id:=public.hq_workforce_record_qualification_evidence('security-worker-01','global_stop',p_verifier_key,'security-r3-global-stop-v1',true,jsonb_build_object('global_stop',ec.shadow_global_stop,'runtime_execution_enabled',ec.runtime_execution_enabled,'runtime_autonomy_level',ec.runtime_autonomy_level,'runtime_max_risk',ec.runtime_max_risk));
  v_sep_id:=public.hq_workforce_record_qualification_evidence('security-worker-01','authority_separation',p_verifier_key,'security-r3-authority-separation-v1',true,jsonb_build_object('active_worker_authority',false,'runtime_mutation_capability_enabled',false,'certification_changes_authority',false));
  return jsonb_build_object('passed',true,'baseline_id',v_baseline_id,'independent_id',v_independent_id,'adversarial_id',v_adversarial_id,'global_stop_id',v_stop_id,'authority_separation_id',v_sep_id,'worker_version',a.worker_version,'authority_changed',false);
end $$;
revoke all on function public.hq_workforce_verify_security_r3_baseline(text) from public,anon,authenticated;
grant execute on function public.hq_workforce_verify_security_r3_baseline(text) to service_role;

create or replace function public.hq_workforce_verify_security_human_authority_boundary(p_verifier_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a public.hq_workforce_worker_assurance%rowtype; w public.hq_workforce_workers%rowtype;
  v_no_runtime_mutation boolean; v_permissions_safe boolean; v_no_active_authority boolean; v_pass boolean; v_evidence uuid;
begin
  select * into a from public.hq_workforce_worker_assurance where worker_key='security-worker-01' and standard_key='vibeschool-professional-worker' and standard_version=1;
  select * into w from public.hq_workforce_workers where worker_key='security-worker-01';
  if not found or a.risk_class<>'R3' then raise exception 'security_r3_baseline_required'; end if;
  if coalesce(trim(p_verifier_key),'')='' or p_verifier_key='security-worker-01' or p_verifier_key ilike '%creator%' then raise exception 'independent_verifier_required'; end if;
  v_no_runtime_mutation:=not exists(select 1 from public.hq_workforce_runtime_capability_allowlist where enabled and (capability_key ilike 'security.%' or operation ~* '(grant|revoke|rls|policy|secret|credential|disable|delete|rotate|release)'));
  v_permissions_safe:=not exists(
    select 1 from jsonb_array_elements_text(coalesce(w.permissions,'[]'::jsonb)) p(permission)
    where permission not in ('read_security_metadata','record_finding','block_release_recommendation','request_approval')
  );
  v_no_active_authority:=not exists(select 1 from public.hq_workforce_capability_authority_grants where status='active' and permitted_worker_key='security-worker-01');
  v_pass:=v_no_runtime_mutation and v_permissions_safe and v_no_active_authority and a.worker_version is not null;
  if v_pass then
    v_evidence:=public.hq_workforce_record_qualification_evidence('security-worker-01','human_authority',p_verifier_key,'security-r3-human-authority-boundary-v1',true,jsonb_build_object('security_runtime_mutation_capability_enabled',false,'worker_mutation_permission_present',false,'release_recommendation_is_advisory',true,'active_security_worker_authority',false,'certification_grants_authority',false,'explicit_human_or_governed_approval_required',true));
  end if;
  return jsonb_build_object('passed',v_pass,'evidence_id',v_evidence,'no_security_runtime_mutation_capability',v_no_runtime_mutation,'permissions_safe',v_permissions_safe,'no_active_worker_authority',v_no_active_authority,'authority_changed',false);
end $$;
revoke all on function public.hq_workforce_verify_security_human_authority_boundary(text) from public,anon,authenticated;
grant execute on function public.hq_workforce_verify_security_human_authority_boundary(text) to service_role;
