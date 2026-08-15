-- WE-R1.4.2: Consequential Execution Gateway.
-- NON-ACTIVATING: this migration does not enable runtime execution, heartbeat, Factory, Shadow,
-- autonomy, risk authority, or any active capability authority grant.
-- It structurally routes the legacy task gateway through an Objective -> Plan -> Plan Step ->
-- Certified Capability Version -> Capability Authority -> existing runtime-policy intersection.

alter table public.hq_workforce_task_contracts
  add column if not exists plan_step_id uuid references public.hq_workforce_plan_steps(id) on delete restrict,
  add column if not exists capability_version integer check (capability_version is null or capability_version > 0),
  add column if not exists autonomous_authority_grant_id uuid references public.hq_workforce_capability_authority_grants(id) on delete restrict;

create index if not exists hq_workforce_task_contracts_plan_step_idx
  on public.hq_workforce_task_contracts(plan_step_id)
  where plan_step_id is not null;
create index if not exists hq_workforce_task_contracts_authority_idx
  on public.hq_workforce_task_contracts(autonomous_authority_grant_id)
  where autonomous_authority_grant_id is not null;

create or replace function public.hq_workforce_assert_consequential_task_authorized(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  sm public.hq_workforce_skill_manifests%rowtype;
  ps public.hq_workforce_plan_steps%rowtype;
  p public.hq_workforce_plans%rowtype;
  o public.hq_workforce_objectives%rowtype;
  c public.hq_workforce_capabilities%rowtype;
  g public.hq_workforce_capability_authority_grants%rowtype;
  v_authority_id uuid;
  v_required_autonomy smallint;
  v_required_risk smallint;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found'; end if;
  if t.status <> 'running' then raise exception 'consequential_task_not_running'; end if;
  if t.plan_step_id is null then raise exception 'consequential_plan_step_required'; end if;
  if t.capability_version is null then raise exception 'consequential_capability_version_required'; end if;

  select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
  if not found then raise exception 'tool_contract_not_approved'; end if;
  if tc.required_capability_key is distinct from t.capability_key
     or tc.operation is distinct from t.operation
     or tc.resource_type is distinct from t.resource_type then
    raise exception 'consequential_task_tool_contract_mismatch';
  end if;

  select * into ps from public.hq_workforce_plan_steps where id=t.plan_step_id;
  if not found then raise exception 'consequential_plan_step_not_found'; end if;
  if ps.status not in ('resolvable','simulated') then
    raise exception 'consequential_plan_step_not_executable:%',ps.status;
  end if;
  if ps.actor_mode not in ('worker','deterministic') then
    raise exception 'consequential_plan_step_actor_mode_denied:%',ps.actor_mode;
  end if;
  if ps.worker_key is not null and ps.worker_key is distinct from t.worker_key then
    raise exception 'consequential_plan_step_worker_mismatch';
  end if;

  select * into p from public.hq_workforce_plans where id=ps.plan_id;
  if not found then raise exception 'consequential_plan_not_found'; end if;
  if p.status <> 'selected' then raise exception 'consequential_plan_not_selected:%',p.status; end if;

  select * into o from public.hq_workforce_objectives where id=p.objective_id;
  if not found then raise exception 'consequential_objective_not_found'; end if;
  if o.status <> 'approved' then raise exception 'consequential_objective_not_approved:%',o.status; end if;
  if o.scope_type is distinct from t.scope_type or o.scope_ref is distinct from t.scope_ref then
    raise exception 'consequential_objective_scope_mismatch';
  end if;

  select * into c from public.hq_workforce_capabilities
   where capability_key=t.capability_key and version=t.capability_version and lifecycle_status='certified';
  if not found then raise exception 'consequential_capability_version_uncertified'; end if;
  if not exists (
    select 1 from public.hq_workforce_plan_step_capabilities sc
    where sc.plan_step_id=ps.id and sc.capability_id=c.id and sc.role='required'
  ) then raise exception 'consequential_plan_step_capability_not_required'; end if;

  select * into sm from public.hq_workforce_skill_manifests
   where tool_contract_id=tc.id and certification_status='certified'
     and (expires_at is null or expires_at>clock_timestamp());
  if not found then raise exception 'consequential_skill_uncertified'; end if;
  if not exists (
    select 1 from public.hq_workforce_skill_capabilities sc
    where sc.skill_manifest_id=sm.id and sc.capability_id=c.id and sc.role='implements'
  ) then raise exception 'consequential_skill_capability_binding_missing'; end if;
  if not (t.scope_type=any(sm.allowed_scope_types)) then raise exception 'consequential_skill_scope_denied'; end if;
  if t.max_attempts>sm.max_attempts then raise exception 'consequential_retry_ceiling_exceeded'; end if;
  if sm.requires_human_approval then raise exception 'consequential_skill_requires_human_approval'; end if;

  v_required_autonomy:=greatest(ps.required_autonomy,sm.autonomy_required);
  v_required_risk:=greatest(ps.required_risk,c.risk_class,sm.risk_class,o.risk_class);
  if v_required_autonomy>c.autonomy_ceiling then raise exception 'consequential_capability_autonomy_ceiling_exceeded'; end if;

  v_authority_id:=public.hq_workforce_resolve_active_capability_authority(
    t.worker_key,t.capability_key,t.capability_version,sm.id,tc.id,t.operation,t.resource_type,
    t.scope_type,t.scope_ref,v_required_autonomy,v_required_risk
  );
  select * into g from public.hq_workforce_capability_authority_grants where id=v_authority_id;
  if not found then raise exception 'consequential_authority_resolution_inconsistent'; end if;
  if not g.idempotency_required then raise exception 'consequential_authority_requires_idempotency'; end if;
  if not g.verification_required then raise exception 'consequential_authority_requires_verification'; end if;
  if not g.compensation_required then raise exception 'consequential_authority_requires_compensation'; end if;
  if g.max_records_per_operation<1 then raise exception 'consequential_authority_record_ceiling_invalid'; end if;

  -- Existing WE-R1.2 runtime kernel remains an independent, stricter intersection.
  perform public.hq_workforce_assert_runtime_task_authorized(t.id);

  update public.hq_workforce_task_contracts
     set autonomous_authority_grant_id=v_authority_id
   where id=t.id;

  return jsonb_build_object(
    'decision','allow',
    'task_id',t.id,
    'objective_id',o.id,
    'plan_id',p.id,
    'plan_step_id',ps.id,
    'capability_id',c.id,
    'capability_key',c.capability_key,
    'capability_version',c.version,
    'skill_manifest_id',sm.id,
    'authority_grant_id',v_authority_id,
    'required_autonomy',v_required_autonomy,
    'required_risk',v_required_risk
  );
end $$;

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
  result jsonb;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found'; end if;
  if t.status<>'running' then raise exception 'task_not_running'; end if;

  auth:=public.hq_workforce_assert_consequential_task_authorized(t.id);
  select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
  if not found then raise exception 'tool_contract_not_approved'; end if;

  budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);
  begin
    -- R1.4.2 preserves the only currently allow-listed legacy handler, but it can no longer be
    -- reached without complete R1.4 objective/plan/capability/authority lineage.
    if tc.handler_key='work_item.triage_and_own' then
      work_item_id:=nullif(t.payload->>'work_item_id','')::uuid;
      if work_item_id is null then raise exception 'work_item_id_required'; end if;
      update public.hq_work_items
         set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object(
               'worker_key',t.worker_key,'action','triage_and_own','task_id',t.id,
               'authority_grant_id',t.autonomous_authority_grant_id,
               'plan_step_id',t.plan_step_id),
             acted_at=coalesce(acted_at,clock_timestamp()),
             updated_at=clock_timestamp(),
             status='in_progress'
       where id=work_item_id and status='open';
      if not found then raise exception 'work_item_not_open_or_missing'; end if;
      result:=jsonb_build_object(
        'handler',tc.handler_key,'work_item_id',work_item_id,'worker_key',t.worker_key,
        'side_effect','hq_work_items.updated','authorization',auth);
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

-- Preserve the canonical legacy entrypoint name, but remove its direct mutation path.
create or replace function public.hq_workforce_tool_gateway_execute(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  return public.hq_workforce_consequential_execution_gateway(p_task_id);
end $$;

revoke all on function public.hq_workforce_assert_consequential_task_authorized(uuid) from public,anon,authenticated;
revoke all on function public.hq_workforce_consequential_execution_gateway(uuid) from public,anon,authenticated;
revoke all on function public.hq_workforce_tool_gateway_execute(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_assert_consequential_task_authorized(uuid) to service_role;
grant execute on function public.hq_workforce_consequential_execution_gateway(uuid) to service_role;
grant execute on function public.hq_workforce_tool_gateway_execute(uuid) to service_role;

-- Gate invariant: R1.4.2 changes the authorization path, never activation state.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.2 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'WE-R1.4.2 violated fail-closed runtime boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.2 cannot activate capability authority'; end if;
end $$;
