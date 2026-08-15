-- WE-R1.3X.3 remediation: make capability-node contracts structurally complete.
-- Additive and Shadow/L0 safe. No execution, heartbeat, Factory, cron, or autonomy activation.

alter table public.hq_workforce_skill_manifests
  add column if not exists output_contract jsonb not null default '{}'::jsonb,
  add column if not exists compensation_contract jsonb not null default '{}'::jsonb,
  add column if not exists jurisdiction_contract jsonb not null default '{"allowed":["global"]}'::jsonb;

-- Certified Shadow capabilities must declare the complete reasoning contract.
-- Existing certified manifests are preserved for migration compatibility; new/updated
-- Shadow capability certification is enforced through the certification validator below.
create or replace function public.hq_workforce_validate_capability_contract(
  p_skill_manifest_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
stable
as $$
declare
  s public.hq_workforce_skill_manifests%rowtype;
  v_errors text[] := array[]::text[];
  v_resource_count integer := 0;
  v_execution_capability boolean := false;
begin
  select * into s from public.hq_workforce_skill_manifests where id=p_skill_manifest_id;
  if not found then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('capability_not_found'));
  end if;

  v_execution_capability := s.tool_contract_id is not null;

  if nullif(btrim(coalesce(s.purpose,'')),'') is null then v_errors:=array_append(v_errors,'purpose_missing'); end if;
  if s.input_contract is null or jsonb_typeof(s.input_contract)<>'object' then v_errors:=array_append(v_errors,'input_contract_invalid'); end if;
  if s.output_contract is null or jsonb_typeof(s.output_contract)<>'object' then v_errors:=array_append(v_errors,'output_contract_invalid'); end if;
  if s.preconditions is null or jsonb_typeof(s.preconditions)<>'array' then v_errors:=array_append(v_errors,'preconditions_invalid'); end if;
  if s.expected_outcome is null or jsonb_typeof(s.expected_outcome)<>'object' then v_errors:=array_append(v_errors,'expected_outcome_invalid'); end if;
  if s.verification_contract is null or jsonb_typeof(s.verification_contract)<>'object' then v_errors:=array_append(v_errors,'verification_contract_invalid'); end if;
  if s.failure_handling is null or jsonb_typeof(s.failure_handling)<>'object' then v_errors:=array_append(v_errors,'failure_handling_invalid'); end if;
  if s.retry_policy is null or jsonb_typeof(s.retry_policy)<>'object' then v_errors:=array_append(v_errors,'retry_policy_invalid'); end if;
  if s.escalation_contract is null or jsonb_typeof(s.escalation_contract)<>'object' then v_errors:=array_append(v_errors,'escalation_contract_invalid'); end if;
  if s.compensation_contract is null or jsonb_typeof(s.compensation_contract)<>'object' then v_errors:=array_append(v_errors,'compensation_contract_invalid'); end if;
  if s.jurisdiction_contract is null or jsonb_typeof(s.jurisdiction_contract)<>'object' then v_errors:=array_append(v_errors,'jurisdiction_contract_invalid'); end if;
  if s.immutable_version_key is null or s.immutable_version_key <> s.skill_key||'@'||s.version::text then v_errors:=array_append(v_errors,'immutable_version_key_invalid'); end if;
  if s.max_attempts is null or s.max_attempts < 1 then v_errors:=array_append(v_errors,'retry_not_bounded'); end if;
  if s.risk_class not between 0 and 5 then v_errors:=array_append(v_errors,'risk_class_invalid'); end if;
  if s.autonomy_required not between 0 and 4 then v_errors:=array_append(v_errors,'autonomy_ceiling_invalid'); end if;
  if coalesce(array_length(s.allowed_scope_types,1),0)=0 then v_errors:=array_append(v_errors,'scope_missing'); end if;
  if coalesce(array_length(s.allowed_data_classes,1),0)=0 then v_errors:=array_append(v_errors,'data_classification_missing'); end if;

  select count(*) into v_resource_count
    from public.hq_workforce_skill_resources sr
   where sr.skill_manifest_id=s.id and sr.required;

  if s.shadow_capable and not v_execution_capability and s.autonomy_required<>0 then
    v_errors:=array_append(v_errors,'reasoning_capability_must_be_l0');
  end if;
  if s.shadow_capable and not v_execution_capability and not s.requires_human_approval then
    v_errors:=array_append(v_errors,'reasoning_capability_requires_human_review');
  end if;
  if s.shadow_capable and not s.verification_required then
    v_errors:=array_append(v_errors,'shadow_capability_requires_verification');
  end if;
  if s.shadow_capable and v_resource_count=0 then
    v_errors:=array_append(v_errors,'registered_resource_binding_missing');
  end if;

  return jsonb_build_object(
    'valid',cardinality(v_errors)=0,
    'errors',to_jsonb(v_errors),
    'capability_kind',case when v_execution_capability then 'execution' else 'shadow_reasoning' end,
    'required_resource_bindings',v_resource_count,
    'immutable_version_key',s.immutable_version_key
  );
end $$;

-- Capability edges must not silently compose uncertified/revoked nodes.
create or replace function public.hq_workforce_validate_capability_edge(
  p_edge_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
stable
as $$
declare
  e public.hq_workforce_capability_edges%rowtype;
  f public.hq_workforce_skill_manifests%rowtype;
  t public.hq_workforce_skill_manifests%rowtype;
  vf jsonb;
  vt jsonb;
begin
  select * into e from public.hq_workforce_capability_edges where id=p_edge_id;
  if not found then return jsonb_build_object('valid',false,'reason','edge_not_found'); end if;
  select * into f from public.hq_workforce_skill_manifests where id=e.from_skill_manifest_id;
  select * into t from public.hq_workforce_skill_manifests where id=e.to_skill_manifest_id;
  if f.certification_status<>'certified' or t.certification_status<>'certified' then
    return jsonb_build_object('valid',false,'reason','edge_contains_uncertified_capability');
  end if;
  if not f.shadow_capable or not t.shadow_capable then
    return jsonb_build_object('valid',false,'reason','edge_contains_non_shadow_capability');
  end if;
  vf:=public.hq_workforce_validate_capability_contract(f.id);
  vt:=public.hq_workforce_validate_capability_contract(t.id);
  if not (vf->>'valid')::boolean then return jsonb_build_object('valid',false,'reason','from_capability_contract_invalid','detail',vf); end if;
  if not (vt->>'valid')::boolean then return jsonb_build_object('valid',false,'reason','to_capability_contract_invalid','detail',vt); end if;
  return jsonb_build_object('valid',true,'relation_type',e.relation_type);
end $$;

revoke all on function public.hq_workforce_validate_capability_contract(uuid) from public,anon,authenticated;
revoke all on function public.hq_workforce_validate_capability_edge(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_validate_capability_contract(uuid) to service_role;
grant execute on function public.hq_workforce_validate_capability_edge(uuid) to service_role;

do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then
    raise exception 'WE-R1.3X capability hardening violated L0/consequential-runtime boundary';
  end if;
end $$;
