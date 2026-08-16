-- WE-R1.4.19: close direct service-transport writes to execution control-plane truth.
-- NON-ACTIVATING. Tool approval, task lifecycle and canary membership are authority-bearing
-- state. service_role may read them and invoke governed SECURITY DEFINER entrypoints, but
-- may not manufacture/modify rows directly.

alter table public.hq_workforce_tool_contracts
  add column if not exists approved_by uuid,
  add column if not exists approval_reason text;

revoke insert,update,delete,truncate on table public.hq_workforce_tool_contracts from service_role;
revoke insert,update,delete,truncate on table public.hq_workforce_task_contracts from service_role;
revoke insert,update,delete,truncate on table public.hq_workforce_canary_queue_memberships from service_role;

grant select on table public.hq_workforce_tool_contracts to service_role;
grant select on table public.hq_workforce_task_contracts to service_role;
grant select on table public.hq_workforce_canary_queue_memberships to service_role;

-- Tool definitions are migration/certification artifacts. Governance may approve or
-- disable an existing immutable definition, but it cannot rewrite handler, capability,
-- operation or resource identity through an RPC.
create or replace function public.hq_workforce_owner_set_tool_contract_status(
  p_tool_contract_id uuid,
  p_status text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  v_uid uuid;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'tool_contract_change_requires_authenticated_owner'; end if;
  if p_status not in ('approved','disabled') then raise exception 'tool_contract_status_invalid'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'tool_contract_reason_required'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if ec.runtime_execution_enabled or ec.heartbeat_enabled or ec.factory_enabled then
    raise exception 'tool_contract_change_requires_runtime_off';
  end if;

  select * into tc from public.hq_workforce_tool_contracts where id=p_tool_contract_id for update;
  if not found then raise exception 'tool_contract_not_found'; end if;
  if tc.status not in ('draft','approved','disabled') then raise exception 'tool_contract_current_status_invalid:%',tc.status; end if;

  update public.hq_workforce_tool_contracts
     set status=p_status,
         approved_at=case when p_status='approved' then clock_timestamp() else null end,
         approved_by=case when p_status='approved' then v_uid else null end,
         approval_reason=btrim(p_reason)
   where id=tc.id;

  return jsonb_build_object(
    'tool_contract_id',tc.id,
    'tool_key',tc.tool_key,
    'version',tc.version,
    'from_status',tc.status,
    'to_status',p_status,
    'changed_by',v_uid,
    'reason',btrim(p_reason)
  );
end $$;

-- Canary membership is owner-governed and can only be changed while autonomous
-- execution is off. The exact existing schema uses work_item_id as the primary key and
-- records admitted_by/admission_reason as immutable admission provenance.
create or replace function public.hq_workforce_owner_set_canary_membership(
  p_work_item_id uuid,
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
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'canary_membership_reason_required'; end if;
  if not exists(select 1 from public.hq_work_items where id=p_work_item_id) then raise exception 'canary_work_item_not_found'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if ec.runtime_execution_enabled or ec.heartbeat_enabled or ec.factory_enabled then
    raise exception 'canary_membership_change_requires_runtime_off';
  end if;

  if coalesce(p_enabled,false) then
    insert into public.hq_workforce_canary_queue_memberships(
      work_item_id,queue_key,admitted_by,admission_reason,admitted_at
    ) values(
      p_work_item_id,'worker_engine_internal',v_uid::text,btrim(p_reason),clock_timestamp()
    )
    on conflict(work_item_id) do update set
      queue_key='worker_engine_internal',
      admitted_by=excluded.admitted_by,
      admission_reason=excluded.admission_reason,
      admitted_at=clock_timestamp();
  else
    delete from public.hq_workforce_canary_queue_memberships
     where work_item_id=p_work_item_id;
  end if;

  return jsonb_build_object(
    'work_item_id',p_work_item_id,
    'queue_key','worker_engine_internal',
    'enabled',coalesce(p_enabled,false),
    'changed_by',v_uid,
    'reason',btrim(p_reason)
  );
end $$;

revoke all on function public.hq_workforce_owner_set_tool_contract_status(uuid,text,text)
  from public,anon,service_role;
grant execute on function public.hq_workforce_owner_set_tool_contract_status(uuid,text,text)
  to authenticated;
revoke all on function public.hq_workforce_owner_set_canary_membership(uuid,boolean,text)
  from public,anon,service_role;
grant execute on function public.hq_workforce_owner_set_canary_membership(uuid,boolean,text)
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
