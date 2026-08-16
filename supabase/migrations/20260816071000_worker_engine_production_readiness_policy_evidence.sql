-- Worker Engine production-readiness hardening: immutable policy evidence for runtime authorization.
-- NON-ACTIVATING. Evidence capture only.

alter table public.hq_workforce_runtime_authorization_events
  add column if not exists policy_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists policy_snapshot_sha256 text,
  add column if not exists engine_contract_snapshot jsonb not null default '{}'::jsonb;

create or replace function public.hq_workforce_bind_runtime_policy_evidence()
returns trigger
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_lane text;
  v_policies jsonb;
  v_engine jsonb;
begin
  select coalesce(nullif(department_key,''),'unassigned') into v_lane
  from public.hq_workforce_workers where worker_key=new.worker_key;

  select coalesce(jsonb_agg(to_jsonb(rp) order by rp.scope_kind,rp.scope_key,rp.id),'[]'::jsonb)
    into v_policies
  from public.hq_workforce_runtime_policies rp
  where rp.status='active' and (
    (rp.scope_kind='global' and rp.scope_key='global') or
    (rp.scope_kind='lane' and rp.scope_key=v_lane) or
    (rp.scope_kind='worker' and rp.scope_key=new.worker_key) or
    (rp.scope_kind='skill' and rp.scope_key=new.skill_key)
  );

  select jsonb_build_object(
    'runtime_execution_enabled',runtime_execution_enabled,
    'runtime_autonomy_level',runtime_autonomy_level,
    'runtime_max_risk',runtime_max_risk,
    'runtime_anomaly_paused',runtime_anomaly_paused,
    'runtime_max_concurrency',runtime_max_concurrency,
    'runtime_max_executions_per_minute',runtime_max_executions_per_minute,
    'updated_at',updated_at
  ) into v_engine
  from public.hq_workforce_engine_contract where singleton=true;

  new.policy_snapshot:=v_policies;
  new.policy_snapshot_sha256:=encode(digest(convert_to(v_policies::text,'UTF8'),'sha256'),'hex');
  new.engine_contract_snapshot:=coalesce(v_engine,'{}'::jsonb);
  return new;
end $$;

revoke all on function public.hq_workforce_bind_runtime_policy_evidence() from public,anon,authenticated,service_role;

drop trigger if exists trg_hq_workforce_bind_runtime_policy_evidence on public.hq_workforce_runtime_authorization_events;
create trigger trg_hq_workforce_bind_runtime_policy_evidence
before insert on public.hq_workforce_runtime_authorization_events
for each row execute function public.hq_workforce_bind_runtime_policy_evidence();

create or replace function public.hq_workforce_runtime_authorization_events_immutable()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  raise exception 'worker_engine_runtime_authorization_evidence_is_append_only';
end $$;
revoke all on function public.hq_workforce_runtime_authorization_events_immutable() from public,anon,authenticated,service_role;

drop trigger if exists trg_hq_workforce_runtime_authorization_events_immutable on public.hq_workforce_runtime_authorization_events;
create trigger trg_hq_workforce_runtime_authorization_events_immutable
before update or delete on public.hq_workforce_runtime_authorization_events
for each row execute function public.hq_workforce_runtime_authorization_events_immutable();
