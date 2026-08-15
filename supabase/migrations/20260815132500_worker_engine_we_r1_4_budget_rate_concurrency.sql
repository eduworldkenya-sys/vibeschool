-- WE-R1.4.7: capability-scoped budget, rate, concurrency and runtime enforcement.
-- NON-ACTIVATING. This migration only narrows execution. It does not enable runtime,
-- heartbeat, Factory, Shadow, autonomy, risk, or activate capability authority.
-- access: service-only public.hq_workforce_capability_execution_usage
-- authorization-test: public.hq_workforce_capability_execution_usage denies public/anon/authenticated direct access and service_role is read-only.

alter table public.hq_workforce_capability_authority_grants
  add column if not exists max_runtime_ms integer not null default 30000
    check (max_runtime_ms between 50 and 600000);

create table if not exists public.hq_workforce_capability_execution_usage (
  id bigint generated always as identity primary key,
  authority_grant_id uuid not null references public.hq_workforce_capability_authority_grants(id) on delete restrict,
  task_id uuid not null references public.hq_workforce_task_contracts(id) on delete restrict,
  plan_id uuid not null references public.hq_workforce_plans(id) on delete restrict,
  plan_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict,
  capability_key text not null,
  capability_version integer not null check (capability_version > 0),
  limit_kind text not null check (limit_kind in ('cycle','rate')),
  window_key text not null check (char_length(btrim(window_key)) between 3 and 240),
  token_ordinal integer not null check (token_ordinal > 0),
  record_count integer not null check (record_count > 0),
  created_at timestamptz not null default clock_timestamp(),
  unique(authority_grant_id,limit_kind,window_key,token_ordinal),
  unique(task_id,limit_kind)
);

create index if not exists hq_workforce_capability_execution_usage_grant_window_idx
  on public.hq_workforce_capability_execution_usage(authority_grant_id,limit_kind,window_key,token_ordinal);
create index if not exists hq_workforce_capability_execution_usage_task_idx
  on public.hq_workforce_capability_execution_usage(task_id,created_at);

alter table public.hq_workforce_capability_execution_usage enable row level security;
revoke all on table public.hq_workforce_capability_execution_usage from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_capability_execution_usage to service_role;

create or replace function public.hq_workforce_guard_capability_execution_usage_immutable()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  raise exception 'capability_execution_usage_immutable';
end $$;

drop trigger if exists trg_hq_workforce_capability_execution_usage_immutable on public.hq_workforce_capability_execution_usage;
create trigger trg_hq_workforce_capability_execution_usage_immutable
before update or delete on public.hq_workforce_capability_execution_usage
for each row execute function public.hq_workforce_guard_capability_execution_usage_immutable();

-- Reserve one persistent token in a bounded window. Advisory token locks make the
-- check race-safe without collapsing max_concurrency>1 into an accidental global mutex.
create or replace function public.hq_workforce_reserve_capability_limit_token(
  p_authority_grant_id uuid,
  p_task_id uuid,
  p_plan_id uuid,
  p_plan_step_id uuid,
  p_capability_key text,
  p_capability_version integer,
  p_limit_kind text,
  p_window_key text,
  p_ceiling integer,
  p_record_count integer
) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  n integer;
  lock_key bigint;
begin
  if p_limit_kind not in ('cycle','rate') then raise exception 'capability_limit_kind_invalid'; end if;
  if p_ceiling is null or p_ceiling < 1 then raise exception 'capability_limit_ceiling_invalid'; end if;
  if char_length(btrim(coalesce(p_window_key,''))) not between 3 and 240 then raise exception 'capability_limit_window_invalid'; end if;

  for n in 1..p_ceiling loop
    lock_key:=hashtextextended(
      p_authority_grant_id::text||'|'||p_limit_kind||'|'||p_window_key||'|'||n::text,0
    );
    if pg_try_advisory_xact_lock(lock_key) then
      begin
        insert into public.hq_workforce_capability_execution_usage(
          authority_grant_id,task_id,plan_id,plan_step_id,capability_key,capability_version,
          limit_kind,window_key,token_ordinal,record_count
        ) values(
          p_authority_grant_id,p_task_id,p_plan_id,p_plan_step_id,p_capability_key,p_capability_version,
          p_limit_kind,btrim(p_window_key),n,p_record_count
        );
        return n;
      exception when unique_violation then
        null;
      end;
    end if;
  end loop;

  if p_limit_kind='cycle' then raise exception 'capability_operations_per_cycle_exceeded'; end if;
  raise exception 'capability_execution_rate_exceeded';
end $$;

