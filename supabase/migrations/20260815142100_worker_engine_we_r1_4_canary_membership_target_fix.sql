-- WE-R1.4.10: exact-target correction discovered by adversarial self-review.
-- NON-ACTIVATING. Replaces only the canonical gateway definition; no authority or runtime state changes.
-- access: service-only public.hq_workforce_consequential_execution_gateway
-- authorization-test: public.hq_workforce_consequential_execution_gateway denies public/anon/authenticated and is executable only by service_role.

create or replace function public.hq_workforce_consequential_execution_gateway(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  g public.hq_workforce_capability_authority_grants%rowtype;
  wi public.hq_work_items%rowtype;
  budget_id uuid;
  work_item_id uuid;
  auth jsonb;
  limits jsonb;
  v_authority_id uuid;
  v_resource_identity jsonb;
  v_precondition jsonb;
  v_desired jsonb;
  v_intent jsonb;
  v_intent_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_priority text;
  result jsonb;
  started_at timestamptz:=clock_timestamp();
  max_runtime_ms integer;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found'; end if;
  if t.status<>'running' then raise exception 'task_not_running'; end if;

  auth:=public.hq_workforce_assert_consequential_task_authorized(t.id);
  v_authority_id:=nullif(auth->>'authority_grant_id','')::uuid;
  if v_authority_id is null then raise exception 'consequential_authority_evidence_missing'; end if;
  select * into t from public.hq_workforce_task_contracts where id=p_task_id;
  if t.autonomous_authority_grant_id is distinct from v_authority_id then raise exception 'consequential_authority_binding_mismatch'; end if;
  select * into g from public.hq_workforce_capability_authority_grants where id=v_authority_id;
  if not found then raise exception 'capability_execution_authority_not_found'; end if;
  max_runtime_ms:=g.max_runtime_ms;
  select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
  if not found then raise exception 'tool_contract_not_approved'; end if;

  work_item_id:=nullif(t.payload->>'work_item_id','')::uuid;
  if work_item_id is null then raise exception 'work_item_id_required'; end if;
  v_resource_identity:=jsonb_build_object('work_item_id',work_item_id);
  v_precondition:=t.payload->'precondition_snapshot';
  v_desired:=t.payload->'desired_state';
  if coalesce(jsonb_typeof(v_precondition),'null')<>'object' then raise exception 'precondition_snapshot_required'; end if;
  if coalesce(jsonb_typeof(v_desired),'null')<>'object' then raise exception 'desired_state_required'; end if;

  if tc.handler_key='work_item.triage_and_own' then
    if not (v_precondition ? 'status' and v_precondition ? 'updated_at') then raise exception 'work_item_precondition_incomplete'; end if;
    if v_desired->>'status' is distinct from 'in_progress' then raise exception 'work_item_desired_state_denied'; end if;
  elsif tc.handler_key='work_item.prioritize' then
    if t.capability_key<>'internal.work_queue.prioritize' or t.capability_version<>1
       or t.operation<>'update_priority' or t.resource_type<>'hq_work_items'
       or t.scope_type<>'platform_internal' then raise exception 'priority_canary_contract_mismatch'; end if;
    if not (v_precondition ? 'priority' and v_precondition ? 'updated_at') then raise exception 'priority_canary_precondition_incomplete'; end if;
    if jsonb_object_length(v_desired)<>1 or not (v_desired ? 'priority') then raise exception 'priority_canary_desired_state_not_priority_only'; end if;
    v_priority:=v_desired->>'priority';
    if v_priority is null or v_priority not in ('low','normal','high','critical') then raise exception 'priority_canary_priority_invalid'; end if;
    perform 1 from public.hq_workforce_canary_queue_memberships m
      where m.work_item_id=work_item_id and m.queue_key='worker_engine_internal'
      for key share;
    if not found then raise exception 'priority_canary_queue_membership_required'; end if;
  else
    raise exception 'tool_handler_not_allowlisted';
  end if;

  v_intent:=public.hq_workforce_reserve_execution_intent(t.id,v_authority_id,v_resource_identity,v_precondition,v_desired);
  v_intent_id:=nullif(v_intent->>'intent_id','')::uuid;
  if coalesce((v_intent->>'reused')::boolean,false) then
    return coalesce(v_intent->'result','{}'::jsonb)||jsonb_build_object('idempotent_replay',true,'intent_id',v_intent_id);
  end if;
  if v_intent_id is null then raise exception 'execution_intent_evidence_missing'; end if;

  perform public.hq_workforce_assert_execution_not_stopped(t.id,'pre_reservation');
  if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then raise exception 'capability_runtime_ceiling_exceeded_before_mutation'; end if;
  budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);
  begin
    select * into wi from public.hq_work_items where id=work_item_id for update;
    if not found then raise exception 'work_item_not_found'; end if;

    if tc.handler_key='work_item.triage_and_own' then
      if wi.status is distinct from (v_precondition->>'status') then raise exception 'work_item_precondition_status_changed'; end if;
      if wi.updated_at is distinct from (v_precondition->>'updated_at')::timestamptz then raise exception 'work_item_precondition_version_changed'; end if;
      if wi.status<>'open' then raise exception 'work_item_not_open'; end if;
      v_before:=jsonb_build_object('status',wi.status,'action_taken',coalesce(wi.action_taken,'null'::jsonb),'acted_at',case when wi.acted_at is null then null else to_jsonb(wi.acted_at) end);
      v_after:=jsonb_build_object('status','in_progress','task_id',t.id::text,'authority_grant_id',v_authority_id::text,'plan_step_id',t.plan_step_id::text,'execution_intent_id',v_intent_id::text);
    else
      if not exists(select 1 from public.hq_workforce_canary_queue_memberships m where m.work_item_id=wi.id and m.queue_key='worker_engine_internal') then raise exception 'priority_canary_queue_membership_lost'; end if;
      if wi.priority is distinct from (v_precondition->>'priority') then raise exception 'priority_canary_precondition_priority_changed'; end if;
      if wi.updated_at is distinct from (v_precondition->>'updated_at')::timestamptz then raise exception 'work_item_precondition_version_changed'; end if;
      v_before:=jsonb_build_object('priority',wi.priority);
      v_after:=jsonb_build_object('priority',v_priority);
    end if;

    update public.hq_workforce_execution_intents
      set authoritative_before_state=v_before,expected_after_state=v_after
      where id=v_intent_id and status='reserved';
    if not found then raise exception 'execution_recovery_snapshot_not_recorded'; end if;
    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then raise exception 'capability_runtime_ceiling_exceeded_before_mutation'; end if;
    limits:=public.hq_workforce_reserve_capability_execution(t.id,1);
    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then raise exception 'capability_runtime_ceiling_exceeded_before_mutation'; end if;
    perform public.hq_workforce_assert_execution_not_stopped(t.id,'pre_mutation');

    if tc.handler_key='work_item.triage_and_own' then
      update public.hq_work_items
      set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('worker_key',t.worker_key,'action','triage_and_own','task_id',t.id,'authority_grant_id',v_authority_id,'plan_step_id',t.plan_step_id,'execution_intent_id',v_intent_id),
          acted_at=coalesce(acted_at,clock_timestamp()),updated_at=clock_timestamp(),status='in_progress'
      where id=work_item_id;
    else
      update public.hq_work_items set priority=v_priority where id=work_item_id;
    end if;
    if not found then raise exception 'work_item_mutation_failed'; end if;
    if not exists(select 1 from public.hq_workforce_execution_intents where id=v_intent_id and status='reserved' and authoritative_before_state<>'{}'::jsonb and expected_after_state<>'{}'::jsonb) then raise exception 'execution_recovery_snapshot_not_recorded'; end if;
    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then raise exception 'capability_runtime_ceiling_exceeded'; end if;

    result:=jsonb_build_object('handler',tc.handler_key,'work_item_id',work_item_id,'worker_key',t.worker_key,
      'authority_grant_id',v_authority_id,'plan_step_id',t.plan_step_id,'execution_intent_id',v_intent_id,
      'side_effect',case when tc.handler_key='work_item.prioritize' then 'hq_work_items.priority_updated' else 'hq_work_items.updated' end,
      'authorization',auth,'capability_limits',limits,'circuit_breakers_checked',true,'records_affected',1,
      'elapsed_ms',floor(extract(epoch from (clock_timestamp()-started_at))*1000),'idempotent_replay',false);
    perform public.hq_workforce_consume_budget(budget_id,t.budget_amount);
    perform public.hq_workforce_commit_execution_intent(v_intent_id,result);
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
  if not found then raise exception 'WE-R1.4.10 exact-target fix requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'WE-R1.4.10 exact-target fix changed runtime boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.10 exact-target fix activated authority'; end if;
end $$;
