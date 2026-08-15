-- WE-R1.4.2 repair: bind mutation evidence to the authority returned by the authorization step.
-- NON-ACTIVATING. No runtime or authority state is enabled here.

create or replace function public.hq_workforce_consequential_execution_gateway(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  budget_id uuid;
  work_item_id uuid;
  auth jsonb;
  v_authority_id uuid;
  result jsonb;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found'; end if;
  if t.status<>'running' then raise exception 'task_not_running'; end if;

  auth:=public.hq_workforce_assert_consequential_task_authorized(t.id);
  v_authority_id:=nullif(auth->>'authority_grant_id','')::uuid;
  if v_authority_id is null then raise exception 'consequential_authority_evidence_missing'; end if;

  select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
  if not found then raise exception 'tool_contract_not_approved'; end if;

  budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);
  begin
    if tc.handler_key='work_item.triage_and_own' then
      work_item_id:=nullif(t.payload->>'work_item_id','')::uuid;
      if work_item_id is null then raise exception 'work_item_id_required'; end if;
      update public.hq_work_items
         set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object(
               'worker_key',t.worker_key,
               'action','triage_and_own',
               'task_id',t.id,
               'authority_grant_id',v_authority_id,
               'plan_step_id',t.plan_step_id),
             acted_at=coalesce(acted_at,clock_timestamp()),
             updated_at=clock_timestamp(),
             status='in_progress'
       where id=work_item_id and status='open';
      if not found then raise exception 'work_item_not_open_or_missing'; end if;
      result:=jsonb_build_object(
        'handler',tc.handler_key,
        'work_item_id',work_item_id,
        'worker_key',t.worker_key,
        'authority_grant_id',v_authority_id,
        'plan_step_id',t.plan_step_id,
        'side_effect','hq_work_items.updated',
        'authorization',auth);
    else
      raise exception 'tool_handler_not_allowlisted';
    end if;
    perform public.hq_workforce_consume_budget(budget_id,t.budget_amount);
    return result;
  exception when others then
    perform public.hq_workforce_release_budget(budget_id,t.budget_amount);
    raise;
  end;
end $$;

revoke all on function public.hq_workforce_consequential_execution_gateway(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_consequential_execution_gateway(uuid) to service_role;

do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.2 repair requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'WE-R1.4.2 repair violated fail-closed runtime boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.2 repair cannot activate capability authority'; end if;
end $$;
