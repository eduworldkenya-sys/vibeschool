-- Worker Engine production-readiness hardening: explicit activation prerequisites.
-- NON-ACTIVATING. This trigger can only prevent unsafe activation; it never enables runtime.

create or replace function public.hq_workforce_guard_runtime_activation()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_global_policy integer;
begin
  if new.runtime_execution_enabled and not old.runtime_execution_enabled then
    if coalesce(new.runtime_anomaly_paused,false) then raise exception 'runtime_activation_blocked_by_anomaly_stop'; end if;
    if coalesce(new.shadow_global_stop,true) then raise exception 'runtime_activation_requires_explicit_shadow_stop_clearance'; end if;
    select count(*) into v_global_policy
      from public.hq_workforce_runtime_policies
     where status='active' and enabled and scope_kind='global' and scope_key='global';
    if v_global_policy<>1 then raise exception 'runtime_activation_requires_exactly_one_active_global_policy'; end if;
    if not exists(
      select 1 from public.hq_workforce_capability_authority_grants
       where status='active' and not_before<=clock_timestamp() and expires_at>clock_timestamp()
    ) then raise exception 'runtime_activation_requires_explicit_capability_authority'; end if;
  end if;
  return new;
end $$;

revoke all on function public.hq_workforce_guard_runtime_activation() from public,anon,authenticated,service_role;

drop trigger if exists trg_hq_workforce_guard_runtime_activation on public.hq_workforce_engine_contract;
create trigger trg_hq_workforce_guard_runtime_activation
before update of runtime_execution_enabled on public.hq_workforce_engine_contract
for each row execute function public.hq_workforce_guard_runtime_activation();

-- Current state must remain OFF.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'activation guard requires engine contract'; end if;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) then
    raise exception 'activation guard migration requires fail-closed baseline';
  end if;
end $$;
