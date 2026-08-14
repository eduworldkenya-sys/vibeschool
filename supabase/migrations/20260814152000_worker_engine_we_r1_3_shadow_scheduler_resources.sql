-- WE-R1.3.5 / R1.3.7: inert shadow scheduler contracts and resource governance.
-- This migration does NOT create cron, enable shadow mode, enable heartbeat/factory, or execute consequential actions.
-- access: service-only public.hq_workforce_shadow_candidates
-- authorization-test: public.hq_workforce_shadow_candidates denies anon/authenticated direct access; service runtime may append shadow-only candidate records.
-- access: service-only public.hq_workforce_shadow_resource_usage
-- authorization-test: public.hq_workforce_shadow_resource_usage denies anon/authenticated direct access; service runtime may append bounded usage evidence.
-- access: service-only public.hq_workforce_shadow_anomalies
-- authorization-test: public.hq_workforce_shadow_anomalies denies anon/authenticated direct access; service runtime may append pause/escalation evidence.

alter table public.hq_workforce_engine_contract
  add column if not exists shadow_max_concurrency integer not null default 1 check (shadow_max_concurrency between 1 and 100),
  add column if not exists shadow_max_retries integer not null default 2 check (shadow_max_retries between 0 and 10),
  add column if not exists shadow_max_queue_depth integer not null default 100 check (shadow_max_queue_depth between 1 and 100000),
  add column if not exists shadow_anomaly_paused boolean not null default false;

update public.hq_workforce_engine_contract
set heartbeat_enabled=false,
    factory_enabled=false,
    runtime_execution_enabled=false,
    runtime_autonomy_level=0,
    runtime_max_risk=0,
    shadow_enabled=false,
    shadow_scheduler_enabled=false,
    shadow_global_stop=true,
    shadow_anomaly_paused=false,
    updated_at=clock_timestamp()
where singleton=true;

create table if not exists public.hq_workforce_shadow_candidates (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid references public.hq_workforce_shadow_runs(trace_id) on delete restrict,
  source_work_item_id uuid references public.hq_work_items(id) on delete restrict,
  candidate_fingerprint text not null,
  lane_key text not null,
  worker_key text,
  skill_manifest_id uuid references public.hq_workforce_skill_manifests(id) on delete restrict,
  scope_type text not null default 'platform_internal',
  scope_ref jsonb not null default '{}'::jsonb,
  priority smallint not null check (priority between 0 and 100),
  sla_due_at timestamptz,
  status text not null default 'candidate' check (status in ('candidate','duplicate','recommended','escalated','closed')),
  duplicate_of uuid references public.hq_workforce_shadow_candidates(id) on delete restrict,
  reasoning_summary text,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  created_at timestamptz not null default clock_timestamp(),
  unique(candidate_fingerprint)
);
create index if not exists hq_workforce_shadow_candidates_status_idx on public.hq_workforce_shadow_candidates(status,priority desc,created_at);
create index if not exists hq_workforce_shadow_candidates_lane_idx on public.hq_workforce_shadow_candidates(lane_key,created_at desc);

create table if not exists public.hq_workforce_shadow_resource_usage (
  id bigint generated always as identity primary key,
  trace_id uuid references public.hq_workforce_shadow_runs(trace_id) on delete restrict,
  worker_key text,
  resource_kind text not null check (resource_kind in ('cycle','candidate','evidence_read','reasoning_step','recommendation','retry','denial','escalation')),
  amount numeric not null default 1 check (amount >= 0),
  unit text not null default 'count',
  window_started_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp()
);
create index if not exists hq_workforce_shadow_resource_usage_window_idx on public.hq_workforce_shadow_resource_usage(resource_kind,window_started_at,recorded_at);

