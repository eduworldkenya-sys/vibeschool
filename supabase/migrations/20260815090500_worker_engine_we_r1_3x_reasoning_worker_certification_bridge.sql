-- WE-R1.3X worker-certification bridge for reasoning authority.
-- Existing production analytical workers were independently certified by the pre-L1 registry;
-- factory/execution workers use the L1 certification registry. Reasoning authority accepts either
-- independently governed certification lineage, but never invents execution identity or capability grants.

create or replace function public.hq_workforce_shadow_evaluate_step_authority(
  p_trace_id uuid,
  p_plan_step_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  tr public.hq_workforce_shadow_traces%rowtype;
  st public.hq_workforce_plan_steps%rowtype;
  sm public.hq_workforce_skill_manifests%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  v_decision text:='deny';
  v_reason text:='fail_closed';
  v_missing_competency integer:=0;
  v_unsafe_required_resource integer:=0;
  v_safe_resources integer:=0;
  v_worker_certified boolean:=false;
begin
  select * into tr from public.hq_workforce_shadow_traces where trace_id=p_trace_id;
  if not found then raise exception 'shadow_trace_not_found'; end if;
  select * into st from public.hq_workforce_plan_steps where id=p_plan_step_id;
  if not found then raise exception 'plan_step_not_found'; end if;
  select * into sm from public.hq_workforce_skill_manifests where id=st.skill_manifest_id;
  if not found then raise exception 'skill_manifest_not_found'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;

  select (
    exists(
      select 1
      from public.hq_workforce_workers w
      join public.hq_workforce_worker_certifications c on c.worker_id=w.id
      where w.worker_key=st.worker_key and c.passed
    )
    or exists(
      select 1 from public.hq_workforce_certifications c
      where c.worker_key=st.worker_key and c.status='active' and c.expires_at>clock_timestamp()
    )
  ) into v_worker_certified;

  select count(*) into v_missing_competency
  from unnest(st.required_competencies) req(competency_key)
  where not exists (
    select 1
    from public.hq_workforce_worker_competencies c
    join public.hq_workforce_competency_capabilities b
      on b.competency_key=c.competency_key
     and b.skill_key=sm.skill_key
     and b.status='approved'
    where c.worker_key=st.worker_key
      and c.competency_key=req.competency_key
      and c.certification_status='certified'
      and (c.expires_at is null or c.expires_at>clock_timestamp())
      and (tr.scope_type=any(c.allowed_scope_types) or 'global'=any(c.allowed_scope_types))
  );

  select count(*) into v_unsafe_required_resource
  from public.hq_workforce_skill_resources sr
  join public.hq_workforce_resources r on r.id=sr.resource_id
  where sr.skill_manifest_id=sm.id
    and sr.required
    and not (
      r.enabled and r.shadow_capable
      and r.health_status in ('healthy','degraded')
      and r.required_autonomy=0 and r.risk_class<=2
      and sr.operation=any(r.allowed_operations)
      and (tr.scope_type=any(r.allowed_scope_types) or 'global'=any(r.allowed_scope_types))
    );

  select count(*) into v_safe_resources
  from public.hq_workforce_resolve_step_resources(st.id,'read',100);

  if not ec.shadow_enabled or ec.shadow_global_stop or ec.shadow_anomaly_paused then
    v_reason:='shadow_not_available';
  elsif ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.heartbeat_enabled or ec.factory_enabled then
    v_reason:='r13x_requires_l0_runtime_off';
  elsif st.worker_key is null then
    v_reason:='plan_step_worker_missing';
  elsif not exists(select 1 from public.hq_workforce_workers w where w.worker_key=st.worker_key and w.status='active') then
    v_reason:='worker_not_active';
  elsif public.hq_workforce_current_lifecycle_state(st.worker_key)<>'active' then
    v_reason:='worker_lifecycle_not_active';
  elsif not v_worker_certified then
    v_reason:='worker_has_no_independent_certification';
  elsif sm.capability_mode<>'shadow_reasoning' then
    v_reason:='not_shadow_reasoning_capability';
  elsif sm.tool_contract_id is not null then
    v_reason:='shadow_reasoning_has_execution_tool';
  elsif sm.certification_status<>'certified' then
    v_reason:='skill_uncertified';
  elsif not sm.shadow_capable or sm.autonomy_required<>0 then
    v_reason:='skill_not_l0_shadow';
  elsif not sm.requires_human_approval or not sm.verification_required then
    v_reason:='human_review_or_verification_missing';
  elsif sm.expires_at is not null and sm.expires_at<=clock_timestamp() then
    v_reason:='skill_expired';
  elsif st.required_autonomy<>0 then
    v_reason:='step_autonomy_above_l0';
  elsif st.required_risk>sm.risk_class then
    v_reason:='step_risk_above_skill_ceiling';
  elsif not (tr.scope_type=any(sm.allowed_scope_types) or 'global'=any(sm.allowed_scope_types)) then
    v_reason:='skill_scope_denied';
  elsif cardinality(st.required_competencies)=0 then
    v_reason:='step_competency_contract_missing';
  elsif v_missing_competency<>0 then
    v_reason:='worker_competency_not_certified_for_capability';
  elsif v_unsafe_required_resource<>0 then
    v_reason:='required_resource_not_shadow_safe';
  elsif v_safe_resources=0 then
    v_reason:='no_shadow_safe_registered_resource';
  else
    v_decision:='allow';
    v_reason:='hypothetical_shadow_reasoning_allow';
  end if;

  insert into public.hq_workforce_runtime_authorization_events(
    worker_key,skill_key,decision,reason_code,autonomy_level,risk_class,scope_type,scope_ref
  ) values(
    coalesce(st.worker_key,'unknown'),sm.skill_key,
    case when v_decision='allow' then 'allow' else 'deny' end,
    'shadow_reasoning:'||v_reason,st.required_autonomy,st.required_risk,tr.scope_type,tr.scope_ref
  );

  return jsonb_build_object(
    'mode','shadow_reasoning','decision',v_decision,'reason',v_reason,
    'worker_key',st.worker_key,'worker_independently_certified',v_worker_certified,
    'step_key',st.step_key,'skill_key',sm.skill_key,
    'tool_contract_required',false,'execution_identity_required',false,
    'safe_resource_count',v_safe_resources,'consequential_execution',false
  );
end $$;

revoke all on function public.hq_workforce_shadow_evaluate_step_authority(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_shadow_evaluate_step_authority(uuid,uuid) to service_role;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then
   raise exception 'reasoning_worker_certification_bridge_violated_L0_boundary';
 end if;
end $$;
