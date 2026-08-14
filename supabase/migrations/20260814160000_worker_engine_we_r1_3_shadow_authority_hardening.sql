-- WE-R1.3.4: hypothetical authority hardening for governed shadow recommendations.
-- Evaluates worker, skill, tool, capability and exact scope without invoking any consequential gateway.

create or replace function public.hq_workforce_shadow_evaluate_authority(
  p_trace_id uuid,
  p_skill_manifest_id uuid,
  p_requested_autonomy smallint,
  p_requested_risk smallint,
  p_scope_type text,
  p_scope_ref jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  r public.hq_workforce_shadow_runs%rowtype;
  sm public.hq_workforce_skill_manifests%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  cap public.hq_workforce_capability_grants%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  v_decision text := 'deny';
  v_reason text := 'fail_closed';
  skill_found boolean:=false;
  tool_found boolean:=false;
  cap_found boolean:=false;
begin
  select * into r from public.hq_workforce_shadow_runs where trace_id=p_trace_id;
  if not found then raise exception 'shadow_trace_not_found'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;

  select * into sm from public.hq_workforce_skill_manifests where id=p_skill_manifest_id;
  skill_found:=found;
  if skill_found then
    select * into tc from public.hq_workforce_tool_contracts where id=sm.tool_contract_id and status='approved';
    tool_found:=found;
  end if;
  if tool_found then
    select * into cap from public.hq_workforce_capability_grants
     where worker_key=r.worker_key and capability_key=tc.required_capability_key
       and operation=tc.operation and resource_type=tc.resource_type
       and status='active' and expires_at>clock_timestamp()
     order by granted_at desc limit 1;
    cap_found:=found;
  end if;

  if not ec.shadow_enabled or ec.shadow_global_stop then
    v_reason := 'shadow_global_stop';
  elsif ec.runtime_execution_enabled or ec.runtime_autonomy_level>0 then
    v_reason := 'consequential_runtime_must_remain_off';
  elsif not exists(select 1 from public.hq_workforce_workers w where w.worker_key=r.worker_key and w.status='active') then
    v_reason := 'worker_not_active';
  elsif not skill_found then
    v_reason := 'skill_not_found';
  elsif sm.certification_status <> 'certified' then
    v_reason := 'skill_uncertified';
  elsif not sm.shadow_capable then
    v_reason := 'skill_not_shadow_capable';
  elsif sm.expires_at is not null and sm.expires_at <= clock_timestamp() then
    v_reason := 'skill_expired';
  elsif not tool_found then
    v_reason := 'tool_contract_not_approved';
  elsif p_requested_autonomy > 2 then
    v_reason := 'shadow_autonomy_ceiling_exceeded';
  elsif p_requested_autonomy > sm.autonomy_required then
    v_reason := 'skill_autonomy_ceiling_exceeded';
  elsif p_requested_risk > sm.risk_class then
    v_reason := 'skill_risk_ceiling_exceeded';
  elsif not (p_scope_type=any(sm.allowed_scope_types)) then
    v_reason := 'skill_scope_denied';
  elsif r.scope_type<>p_scope_type or r.scope_ref<>coalesce(p_scope_ref,'{}'::jsonb) then
    v_reason := 'trace_scope_mismatch';
  elsif not cap_found then
    v_reason := 'worker_capability_missing';
  elsif cap.scope_type<>p_scope_type or cap.scope_ref<>coalesce(p_scope_ref,'{}'::jsonb) then
    v_reason := 'worker_capability_scope_mismatch';
  else
    v_decision := 'allow';
    v_reason := 'hypothetical_shadow_allow';
  end if;

  insert into public.hq_workforce_runtime_authorization_events(
    worker_key,skill_key,decision,reason_code,autonomy_level,risk_class,scope_type,scope_ref
  ) values(
    r.worker_key,coalesce(sm.skill_key,'unknown'),case when v_decision='allow' then 'allow' else 'deny' end,
    'shadow:'||v_reason,p_requested_autonomy,p_requested_risk,p_scope_type,coalesce(p_scope_ref,'{}'::jsonb)
  );

  return jsonb_build_object('mode','shadow','decision',v_decision,'reason',v_reason,'consequential_execution',false);
end $$;

revoke all on function public.hq_workforce_shadow_evaluate_authority(uuid,uuid,smallint,smallint,text,jsonb) from public,anon,authenticated;
grant execute on function public.hq_workforce_shadow_evaluate_authority(uuid,uuid,smallint,smallint,text,jsonb) to service_role;
