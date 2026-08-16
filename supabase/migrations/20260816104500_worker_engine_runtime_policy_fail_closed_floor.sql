-- Worker Engine runtime-policy fail-closed floor.
--
-- Root invariant: absence of policy is never permission. A consequential runtime
-- may be enabled only when at least one active global policy explicitly allows it
-- and the engine contract remains within that policy's ceilings.

insert into public.hq_workforce_runtime_policies(
  policy_key,
  scope_kind,
  scope_key,
  enabled,
  max_autonomy_level,
  max_risk_class,
  max_concurrency,
  max_executions_per_minute,
  reason,
  status
)
select
  'worker-runtime-global-fail-closed-v1',
  'global',
  'global',
  false,
  0,
  0,
  1,
  1,
  'Default fail-closed policy. Production runtime activation requires an explicit governed policy replacement or update.',
  'active'
where not exists (
  select 1
  from public.hq_workforce_runtime_policies
  where scope_kind='global'
    and scope_key='global'
    and status='active'
);

create or replace function public.hq_workforce_guard_engine_contract_activation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_global_count integer;
  v_any_disabled boolean;
  v_max_autonomy integer;
  v_max_risk integer;
  v_max_concurrency integer;
  v_max_rate integer;
begin
  if new.runtime_execution_enabled then
    select
      count(*),
      bool_or(not enabled),
      min(max_autonomy_level),
      min(max_risk_class),
      min(max_concurrency),
      min(max_executions_per_minute)
    into
      v_global_count,
      v_any_disabled,
      v_max_autonomy,
      v_max_risk,
      v_max_concurrency,
      v_max_rate
    from public.hq_workforce_runtime_policies
    where scope_kind='global'
      and scope_key='global'
      and status='active';

    if coalesce(v_global_count,0)=0 then
      raise exception 'worker_runtime_global_policy_missing';
    end if;
    if coalesce(v_any_disabled,true) then
      raise exception 'worker_runtime_global_policy_disabled';
    end if;
    if new.runtime_autonomy_level > v_max_autonomy then
      raise exception 'worker_runtime_engine_autonomy_exceeds_global_policy';
    end if;
    if new.runtime_max_risk > v_max_risk then
      raise exception 'worker_runtime_engine_risk_exceeds_global_policy';
    end if;
    if new.runtime_max_concurrency > v_max_concurrency then
      raise exception 'worker_runtime_engine_concurrency_exceeds_global_policy';
    end if;
    if new.runtime_max_executions_per_minute > v_max_rate then
      raise exception 'worker_runtime_engine_rate_exceeds_global_policy';
    end if;
  end if;

  if new.heartbeat_enabled and not new.runtime_execution_enabled then
    raise exception 'worker_heartbeat_requires_runtime_enabled';
  end if;
  if new.factory_enabled and not new.heartbeat_enabled then
    raise exception 'worker_factory_requires_heartbeat_enabled';
  end if;

  return new;
end
$$;

revoke all on function public.hq_workforce_guard_engine_contract_activation() from public, anon, authenticated, service_role;

create trigger trg_hq_workforce_guard_engine_contract_activation
before insert or update on public.hq_workforce_engine_contract
for each row
execute function public.hq_workforce_guard_engine_contract_activation();

create or replace function public.hq_workforce_guard_runtime_policy_floor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_other_active_global integer;
begin
  if tg_op in ('UPDATE','DELETE')
     and old.scope_kind='global'
     and old.scope_key='global'
     and old.status='active'
     and (
       tg_op='DELETE'
       or new.scope_kind is distinct from 'global'
       or new.scope_key is distinct from 'global'
       or new.status is distinct from 'active'
     ) then
    select count(*) into v_other_active_global
    from public.hq_workforce_runtime_policies
    where id<>old.id
      and scope_kind='global'
      and scope_key='global'
      and status='active';

    if v_other_active_global=0 then
      raise exception 'worker_runtime_global_policy_floor_required';
    end if;
  end if;

  return case when tg_op='DELETE' then old else new end;
end
$$;

revoke all on function public.hq_workforce_guard_runtime_policy_floor() from public, anon, authenticated, service_role;

create trigger trg_hq_workforce_guard_runtime_policy_floor
before update or delete on public.hq_workforce_runtime_policies
for each row
execute function public.hq_workforce_guard_runtime_policy_floor();

comment on function public.hq_workforce_guard_engine_contract_activation() is
  'Fails closed unless an active enabled global runtime policy exists and the engine contract stays within its ceilings.';
comment on function public.hq_workforce_guard_runtime_policy_floor() is
  'Prevents removal of the final active global runtime policy so absence of policy cannot become implicit permission.';
