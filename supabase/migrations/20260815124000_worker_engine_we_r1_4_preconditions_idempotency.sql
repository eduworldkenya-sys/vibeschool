-- WE-R1.4.3: transactional preconditions + database-owned idempotency.
-- NON-ACTIVATING. This gate does not enable runtime, heartbeat, Factory, Shadow,
-- autonomy, risk authority, or capability authority activation.
-- access: service-only public.hq_workforce_execution_intents
-- authorization-test: public.hq_workforce_execution_intents denies public/anon/authenticated direct access and service_role is read-only.

create table if not exists public.hq_workforce_execution_intents (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique check (char_length(dedupe_key)=32),
  task_id uuid not null unique references public.hq_workforce_task_contracts(id) on delete restrict,
  authority_grant_id uuid not null references public.hq_workforce_capability_authority_grants(id) on delete restrict,
  plan_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict,
  capability_key text not null,
  capability_version integer not null check (capability_version>0),
  operation text not null,
  resource_type text not null,
  scope_type text not null,
  scope_ref jsonb not null check (jsonb_typeof(scope_ref)='object'),
  resource_identity jsonb not null check (jsonb_typeof(resource_identity)='object' and resource_identity<>'{}'::jsonb),
  precondition_snapshot jsonb not null check (jsonb_typeof(precondition_snapshot)='object' and precondition_snapshot<>'{}'::jsonb),
  desired_state jsonb not null check (jsonb_typeof(desired_state)='object' and desired_state<>'{}'::jsonb),
  status text not null default 'reserved' check (status in ('reserved','committed','compensated')),
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result)='object'),
  reserved_at timestamptz not null default clock_timestamp(),
  committed_at timestamptz,
  compensated_at timestamptz,
  check ((status<>'committed') or committed_at is not null),
  check ((status<>'compensated') or compensated_at is not null)
);

create index if not exists hq_workforce_execution_intents_lookup_idx
  on public.hq_workforce_execution_intents(capability_key,capability_version,operation,resource_type,status,reserved_at desc);
create index if not exists hq_workforce_execution_intents_authority_idx
  on public.hq_workforce_execution_intents(authority_grant_id,status,reserved_at desc);

alter table public.hq_workforce_execution_intents enable row level security;
revoke all on table public.hq_workforce_execution_intents from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_execution_intents to service_role;

