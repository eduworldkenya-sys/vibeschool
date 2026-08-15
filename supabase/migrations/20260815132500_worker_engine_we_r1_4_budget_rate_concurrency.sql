-- WE-R1.4.7: capability-scoped budget, rate, concurrency and runtime enforcement.
-- NON-ACTIVATING. This migration only narrows execution. It does not enable runtime,
-- heartbeat, Factory, Shadow, autonomy, risk, or activate capability authority.
-- access: service-only public.hq_workforce_capability_execution_usage
-- authorization-test: product roles have no direct access; service_role is read-only.

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
        -- A committed execution already owns this token. Try the next bounded token.
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
     or g.permitted_worker_key is not null and g.permitted_worker_key is distinct from t.worker_key
     or g.operation is distinct from t.operation
     or g.resource_type is distinct from t.resource_type
     or g.scope_type is distinct from t.scope_type
     or g.scope_ref is distinct from t.scope_ref then
    raise exception 'capability_execution_authority_lineage_mismatch';
  end if;

  if p_record_count>g.max_records_per_operation then
    raise exception 'capability_records_per_operation_exceeded';
  end if;

  -- The selected plan is the conservative execution cycle boundary. This cannot
  -- under-count work: a plan never receives a fresh cycle merely because time passed.
  cycle_key:='plan:'||ps.plan_id::text;
  rate_key:=to_char(date_trunc('minute',clock_timestamp() at time zone 'UTC'),'YYYYMMDDHH24MI');

  -- Concurrency is an in-flight transaction property, so transaction-scoped advisory
  -- slots are the authority. A transaction owns exactly one slot until commit/rollback.
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

-- R1.4.7 replaces the gateway so every allow-listed mutation reserves capability
-- limits after full authorization and immediately before the consequential write.
create or replace function public.hq_workforce_consequential_execution_gateway(p_task_id uuid)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  g public.hq_workforce_capability_authority_grants%rowtype;
  budget_id uuid;
  work_item_id uuid;
  auth jsonb;
  limits jsonb;
  result jsonb;
  started_at timestamptz:=clock_timestamp();
  max_runtime_ms integer;
  record_count integer;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found'; end if;
  if t.status<>'running' then raise exception 'task_not_running'; end if;

  auth:=public.hq_workforce_assert_consequential_task_authorized(t.id);
  -- Re-read because authorization binds autonomous_authority_grant_id on the task.
  select * into t from public.hq_workforce_task_contracts where id=p_task_id;
  select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
  if not found then raise exception 'tool_contract_not_approved'; end if;
  select * into g from public.hq_workforce_capability_authority_grants where id=t.autonomous_authority_grant_id;
  if not found then raise exception 'capability_execution_authority_not_found'; end if;
  max_runtime_ms:=g.max_runtime_ms;

  if tc.handler_key='work_item.triage_and_own' then
    record_count:=1;
  else
    raise exception 'tool_handler_not_allowlisted';
  end if;

  if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then
    raise exception 'capability_runtime_ceiling_exceeded_before_mutation';
  end if;

  limits:=public.hq_workforce_reserve_capability_execution(t.id,record_count);
  budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);

  begin
    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then
      raise exception 'capability_runtime_ceiling_exceeded_before_mutation';
    end if;

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

    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then
      raise exception 'capability_runtime_ceiling_exceeded';
    end if;

    perform public.hq_workforce_consume_budget(budget_id,t.budget_amount);
    result:=jsonb_build_object(
      'handler',tc.handler_key,'work_item_id',work_item_id,'worker_key',t.worker_key,
      'side_effect','hq_work_items.updated','authorization',auth,'capability_limits',limits,
      'elapsed_ms',floor(extract(epoch from (clock_timestamp()-started_at))*1000)
    );
    return result;
  exception when others then
    perform public.hq_workforce_release_budget(budget_id,t.budget_amount);
    raise;
  end;
end $$;

-- Preserve the single canonical legacy entrypoint; no alternate mutation gateway is added.
create or replace function public.hq_workforce_tool_gateway_execute(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return public.hq_workforce_consequential_execution_gateway(p_task_id);
end $$;

revoke all on function public.hq_workforce_reserve_capability_limit_token(uuid,uuid,uuid,uuid,text,integer,text,text,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_reserve_capability_execution(uuid,integer) from public,anon,authenticated;
revoke all on function public.hq_workforce_consequential_execution_gateway(uuid) from public,anon,authenticated;
revoke all on function public.hq_workforce_tool_gateway_execute(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_reserve_capability_execution(uuid,integer) to service_role;
grant execute on function public.hq_workforce_consequential_execution_gateway(uuid) to service_role;
grant execute on function public.hq_workforce_tool_gateway_execute(uuid) to service_role;

-- Internal helper is callable only by its SECURITY DEFINER owner through trusted functions.

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
