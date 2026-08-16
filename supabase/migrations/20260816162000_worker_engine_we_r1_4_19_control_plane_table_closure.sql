-- WE-R1.4.19: close direct service-transport writes to execution control-plane truth.
-- NON-ACTIVATING. Tool approval, task lifecycle and canary membership are authority-bearing
-- state. service_role may read them and invoke governed SECURITY DEFINER entrypoints, but
-- may not manufacture/modify rows directly.

revoke insert,update,delete,truncate on table public.hq_workforce_tool_contracts from service_role;
revoke insert,update,delete,truncate on table public.hq_workforce_task_contracts from service_role;
revoke insert,update,delete,truncate on table public.hq_workforce_canary_queue_memberships from service_role;

grant select on table public.hq_workforce_tool_contracts to service_role;
grant select on table public.hq_workforce_task_contracts to service_role;
grant select on table public.hq_workforce_canary_queue_memberships to service_role;

-- Tool contract approval is an owner decision. This path can create or revise a contract
-- only while runtime is stopped, and it records the authenticated owner as approver.
create or replace function public.hq_workforce_owner_put_tool_contract(
  p_tool_key text,
  p_required_capability_key text,
  p_operation text,
  p_resource_type text,
  p_handler_key text,
  p_risk_level smallint,
  p_status text,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_uid uuid;
  v_id uuid;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'tool_contract_change_requires_authenticated_owner'; end if;
  if p_status not in ('draft','approved','disabled') then raise exception 'tool_contract_status_invalid'; end if;
  if char_length(btrim(coalesce(p_tool_key,'')))<3
     or char_length(btrim(coalesce(p_required_capability_key,'')))<3
     or char_length(btrim(coalesce(p_operation,'')))<1
     or char_length(btrim(coalesce(p_resource_type,'')))<1
     or char_length(btrim(coalesce(p_handler_key,'')))<3 then
    raise exception 'tool_contract_identity_invalid';
  end if;
  if p_risk_level not between 0 and 5 then raise exception 'tool_contract_risk_invalid'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'tool_contract_reason_required'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if ec.runtime_execution_enabled or ec.heartbeat_enabled or ec.factory_enabled then
    raise exception 'tool_contract_change_requires_runtime_off';
  end if;

  insert into public.hq_workforce_tool_contracts(
    tool_key,required_capability_key,operation,resource_type,handler_key,risk_level,approved_by,status
  ) values(
    btrim(p_tool_key),btrim(p_required_capability_key),btrim(p_operation),btrim(p_resource_type),btrim(p_handler_key),
    p_risk_level,case when p_status='approved' then v_uid::text||':'||btrim(p_reason) else null end,p_status
  )
  on conflict(tool_key) do update set
    required_capability_key=excluded.required_capability_key,
    operation=excluded.operation,
    resource_type=excluded.resource_type,
    handler_key=excluded.handler_key,
    risk_level=excluded.risk_level,
    approved_by=excluded.approved_by,
    status=excluded.status
  returning id into v_id;
  return v_id;
end $$;

-- Canary membership is owner-governed and can only be changed while all autonomous
-- execution switches are off. Membership is therefore an explicit production-canary
-- decision, never something a worker/service caller can self-enroll into.
create or replace function public.hq_workforce_owner_set_canary_membership(
  p_work_item_id uuid,
  p_queue_key text,
  p_enabled boolean,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare ec public.hq_workforce_engine_contract%rowtype; v_uid uuid;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'canary_membership_requires_authenticated_owner'; end if;
  if p_queue_key<>'worker_engine_internal' then raise exception 'canary_queue_not_allowlisted'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'canary_membership_reason_required'; end if;
  if not exists(select 1 from public.hq_work_items where id=p_work_item_id) then raise exception 'canary_work_item_not_found'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if ec.runtime_execution_enabled or ec.heartbeat_enabled or ec.factory_enabled then
    raise exception 'canary_membership_change_requires_runtime_off';
  end if;

  if coalesce(p_enabled,false) then
    insert into public.hq_workforce_canary_queue_memberships(work_item_id,queue_key,reason)
    values(p_work_item_id,p_queue_key,btrim(p_reason)||' [owner:'||v_uid::text||']')
    on conflict(work_item_id,queue_key) do update set reason=excluded.reason;
  else
    delete from public.hq_workforce_canary_queue_memberships where work_item_id=p_work_item_id and queue_key=p_queue_key;
  end if;
  return jsonb_build_object('work_item_id',p_work_item_id,'queue_key',p_queue_key,'enabled',coalesce(p_enabled,false),'changed_by',v_uid);
end $$;

revoke all on function public.hq_workforce_owner_put_tool_contract(text,text,text,text,text,smallint,text,text)
  from public,anon,service_role;
grant execute on function public.hq_workforce_owner_put_tool_contract(text,text,text,text,text,smallint,text,text)
  to authenticated;
revoke all on function public.hq_workforce_owner_set_canary_membership(uuid,text,boolean,text)
  from public,anon,service_role;
grant execute on function public.hq_workforce_owner_set_canary_membership(uuid,text,boolean,text)
  to authenticated;

-- Structural/non-activation attestation.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.19 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.19 violated fail_closed_activation_boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.19 installation activated authority'; end if;
  if has_table_privilege('service_role','public.hq_workforce_tool_contracts','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_task_contracts','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_task_contracts','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_canary_queue_memberships','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_canary_queue_memberships','UPDATE') then
    raise exception 'WE-R1.4.19 direct service control-plane write remains';
  end if;
end $$;