create table if not exists public.hq_workforce_shadow_anomalies (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid references public.hq_workforce_shadow_runs(trace_id) on delete restrict,
  anomaly_key text not null,
  severity text not null check (severity in ('warning','high','critical')),
  action text not null check (action in ('deny','escalate','pause')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz
);
create index if not exists hq_workforce_shadow_anomalies_open_idx on public.hq_workforce_shadow_anomalies(severity,created_at desc) where resolved_at is null;

create or replace function public.hq_workforce_shadow_candidate_fingerprint(p_work_item public.hq_work_items)
returns text
language sql
immutable
set search_path=public,pg_temp
as $$
  select md5(concat_ws('|',coalesce(p_work_item.department_key,''),coalesce(p_work_item.work_type,''),coalesce(p_work_item.source_type,''),coalesce(p_work_item.source_id::text,''),coalesce(p_work_item.title,'')))
$$;

-- One bounded shadow scheduler cycle over internal HQ work only.
-- It reads production facts and writes exclusively to Worker Engine shadow/control tables.
create or replace function public.hq_workforce_run_shadow_cycle(p_cycle_key text, p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  w public.hq_work_items%rowtype;
  fp text;
  inserted_count integer:=0;
  duplicate_count integer:=0;
  escalated_count integer:=0;
  queue_depth integer;
  window_start timestamptz:=date_trunc('hour',clock_timestamp());
  cycles_this_hour integer;
begin
  if p_limit<1 or p_limit>100 then raise exception 'shadow_cycle_limit_invalid'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if not ec.shadow_enabled or not ec.shadow_scheduler_enabled or ec.shadow_global_stop then raise exception 'shadow_scheduler_global_stop'; end if;
  if ec.shadow_anomaly_paused then raise exception 'shadow_scheduler_anomaly_paused'; end if;
  if ec.runtime_execution_enabled or ec.runtime_autonomy_level>0 then raise exception 'shadow_requires_consequential_runtime_off'; end if;

  select count(*) into cycles_this_hour from public.hq_workforce_shadow_resource_usage
   where resource_kind='cycle' and window_started_at=window_start;
  if cycles_this_hour>=ec.shadow_max_cycles_per_hour then
    insert into public.hq_workforce_shadow_anomalies(anomaly_key,severity,action,details)
    values('cycle_rate_ceiling','high','pause',jsonb_build_object('cycle_key',p_cycle_key,'count',cycles_this_hour,'ceiling',ec.shadow_max_cycles_per_hour));
    update public.hq_workforce_engine_contract set shadow_anomaly_paused=true,updated_at=clock_timestamp() where singleton=true;
    raise exception 'shadow_cycle_rate_ceiling_exceeded';
  end if;

  select count(*) into queue_depth from public.hq_workforce_shadow_candidates where status in ('candidate','recommended','escalated');
  if queue_depth>=ec.shadow_max_queue_depth then
    insert into public.hq_workforce_shadow_anomalies(anomaly_key,severity,action,details)
    values('queue_depth_ceiling','critical','pause',jsonb_build_object('depth',queue_depth,'ceiling',ec.shadow_max_queue_depth));
    update public.hq_workforce_engine_contract set shadow_anomaly_paused=true,updated_at=clock_timestamp() where singleton=true;
    raise exception 'shadow_queue_depth_ceiling_exceeded';
  end if;

  insert into public.hq_workforce_shadow_resource_usage(resource_kind,window_started_at,amount)
  values('cycle',window_start,1);

  for w in
    select * from public.hq_work_items
    where status='open'
    order by case priority when 'critical' then 1 when 'high' then 2 when 'normal' then 3 else 4 end, created_at
    limit least(p_limit,ec.shadow_max_candidates_per_cycle)
  loop
    fp:=public.hq_workforce_shadow_candidate_fingerprint(w);
    begin
      insert into public.hq_workforce_shadow_candidates(
        source_work_item_id,candidate_fingerprint,lane_key,scope_type,scope_ref,priority,sla_due_at,status,reasoning_summary
      ) values(
        w.id,fp,w.department_key,'platform_internal',jsonb_build_object('work_item_id',w.id),
        case w.priority when 'critical' then 100 when 'high' then 75 when 'normal' then 50 else 25 end,
        w.due_at,'candidate','Detected from open HQ internal work item; no consequential action performed.'
      );
      inserted_count:=inserted_count+1;
      insert into public.hq_workforce_shadow_resource_usage(resource_kind,window_started_at,amount)
      values('candidate',window_start,1);
    exception when unique_violation then
      duplicate_count:=duplicate_count+1;
    end;
  end loop;

  return jsonb_build_object(
    'mode','shadow','cycle_key',p_cycle_key,'inserted',inserted_count,'duplicates',duplicate_count,
    'escalated',escalated_count,'consequential_execution',false
  );
end $$;

alter table public.hq_workforce_shadow_candidates enable row level security;
alter table public.hq_workforce_shadow_resource_usage enable row level security;
alter table public.hq_workforce_shadow_anomalies enable row level security;

revoke all on table public.hq_workforce_shadow_candidates from public,anon,authenticated;
revoke all on table public.hq_workforce_shadow_resource_usage from public,anon,authenticated;
revoke all on table public.hq_workforce_shadow_anomalies from public,anon,authenticated;
grant select,insert,update on table public.hq_workforce_shadow_candidates to service_role;
grant select,insert on table public.hq_workforce_shadow_resource_usage to service_role;
grant select,insert,update on table public.hq_workforce_shadow_anomalies to service_role;
grant usage,select on sequence public.hq_workforce_shadow_resource_usage_id_seq to service_role;

revoke all on function public.hq_workforce_shadow_candidate_fingerprint(public.hq_work_items) from public,anon,authenticated;
revoke all on function public.hq_workforce_run_shadow_cycle(text,integer) from public,anon,authenticated;
grant execute on function public.hq_workforce_shadow_candidate_fingerprint(public.hq_work_items) to service_role;
grant execute on function public.hq_workforce_run_shadow_cycle(text,integer) to service_role;

-- No cron is installed. Preserve all activation gates OFF.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0
     or ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop then
    raise exception 'WE-R1.3 scheduler migration violated fail-closed boundary';
  end if;
end $$;