create or replace function public.hq_workforce_reserve_execution_intent(
  p_task_id uuid,
  p_authority_grant_id uuid,
  p_resource_identity jsonb,
  p_precondition_snapshot jsonb,
  p_desired_state jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  g public.hq_workforce_capability_authority_grants%rowtype;
  v_key text;
  v_id uuid;
  v_status text;
  v_result jsonb;
begin
  if coalesce(jsonb_typeof(p_resource_identity),'null')<>'object' or p_resource_identity='{}'::jsonb then raise exception 'execution_resource_identity_required'; end if;
  if coalesce(jsonb_typeof(p_precondition_snapshot),'null')<>'object' or p_precondition_snapshot='{}'::jsonb then raise exception 'execution_precondition_snapshot_required'; end if;
  if coalesce(jsonb_typeof(p_desired_state),'null')<>'object' or p_desired_state='{}'::jsonb then raise exception 'execution_desired_state_required'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'execution_intent_task_not_found'; end if;
  if t.status<>'running' then raise exception 'execution_intent_task_not_running'; end if;
  if t.plan_step_id is null or t.capability_version is null then raise exception 'execution_intent_lineage_missing'; end if;
  if t.autonomous_authority_grant_id is distinct from p_authority_grant_id then raise exception 'execution_intent_authority_mismatch'; end if;

  select * into g from public.hq_workforce_capability_authority_grants where id=p_authority_grant_id;
  if not found or g.status<>'active' or g.expires_at<=clock_timestamp() then raise exception 'execution_intent_authority_inactive'; end if;
  if g.capability_key is distinct from t.capability_key
     or g.capability_version is distinct from t.capability_version
     or g.operation is distinct from t.operation
     or g.resource_type is distinct from t.resource_type
     or g.scope_type is distinct from t.scope_type
     or g.scope_ref is distinct from t.scope_ref then
    raise exception 'execution_intent_authority_lineage_mismatch';
  end if;
  if not g.idempotency_required then raise exception 'execution_intent_idempotency_not_required_by_grant'; end if;
  if coalesce(jsonb_array_length(g.precondition_contract),0)=0 then raise exception 'execution_intent_authority_preconditions_missing'; end if;

  -- jsonb::text is deterministic for equivalent jsonb values; md5 is used only as a compact
  -- uniqueness fingerprint, not for security or authentication.
  v_key:=md5(
    t.capability_key||'|'||t.capability_version::text||'|'||t.operation||'|'||t.resource_type||'|'||
    t.scope_type||'|'||t.scope_ref::text||'|'||p_resource_identity::text||'|'||p_desired_state::text
  );

  insert into public.hq_workforce_execution_intents(
    dedupe_key,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,
    operation,resource_type,scope_type,scope_ref,resource_identity,precondition_snapshot,desired_state
  ) values(
    v_key,t.id,p_authority_grant_id,t.plan_step_id,t.capability_key,t.capability_version,
    t.operation,t.resource_type,t.scope_type,t.scope_ref,p_resource_identity,p_precondition_snapshot,p_desired_state
  )
  on conflict(dedupe_key) do nothing
  returning id,status,result into v_id,v_status,v_result;

  if v_id is not null then
    return jsonb_build_object('intent_id',v_id,'dedupe_key',v_key,'reused',false,'status',v_status);
  end if;

  select id,status,result into v_id,v_status,v_result
    from public.hq_workforce_execution_intents where dedupe_key=v_key for update;
  if not found then raise exception 'execution_intent_conflict_resolution_failed'; end if;
  if v_status='committed' then
    return jsonb_build_object('intent_id',v_id,'dedupe_key',v_key,'reused',true,'status',v_status,'result',v_result);
  end if;
  raise exception 'execution_intent_already_reserved';
end $$;

create or replace function public.hq_workforce_commit_execution_intent(
  p_intent_id uuid,
  p_result jsonb
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if coalesce(jsonb_typeof(p_result),'null')<>'object' or p_result='{}'::jsonb then raise exception 'execution_intent_result_required'; end if;
  update public.hq_workforce_execution_intents
     set status='committed',result=p_result,committed_at=clock_timestamp()
   where id=p_intent_id and status='reserved';
  if not found then raise exception 'execution_intent_not_reservable_for_commit'; end if;
end $$;

revoke all on function public.hq_workforce_reserve_execution_intent(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.hq_workforce_commit_execution_intent(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.hq_workforce_reserve_execution_intent(uuid,uuid,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.hq_workforce_commit_execution_intent(uuid,jsonb) to service_role;

create or replace function public.hq_workforce_consequential_execution_gateway(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  wi public.hq_work_items%rowtype;
  budget_id uuid;
  work_item_id uuid;
  auth jsonb;
  v_authority_id uuid;
  v_resource_identity jsonb;
  v_precondition jsonb;
  v_desired jsonb;
  v_intent jsonb;
  v_intent_id uuid;
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

  if tc.handler_key='work_item.triage_and_own' then
    work_item_id:=nullif(t.payload->>'work_item_id','')::uuid;
    if work_item_id is null then raise exception 'work_item_id_required'; end if;
    v_resource_identity:=jsonb_build_object('work_item_id',work_item_id);
    v_precondition:=t.payload->'precondition_snapshot';
    v_desired:=t.payload->'desired_state';
    if coalesce(jsonb_typeof(v_precondition),'null')<>'object' then raise exception 'precondition_snapshot_required'; end if;
    if coalesce(jsonb_typeof(v_desired),'null')<>'object' then raise exception 'desired_state_required'; end if;
    if not (v_precondition ? 'status' and v_precondition ? 'updated_at') then raise exception 'work_item_precondition_incomplete'; end if;
    if v_desired->>'status' is distinct from 'in_progress' then raise exception 'work_item_desired_state_denied'; end if;
  else
    raise exception 'tool_handler_not_allowlisted';
  end if;

  v_intent:=public.hq_workforce_reserve_execution_intent(t.id,v_authority_id,v_resource_identity,v_precondition,v_desired);
  v_intent_id:=nullif(v_intent->>'intent_id','')::uuid;
  if coalesce((v_intent->>'reused')::boolean,false) then
    return coalesce(v_intent->'result','{}'::jsonb)||jsonb_build_object('idempotent_replay',true,'intent_id',v_intent_id);
  end if;
  if v_intent_id is null then raise exception 'execution_intent_evidence_missing'; end if;

  budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);
  begin
    select * into wi from public.hq_work_items where id=work_item_id for update;
    if not found then raise exception 'work_item_not_found'; end if;
    if wi.status is distinct from (v_precondition->>'status') then raise exception 'work_item_precondition_status_changed'; end if;
    if wi.updated_at is distinct from (v_precondition->>'updated_at')::timestamptz then raise exception 'work_item_precondition_version_changed'; end if;
    if wi.status<>'open' then raise exception 'work_item_not_open'; end if;

    update public.hq_work_items
       set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object(
             'worker_key',t.worker_key,'action','triage_and_own','task_id',t.id,
             'authority_grant_id',v_authority_id,'plan_step_id',t.plan_step_id,'execution_intent_id',v_intent_id),
           acted_at=coalesce(acted_at,clock_timestamp()),updated_at=clock_timestamp(),status='in_progress'
     where id=work_item_id;

    result:=jsonb_build_object(
      'handler',tc.handler_key,'work_item_id',work_item_id,'worker_key',t.worker_key,
      'authority_grant_id',v_authority_id,'plan_step_id',t.plan_step_id,'execution_intent_id',v_intent_id,
      'side_effect','hq_work_items.updated','authorization',auth,'idempotent_replay',false);
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
  if not found then raise exception 'WE-R1.4.3 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'WE-R1.4.3 violated fail-closed runtime boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.3 cannot activate capability authority'; end if;
end $$;