create or replace function public.hq_workforce_reserve_capability_execution(
  p_task_id uuid,
  p_record_count integer
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  ps public.hq_workforce_plan_steps%rowtype;
  g public.hq_workforce_capability_authority_grants%rowtype;
  cycle_key text;
  rate_key text;
  cycle_token integer;
  rate_token integer;
  concurrency_slot integer;
  n integer;
begin
  if p_record_count is null or p_record_count < 1 then raise exception 'capability_record_count_invalid'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found'; end if;
  if t.status<>'running' then raise exception 'task_not_running'; end if;
  if t.autonomous_authority_grant_id is null then raise exception 'capability_execution_authority_missing'; end if;
  if t.plan_step_id is null then raise exception 'capability_execution_plan_step_missing'; end if;

  select * into ps from public.hq_workforce_plan_steps where id=t.plan_step_id;
  if not found then raise exception 'capability_execution_plan_step_not_found'; end if;

  select * into g from public.hq_workforce_capability_authority_grants where id=t.autonomous_authority_grant_id;
  if not found then raise exception 'capability_execution_authority_not_found'; end if;
  if g.status<>'active' or g.expires_at<=clock_timestamp() then raise exception 'capability_execution_authority_inactive'; end if;
  if g.capability_key is distinct from t.capability_key
     or g.capability_version is distinct from t.capability_version
     or (g.permitted_worker_key is not null and g.permitted_worker_key is distinct from t.worker_key)
     or g.operation is distinct from t.operation
     or g.resource_type is distinct from t.resource_type
     or g.scope_type is distinct from t.scope_type
     or g.scope_ref is distinct from t.scope_ref then
    raise exception 'capability_execution_authority_lineage_mismatch';
  end if;

  if p_record_count>g.max_records_per_operation then
    raise exception 'capability_records_per_operation_exceeded';
  end if;

  -- A selected plan is a conservative cycle boundary: elapsed wall-clock time cannot
  -- mint a fresh cycle allowance for the same plan/authority pair.
  cycle_key:='plan:'||ps.plan_id::text;
  rate_key:=to_char(date_trunc('minute',clock_timestamp() at time zone 'UTC'),'YYYYMMDDHH24MI');

  -- Concurrency is an in-flight property. Transaction-scoped slots are held through
  -- commit/rollback, so there is no stale lease to clean up after process failure.
  for n in 1..g.max_concurrency loop
    if pg_try_advisory_xact_lock(hashtextextended(g.id::text||'|concurrency|'||n::text,0)) then
      concurrency_slot:=n;
      exit;
    end if;
  end loop;
  if concurrency_slot is null then raise exception 'capability_concurrency_exceeded'; end if;

  cycle_token:=public.hq_workforce_reserve_capability_limit_token(
    g.id,t.id,ps.plan_id,ps.id,t.capability_key,t.capability_version,
    'cycle',cycle_key,g.max_operations_per_cycle,p_record_count
  );
  rate_token:=public.hq_workforce_reserve_capability_limit_token(
    g.id,t.id,ps.plan_id,ps.id,t.capability_key,t.capability_version,
    'rate',rate_key,g.max_executions_per_minute,p_record_count
  );

  return jsonb_build_object(
    'authority_grant_id',g.id,
    'plan_id',ps.plan_id,
    'plan_step_id',ps.id,
    'record_count',p_record_count,
    'cycle_key',cycle_key,
    'cycle_token',cycle_token,
    'rate_window',rate_key,
    'rate_token',rate_token,
    'concurrency_slot',concurrency_slot,
    'max_runtime_ms',g.max_runtime_ms
  );
end $$;

-- Preserve the complete certified R1.4.3-R1.4.6 execution semantics and insert the
-- R1.4.7 limiter only after idempotency, authoritative row locking and stale-state
-- rejection, immediately before the consequential mutation. This avoids consuming
-- quota for replays or rejected stale work and prevents R1.4.7 from weakening recovery.
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

  -- Authorization may bind the selected grant onto the task. Re-read the locked task
  -- before deriving the rest of the immutable execution lineage.
  select * into t from public.hq_workforce_task_contracts where id=p_task_id;
  if t.autonomous_authority_grant_id is distinct from v_authority_id then
    raise exception 'consequential_authority_binding_mismatch';
  end if;

  select * into g from public.hq_workforce_capability_authority_grants where id=v_authority_id;
  if not found then raise exception 'capability_execution_authority_not_found'; end if;
  max_runtime_ms:=g.max_runtime_ms;

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

  -- R1.4.3 idempotency remains before any R1.4.7 usage reservation. A replay is an
  -- observation of a prior outcome, not a new operation and therefore consumes no token.
  v_intent:=public.hq_workforce_reserve_execution_intent(
    t.id,v_authority_id,v_resource_identity,v_precondition,v_desired
  );
  v_intent_id:=nullif(v_intent->>'intent_id','')::uuid;
  if coalesce((v_intent->>'reused')::boolean,false) then
    return coalesce(v_intent->'result','{}'::jsonb)
      ||jsonb_build_object('idempotent_replay',true,'intent_id',v_intent_id);
  end if;
  if v_intent_id is null then raise exception 'execution_intent_evidence_missing'; end if;

  if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then
    raise exception 'capability_runtime_ceiling_exceeded_before_mutation';
  end if;

  budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);
  begin
    -- R1.4.5 authoritative recovery truth: lock and compare the database row; caller
    -- JSON is only a stale-state precondition and is never compensation truth.
    select * into wi from public.hq_work_items where id=work_item_id for update;
    if not found then raise exception 'work_item_not_found'; end if;
    if wi.status is distinct from (v_precondition->>'status') then raise exception 'work_item_precondition_status_changed'; end if;
    if wi.updated_at is distinct from (v_precondition->>'updated_at')::timestamptz then raise exception 'work_item_precondition_version_changed'; end if;
    if wi.status<>'open' then raise exception 'work_item_not_open'; end if;

    v_before:=jsonb_build_object(
      'status',wi.status,
      'action_taken',coalesce(wi.action_taken,'null'::jsonb),
      'acted_at',case when wi.acted_at is null then null else to_jsonb(wi.acted_at) end
    );
    v_after:=jsonb_build_object(
      'status','in_progress',
      'task_id',t.id::text,
      'authority_grant_id',v_authority_id::text,
      'plan_step_id',t.plan_step_id::text,
      'execution_intent_id',v_intent_id::text
    );

    update public.hq_workforce_execution_intents
       set authoritative_before_state=v_before,
           expected_after_state=v_after
     where id=v_intent_id and status='reserved';
    if not found then raise exception 'execution_recovery_snapshot_not_recorded'; end if;

    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then
      raise exception 'capability_runtime_ceiling_exceeded_before_mutation';
    end if;

    -- The capability limit reservation is inside the same transaction as the mutation.
    -- Any later error or runtime overrun rolls back both usage evidence and side effect.
    limits:=public.hq_workforce_reserve_capability_execution(t.id,1);

    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then
      raise exception 'capability_runtime_ceiling_exceeded_before_mutation';
    end if;

    update public.hq_work_items
       set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object(
             'worker_key',t.worker_key,'action','triage_and_own','task_id',t.id,
             'authority_grant_id',v_authority_id,'plan_step_id',t.plan_step_id,
             'execution_intent_id',v_intent_id),
           acted_at=coalesce(acted_at,clock_timestamp()),
           updated_at=clock_timestamp(),
           status='in_progress'
     where id=work_item_id;
    if not found then raise exception 'work_item_mutation_failed'; end if;

    -- R1.4.5 exact-state trigger has now captured authoritative expected_after_state,
    -- including the database-generated updated_at. Verify the snapshot exists before
    -- any intent is allowed to become committed evidence.
    if not exists (
      select 1 from public.hq_workforce_execution_intents
       where id=v_intent_id and status='reserved'
         and authoritative_before_state<>'{}'::jsonb
         and expected_after_state<>'{}'::jsonb
    ) then
      raise exception 'execution_recovery_snapshot_not_recorded';
    end if;

    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then
      raise exception 'capability_runtime_ceiling_exceeded';
    end if;

    result:=jsonb_build_object(
      'handler',tc.handler_key,
      'work_item_id',work_item_id,
      'worker_key',t.worker_key,
      'authority_grant_id',v_authority_id,
      'plan_step_id',t.plan_step_id,
      'execution_intent_id',v_intent_id,
      'side_effect','hq_work_items.updated',
      'authorization',auth,
      'capability_limits',limits,
      'elapsed_ms',floor(extract(epoch from (clock_timestamp()-started_at))*1000),
      'idempotent_replay',false
    );

    perform public.hq_workforce_consume_budget(budget_id,t.budget_amount);
    perform public.hq_workforce_commit_execution_intent(v_intent_id,result);
    return result;
  exception when others then
    perform public.hq_workforce_release_budget(budget_id,t.budget_amount);
    raise;
  end;
end $$;

-- Preserve the single canonical legacy entrypoint; no alternate mutation gateway exists.
create or replace function public.hq_workforce_tool_gateway_execute(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return public.hq_workforce_consequential_execution_gateway(p_task_id);
end $$;

revoke all on function public.hq_workforce_guard_capability_execution_usage_immutable() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_reserve_capability_limit_token(uuid,uuid,uuid,uuid,text,integer,text,text,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_reserve_capability_execution(uuid,integer) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_consequential_execution_gateway(uuid) from public,anon,authenticated;
revoke all on function public.hq_workforce_tool_gateway_execute(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_consequential_execution_gateway(uuid) to service_role;
grant execute on function public.hq_workforce_tool_gateway_execute(uuid) to service_role;

-- Gate invariant: enforcement may narrow execution only; it cannot activate anything.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.7 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.7 violated fail-closed runtime boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.7 cannot activate capability authority'; end if;
end $$;
