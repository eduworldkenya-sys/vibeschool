-- WE-R1.2: runtime policy kernel and circuit-breaker convergence.
-- Additive/forward hardening. Does NOT enable heartbeat, factory, cron, or autonomous execution.

alter table public.hq_workforce_engine_contract
  add column if not exists runtime_execution_enabled boolean not null default false,
  add column if not exists runtime_autonomy_level smallint not null default 0 check (runtime_autonomy_level between 0 and 4),
  add column if not exists runtime_max_risk smallint not null default 0 check (runtime_max_risk between 0 and 5),
  add column if not exists runtime_anomaly_paused boolean not null default false,
  add column if not exists runtime_max_concurrency integer not null default 1 check (runtime_max_concurrency between 1 and 1000),
  add column if not exists runtime_max_executions_per_minute integer not null default 10 check (runtime_max_executions_per_minute between 1 and 100000);

-- Production-safe default. Schema promotion never implies execution authority.
update public.hq_workforce_engine_contract
set runtime_execution_enabled=false,
    runtime_autonomy_level=0,
    runtime_max_risk=0,
    runtime_anomaly_paused=false,
    updated_at=clock_timestamp()
where singleton=true;

create table if not exists public.hq_workforce_runtime_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  scope_kind text not null check (scope_kind in ('global','jurisdiction','tenant','lane','worker','skill')),
  scope_key text not null,
  enabled boolean not null default false,
  max_autonomy_level smallint not null default 0 check (max_autonomy_level between 0 and 4),
  max_risk_class smallint not null default 0 check (max_risk_class between 0 and 5),
  max_concurrency integer not null default 1 check (max_concurrency between 1 and 1000),
  max_executions_per_minute integer not null default 10 check (max_executions_per_minute between 1 and 100000),
  jurisdiction_key text,
  tenant_key text,
  reason text not null,
  status text not null default 'active' check (status in ('active','superseded','revoked')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index if not exists hq_workforce_runtime_policies_lookup_idx
  on public.hq_workforce_runtime_policies(scope_kind,scope_key,status);

create table if not exists public.hq_workforce_skill_manifests (
  id uuid primary key default gen_random_uuid(),
  skill_key text not null,
  version integer not null check (version > 0),
  tool_contract_id uuid not null references public.hq_workforce_tool_contracts(id) on delete restrict,
  autonomy_required smallint not null check (autonomy_required between 0 and 4),
  risk_class smallint not null check (risk_class between 0 and 5),
  allowed_scope_types text[] not null default array['platform_internal']::text[],
  allowed_data_classes text[] not null default array['internal']::text[],
  max_records_affected integer not null default 1 check (max_records_affected between 0 and 1000000),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  max_runtime_ms integer not null default 30000 check (max_runtime_ms between 1 and 3600000),
  requires_human_approval boolean not null default false,
  verification_required boolean not null default true,
  compensation_strategy text not null default 'manual_review',
  owner_key text not null default 'platform_governance',
  certification_status text not null default 'draft' check (certification_status in ('draft','certified','suspended','revoked','expired')),
  certified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique(skill_key,version),
  unique(tool_contract_id),
  check ((certification_status <> 'certified') or certified_at is not null),
  check (expires_at is null or expires_at > created_at)
);

-- Existing allowlisted tool contracts become explicit certified manifests, but the
-- global runtime remains L0/OFF so this does not activate them.
insert into public.hq_workforce_skill_manifests(
  skill_key,version,tool_contract_id,autonomy_required,risk_class,
  allowed_scope_types,allowed_data_classes,max_records_affected,max_attempts,
  requires_human_approval,verification_required,compensation_strategy,
  certification_status,certified_at
)
select
  tc.tool_key,tc.version,tc.id,3,2,
  array['platform_internal','school']::text[],array['internal']::text[],1,3,
  false,true,'restore_pre_execution_snapshot_or_manual_review',
  'certified',clock_timestamp()
from public.hq_workforce_tool_contracts tc
where tc.status='approved'
on conflict(tool_contract_id) do nothing;

create table if not exists public.hq_workforce_runtime_authorization_events (
  id bigint generated always as identity primary key,
  task_id uuid references public.hq_workforce_task_contracts(id) on delete restrict,
  worker_key text not null,
  skill_key text not null,
  decision text not null check (decision in ('allow','deny')),
  reason_code text not null,
  autonomy_level smallint not null check (autonomy_level between 0 and 4),
  risk_class smallint not null check (risk_class between 0 and 5),
  scope_type text not null,
  scope_ref jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default clock_timestamp()
);
create index if not exists hq_workforce_runtime_auth_rate_idx
  on public.hq_workforce_runtime_authorization_events(worker_key,occurred_at desc);

create or replace function public.hq_workforce_assert_runtime_task_authorized(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  sm public.hq_workforce_skill_manifests%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  w public.hq_workforce_workers%rowtype;
  cap public.hq_workforce_capability_grants%rowtype;
  p record;
  v_max_autonomy integer;
  v_max_risk integer;
  v_max_concurrency integer;
  v_max_rate integer;
  v_running integer;
  v_recent integer;
  v_scope_key text;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id;
  if not found then raise exception 'task_not_found'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if not ec.runtime_execution_enabled then raise exception 'worker_runtime_global_stop'; end if;
  if ec.runtime_anomaly_paused then raise exception 'worker_runtime_anomaly_paused'; end if;

  select * into w from public.hq_workforce_workers where worker_key=t.worker_key;
  if not found then raise exception 'worker_not_found'; end if;
  perform public.hq_workforce_assert_identity(t.worker_key);
  perform public.hq_workforce_assert_certification(t.worker_key);
  if public.hq_workforce_current_lifecycle_state(t.worker_key)<>'active' then raise exception 'worker_not_active'; end if;

  select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
  if not found then raise exception 'tool_contract_not_approved'; end if;
  if tc.required_capability_key<>t.capability_key or tc.operation<>t.operation or tc.resource_type<>t.resource_type then
    raise exception 'task_tool_contract_mismatch';
  end if;

  select * into sm from public.hq_workforce_skill_manifests
   where tool_contract_id=tc.id and certification_status='certified'
     and (expires_at is null or expires_at>clock_timestamp());
  if not found then raise exception 'worker_skill_uncertified'; end if;
  if not (t.scope_type=any(sm.allowed_scope_types)) then raise exception 'worker_skill_scope_type_denied'; end if;
  if t.max_attempts>sm.max_attempts then raise exception 'worker_skill_retry_ceiling_exceeded'; end if;
  if sm.requires_human_approval then raise exception 'worker_skill_human_approval_required'; end if;

  select * into cap from public.hq_workforce_capability_grants
   where worker_key=t.worker_key and capability_key=t.capability_key
     and operation=t.operation and resource_type=t.resource_type
     and status='active' and expires_at>clock_timestamp()
   order by granted_at desc limit 1;
  if not found then raise exception 'worker_capability_denied'; end if;
  if cap.scope_type<>t.scope_type or cap.scope_ref<>t.scope_ref then raise exception 'task_scope_denied'; end if;

  v_max_autonomy:=ec.runtime_autonomy_level;
  v_max_risk:=ec.runtime_max_risk;
  v_max_concurrency:=ec.runtime_max_concurrency;
  v_max_rate:=ec.runtime_max_executions_per_minute;
  v_scope_key:=coalesce(nullif(w.department_key,''),'unassigned');

  -- Any applicable active policy can only reduce authority. A disabled applicable
  -- policy is a circuit breaker and fails closed.
  for p in
    select rp.* from public.hq_workforce_runtime_policies rp
     where rp.status='active' and (
       (rp.scope_kind='global' and rp.scope_key='global') or
       (rp.scope_kind='lane' and rp.scope_key=v_scope_key) or
       (rp.scope_kind='worker' and rp.scope_key=t.worker_key) or
       (rp.scope_kind='skill' and rp.scope_key=sm.skill_key)
     )
  loop
    if not p.enabled then raise exception 'worker_runtime_policy_disabled:%:%',p.scope_kind,p.scope_key; end if;
    v_max_autonomy:=least(v_max_autonomy,p.max_autonomy_level);
    v_max_risk:=least(v_max_risk,p.max_risk_class);
    v_max_concurrency:=least(v_max_concurrency,p.max_concurrency);
    v_max_rate:=least(v_max_rate,p.max_executions_per_minute);
  end loop;

  if sm.autonomy_required>v_max_autonomy then raise exception 'worker_autonomy_level_denied'; end if;
  if sm.risk_class>v_max_risk then raise exception 'worker_risk_class_denied'; end if;

  select count(*) into v_running from public.hq_workforce_task_contracts q
   where q.status='running' and (q.worker_key=t.worker_key or q.tool_contract_id=t.tool_contract_id);
  if v_running>v_max_concurrency then raise exception 'worker_concurrency_ceiling_exceeded'; end if;

  select count(*) into v_recent from public.hq_workforce_runtime_authorization_events e
   where e.decision='allow' and e.occurred_at>clock_timestamp()-interval '1 minute'
     and (e.worker_key=t.worker_key or e.skill_key=sm.skill_key);
  if v_recent>=v_max_rate then raise exception 'worker_rate_ceiling_exceeded'; end if;

  insert into public.hq_workforce_runtime_authorization_events(
    task_id,worker_key,skill_key,decision,reason_code,autonomy_level,risk_class,scope_type,scope_ref
  ) values(t.id,t.worker_key,sm.skill_key,'allow','policy_kernel_allow',sm.autonomy_required,sm.risk_class,t.scope_type,t.scope_ref);

  return jsonb_build_object(
    'decision','allow','task_id',t.id,'worker_key',t.worker_key,'skill_key',sm.skill_key,
    'autonomy_required',sm.autonomy_required,'risk_class',sm.risk_class,
    'effective_max_autonomy',v_max_autonomy,'effective_max_risk',v_max_risk
  );
end $$;

-- Replace the consequential tool gateway so every business mutation passes the
-- same scope-aware policy kernel before budget reservation or side effect.
create or replace function public.hq_workforce_tool_gateway_execute(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  budget_id uuid;
  work_item_id uuid;
  result jsonb;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found'; end if;
  if t.status<>'running' then raise exception 'task_not_running'; end if;

  perform public.hq_workforce_assert_runtime_task_authorized(t.id);

  select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
  if not found then raise exception 'tool_contract_not_approved'; end if;

  budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);
  begin
    if tc.handler_key='work_item.triage_and_own' then
      work_item_id:=nullif(t.payload->>'work_item_id','')::uuid;
      if work_item_id is null then raise exception 'work_item_id_required'; end if;
      update public.hq_work_items
         set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('worker_key',t.worker_key,'action','triage_and_own','task_id',t.id),
             acted_at=coalesce(acted_at,clock_timestamp()),updated_at=clock_timestamp(),status='in_progress'
       where id=work_item_id and status='open';
      if not found then raise exception 'work_item_not_open_or_missing'; end if;
      result:=jsonb_build_object('handler',tc.handler_key,'work_item_id',work_item_id,'worker_key',t.worker_key,'side_effect','hq_work_items.updated');
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

-- Queue state changes are also runtime execution. A global stop must block direct
-- queue invocation before leases/attempt counters can change.
create or replace function public.hq_workforce_execute_task_queue(p_limit integer default 20,p_lease_seconds integer default 60)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; n integer:=0; evidence jsonb; err text; v_enabled boolean; v_paused boolean;
begin
  if p_limit<1 or p_limit>100 then raise exception 'invalid_queue_limit'; end if;
  if p_lease_seconds<10 or p_lease_seconds>3600 then raise exception 'invalid_lease_seconds'; end if;
  select runtime_execution_enabled,runtime_anomaly_paused into v_enabled,v_paused from public.hq_workforce_engine_contract where singleton=true;
  if not coalesce(v_enabled,false) then raise exception 'worker_runtime_global_stop'; end if;
  if coalesce(v_paused,false) then raise exception 'worker_runtime_anomaly_paused'; end if;

  update public.hq_workforce_task_contracts
     set status='queued',lease_expires_at=null,last_error=coalesce(last_error,'')||case when last_error is null then '' else '; ' end||'lease_expired'
   where status='running' and lease_expires_at<clock_timestamp();

  for r in
    select id from public.hq_workforce_task_contracts
     where status='queued' and next_attempt_at<=clock_timestamp()
     order by created_at for update skip locked limit p_limit
  loop
    update public.hq_workforce_task_contracts
       set status='running',attempt_count=attempt_count+1,started_at=coalesce(started_at,clock_timestamp()),lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds)
     where id=r.id;
    begin
      evidence:=public.hq_workforce_tool_gateway_execute(r.id);
      update public.hq_workforce_task_contracts set status='completed',completed_at=clock_timestamp(),lease_expires_at=null,execution_evidence=evidence,last_error=null where id=r.id;
    exception when others then
      err:=sqlerrm;
      update public.hq_workforce_task_contracts
         set status=case when attempt_count>=max_attempts then 'dead_letter' else 'queued' end,
             next_attempt_at=case when attempt_count>=max_attempts then next_attempt_at else clock_timestamp()+make_interval(secs=>least(300,5*(2^greatest(attempt_count-1,0))::integer)) end,
             lease_expires_at=null,last_error=err
       where id=r.id;
      insert into public.hq_workforce_dead_letters(task_id,worker_key,error_code,error_detail,attempts,payload_snapshot)
      select id,worker_key,'EXECUTION_FAILED',err,attempt_count,payload from public.hq_workforce_task_contracts where id=r.id and status='dead_letter'
      on conflict(task_id) do update set error_detail=excluded.error_detail,attempts=excluded.attempts,payload_snapshot=excluded.payload_snapshot,created_at=clock_timestamp();
    end;
    n:=n+1;
  end loop;
  return n;
end $$;

-- Scheduled orchestration remains the only service-role positive execution entrypoint.
-- Even if heartbeat/factory switches are accidentally enabled later, runtime L0/OFF
-- wins and the scheduler returns without invoking lower-level mutation paths.
create or replace function public.hq_workforce_scheduled_heartbeat()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_hb boolean; v_factory boolean; v_hb_limit integer; v_factory_limit integer;
  v_runtime_enabled boolean; v_anomaly_paused boolean;
  v_factory_result jsonb; v_qual_result jsonb; v_runtime_result jsonb;
begin
  select heartbeat_enabled,factory_enabled,heartbeat_limit,factory_limit,runtime_execution_enabled,runtime_anomaly_paused
    into v_hb,v_factory,v_hb_limit,v_factory_limit,v_runtime_enabled,v_anomaly_paused
    from public.hq_workforce_engine_contract where singleton=true;
  if not coalesce(v_runtime_enabled,false) then return jsonb_build_object('status','runtime_disabled','mode','deterministic'); end if;
  if coalesce(v_anomaly_paused,false) then return jsonb_build_object('status','anomaly_paused','mode','deterministic'); end if;
  if not coalesce(v_hb,false) and not coalesce(v_factory,false) then return jsonb_build_object('status','disabled','mode','deterministic'); end if;
  if coalesce(v_factory,false) then
    v_factory_result:=public.hq_workforce_autonomous_factory_heartbeat(coalesce(v_factory_limit,10));
    v_qual_result:=public.hq_workforce_qualify_factory_workers(coalesce(v_factory_limit,10));
  else
    v_factory_result:='{"status":"disabled"}'::jsonb; v_qual_result:='{"status":"disabled"}'::jsonb;
  end if;
  if coalesce(v_hb,false) then v_runtime_result:=public.hq_workforce_autonomous_heartbeat(coalesce(v_hb_limit,20));
  else v_runtime_result:='{"status":"disabled"}'::jsonb; end if;
  return jsonb_build_object('factory',v_factory_result,'qualification',v_qual_result,'runtime',v_runtime_result,'mode','deterministic');
end $$;

-- Close remaining direct service-role positive mutation paths. SECURITY DEFINER
-- orchestration can still call them internally as function owner.
revoke all on function public.hq_workforce_tool_gateway_execute(uuid) from service_role;
revoke all on function public.hq_workforce_execute_task_queue(integer,integer) from service_role;
revoke all on function public.hq_workforce_verify_task(uuid,text) from service_role;
revoke all on function public.hq_workforce_assert_runtime_task_authorized(uuid) from public,anon,authenticated,service_role;

alter table public.hq_workforce_runtime_policies enable row level security;
alter table public.hq_workforce_skill_manifests enable row level security;
alter table public.hq_workforce_runtime_authorization_events enable row level security;

revoke all on table public.hq_workforce_runtime_policies from public,anon,authenticated,service_role;
revoke all on table public.hq_workforce_skill_manifests from public,anon,authenticated,service_role;
revoke all on table public.hq_workforce_runtime_authorization_events from public,anon,authenticated,service_role;
grant select,insert,update on table public.hq_workforce_runtime_policies to service_role;
grant select,insert,update on table public.hq_workforce_skill_manifests to service_role;
grant select on table public.hq_workforce_runtime_authorization_events to service_role;

-- Preserve activation separation mechanically.
update public.hq_workforce_engine_contract
set heartbeat_enabled=false,
    factory_enabled=false,
    runtime_execution_enabled=false,
    runtime_autonomy_level=0,
    runtime_max_risk=0,
    updated_at=clock_timestamp()
where singleton=true;

do $$
declare v_job record;
begin
  if to_regclass('cron.job') is not null then
    for v_job in execute 'select jobid from cron.job where jobname=$1' using 'vibeschool-worker-engine-heartbeat'
    loop perform cron.unschedule(v_job.jobid); end loop;
  end if;
end $$;
