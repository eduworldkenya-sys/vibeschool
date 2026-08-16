-- Worker Engine production-readiness hardening: durable circuit-breaker denial evidence.
-- NON-ACTIVATING. Breaker denial returns a committed blocked outcome; it never grants authority.
-- access: service-only consequential control functions.
-- authorization-test: public/anon/authenticated cannot execute breaker or consequential gateways.

alter table public.hq_workforce_execution_intents
  drop constraint if exists hq_workforce_execution_intents_status_check;
alter table public.hq_workforce_execution_intents
  add constraint hq_workforce_execution_intents_status_check
  check (status in ('reserved','committed','compensated','blocked'));
alter table public.hq_workforce_execution_intents
  add column if not exists blocked_at timestamptz;

create or replace function public.hq_workforce_block_execution_intent(p_intent_id uuid,p_result jsonb)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if coalesce(jsonb_typeof(p_result),'null')<>'object' or p_result='{}'::jsonb then raise exception 'blocked_execution_result_required'; end if;
  update public.hq_workforce_execution_intents
     set status='blocked',result=p_result,blocked_at=clock_timestamp()
   where id=p_intent_id and status='reserved';
  if not found then raise exception 'execution_intent_not_reservable_for_block'; end if;
end $$;
revoke all on function public.hq_workforce_block_execution_intent(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.hq_workforce_block_execution_intent(uuid,jsonb) to service_role;

-- Breaker denial is represented as durable data rather than insert-then-raise.
create or replace function public.hq_workforce_assert_execution_not_stopped(p_task_id uuid,p_stage text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  b public.hq_workforce_execution_breakers%rowtype;
  v_capability_ref text;
  v_authority_ref text;
  v_event_id bigint;
begin
  if p_stage not in ('pre_reservation','pre_mutation') then raise exception 'execution_breaker_stage_invalid'; end if;
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found'; end if;
  v_capability_ref:=t.capability_key||'@'||t.capability_version::text;
  v_authority_ref:=case when t.autonomous_authority_grant_id is null then null else t.autonomous_authority_grant_id::text end;

  perform pg_advisory_xact_lock(hashtextextended('we-r1.4.8|breaker|global|global',0));
  perform pg_advisory_xact_lock(hashtextextended('we-r1.4.8|breaker|capability|'||v_capability_ref,0));
  if v_authority_ref is not null then
    perform pg_advisory_xact_lock(hashtextextended('we-r1.4.8|breaker|authority_grant|'||v_authority_ref,0));
  end if;

  select * into b from public.hq_workforce_execution_breakers
   where status='tripped' and (
     (scope_type='global' and scope_ref='global')
     or (scope_type='capability' and scope_ref=v_capability_ref)
     or (scope_type='authority_grant' and scope_ref=v_authority_ref)
   )
   order by case scope_type when 'global' then 1 when 'capability' then 2 else 3 end,created_at
   limit 1 for update;

  if found then
    insert into public.hq_workforce_execution_breaker_events(
      breaker_id,event_kind,task_id,authority_grant_id,capability_key,actor,reason_code,evidence
    ) values(
      b.id,'execution_blocked',t.id,t.autonomous_authority_grant_id,t.capability_key,
      'worker-engine',b.reason_code,jsonb_build_object('stage',p_stage,'scope_type',b.scope_type,'scope_ref',b.scope_ref,'durable_denial',true)
    ) returning id into v_event_id;
    return jsonb_build_object(
      'stopped',true,'stage',p_stage,'breaker_id',b.id,'breaker_event_id',v_event_id,
      'scope_type',b.scope_type,'scope_ref',b.scope_ref,'reason_code',b.reason_code
    );
  end if;
  return jsonb_build_object('stopped',false,'stage',p_stage);
end $$;

revoke all on function public.hq_workforce_assert_execution_not_stopped(uuid,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_assert_execution_not_stopped(uuid,text) to service_role;

-- Canonical gateway consumes breaker results and returns a blocked outcome without mutation.
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
  stop_state jsonb;
  v_authority_id uuid;
  v_resource_identity jsonb;
  v_precondition jsonb;
  v_desired jsonb;
  v_intent jsonb;
  v_intent_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_priority text;
  v_expected_revision bigint;
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
    if t.capability_key<>'internal.work_queue.prioritize' or t.capability_version<>1 or t.operation<>'update_priority' or t.resource_type<>'hq_work_items' or t.scope_type<>'platform_internal' then raise exception 'priority_canary_contract_mismatch'; end if;
    if not (v_precondition ? 'priority' and v_precondition ? 'resource_revision') then raise exception 'priority_canary_precondition_incomplete'; end if;
    begin v_expected_revision:=(v_precondition->>'resource_revision')::bigint; exception when others then raise exception 'priority_canary_revision_invalid'; end;
    if v_expected_revision<0 then raise exception 'priority_canary_revision_invalid'; end if;
    if jsonb_object_length(v_desired)<>1 or not (v_desired ? 'priority') then raise exception 'priority_canary_desired_state_not_priority_only'; end if;
    v_priority:=v_desired->>'priority';
    if v_priority is null or v_priority not in ('low','normal','high','critical') then raise exception 'priority_canary_priority_invalid'; end if;
    perform 1 from public.hq_workforce_canary_queue_memberships m where m.work_item_id=work_item_id and m.queue_key='worker_engine_internal' for key share;
    if not found then raise exception 'priority_canary_queue_membership_required'; end if;
  else raise exception 'tool_handler_not_allowlisted'; end if;

  -- First breaker gate occurs before intent/budget reservation. A blocked result commits its event.
  stop_state:=public.hq_workforce_assert_execution_not_stopped(t.id,'pre_reservation');
  if coalesce((stop_state->>'stopped')::boolean,false) then
    return jsonb_build_object('outcome','blocked','mutation_applied',false,'records_affected',0,'breaker',stop_state,'task_id',t.id);
  end if;

  v_intent:=public.hq_workforce_reserve_execution_intent(t.id,v_authority_id,v_resource_identity,v_precondition,v_desired);
  v_intent_id:=nullif(v_intent->>'intent_id','')::uuid;
  if coalesce((v_intent->>'reused')::boolean,false) then return coalesce(v_intent->'result','{}'::jsonb)||jsonb_build_object('idempotent_replay',true,'intent_id',v_intent_id); end if;
  if v_intent_id is null then raise exception 'execution_intent_evidence_missing'; end if;
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
      if wi.resource_revision is distinct from v_expected_revision then raise exception 'work_item_precondition_revision_changed'; end if;
      v_before:=jsonb_build_object('priority',wi.priority,'resource_revision',wi.resource_revision);
      v_after:=jsonb_build_object('priority',v_priority,'resource_revision',wi.resource_revision+1);
    end if;

    update public.hq_workforce_execution_intents set authoritative_before_state=v_before,expected_after_state=v_after where id=v_intent_id and status='reserved';
    if not found then raise exception 'execution_recovery_snapshot_not_recorded'; end if;
    limits:=public.hq_workforce_reserve_capability_execution(t.id,1);

    -- Second breaker gate is immediately before mutation. Release all reservations and persist denial.
    stop_state:=public.hq_workforce_assert_execution_not_stopped(t.id,'pre_mutation');
    if coalesce((stop_state->>'stopped')::boolean,false) then
      perform public.hq_workforce_release_capability_execution(t.id,1);
      perform public.hq_workforce_release_budget(budget_id,t.budget_amount);
      result:=jsonb_build_object('outcome','blocked','mutation_applied',false,'records_affected',0,'breaker',stop_state,'task_id',t.id,'execution_intent_id',v_intent_id);
      perform public.hq_workforce_block_execution_intent(v_intent_id,result);
      return result;
    end if;

    if tc.handler_key='work_item.triage_and_own' then
      update public.hq_work_items set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('worker_key',t.worker_key,'action','triage_and_own','task_id',t.id,'authority_grant_id',v_authority_id,'plan_step_id',t.plan_step_id,'execution_intent_id',v_intent_id),acted_at=coalesce(acted_at,clock_timestamp()),updated_at=clock_timestamp(),status='in_progress' where id=work_item_id;
    else
      update public.hq_work_items set priority=v_priority where id=work_item_id and resource_revision=v_expected_revision;
      if not found then raise exception 'priority_canary_revision_compare_and_set_failed'; end if;
    end if;
    if not found then raise exception 'work_item_mutation_failed'; end if;
    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then raise exception 'capability_runtime_ceiling_exceeded'; end if;
    result:=jsonb_build_object('handler',tc.handler_key,'work_item_id',work_item_id,'worker_key',t.worker_key,'authority_grant_id',v_authority_id,'plan_step_id',t.plan_step_id,'execution_intent_id',v_intent_id,'side_effect',case when tc.handler_key='work_item.prioritize' then 'hq_work_items.priority_updated' else 'hq_work_items.updated' end,'authorization',auth,'capability_limits',limits,'circuit_breakers_checked',true,'records_affected',1,'resource_revision_after',case when tc.handler_key='work_item.prioritize' then v_expected_revision+1 else null end,'elapsed_ms',floor(extract(epoch from (clock_timestamp()-started_at))*1000),'idempotent_replay',false);
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

-- Remains fail-closed and non-activating.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'durable breaker denial requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'durable breaker denial changed runtime boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'durable breaker denial activated authority'; end if;
end $$;
