-- Owner emergency stop: one-way safety mutation only. This migration does not invoke it.
-- access: owner-only public.hq_workforce_owner_control_events
-- authorization-test: public.hq_workforce_owner_control_events
-- Direct table access is intentionally denied to browser roles and service_role.
-- The SECURITY DEFINER emergency-stop RPC is the only application write path and
-- performs server-side hq_assert_owner() before mutating runtime state or audit evidence.
create table if not exists public.hq_workforce_owner_control_events(
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  action text not null check(action in ('emergency_stop')),
  actor_id uuid not null,
  reason text not null,
  previous_state jsonb not null,
  resulting_state jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.hq_workforce_owner_control_events enable row level security;
alter table public.hq_workforce_owner_control_events force row level security;
revoke all on table public.hq_workforce_owner_control_events from public,anon,authenticated,service_role;

create or replace function public.hq_workforce_owner_emergency_stop(p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid;
  ec public.hq_workforce_engine_contract%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_event_key text;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'emergency_stop_requires_authenticated_owner'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<5 then raise exception 'emergency_stop_reason_required'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  v_before:=jsonb_build_object(
    'runtime_execution_enabled',ec.runtime_execution_enabled,
    'runtime_autonomy_level',ec.runtime_autonomy_level,
    'runtime_max_risk',ec.runtime_max_risk,
    'heartbeat_enabled',ec.heartbeat_enabled,
    'factory_enabled',ec.factory_enabled,
    'shadow_enabled',ec.shadow_enabled,
    'shadow_scheduler_enabled',ec.shadow_scheduler_enabled,
    'shadow_global_stop',ec.shadow_global_stop
  );

  update public.hq_workforce_engine_contract set
    runtime_execution_enabled=false,
    runtime_autonomy_level=0,
    runtime_max_risk=0,
    heartbeat_enabled=false,
    factory_enabled=false,
    shadow_enabled=false,
    shadow_scheduler_enabled=false,
    shadow_global_stop=true,
    updated_at=clock_timestamp()
  where singleton=true;

  v_after:=jsonb_build_object(
    'runtime_execution_enabled',false,'runtime_autonomy_level',0,'runtime_max_risk',0,
    'heartbeat_enabled',false,'factory_enabled',false,'shadow_enabled',false,
    'shadow_scheduler_enabled',false,'shadow_global_stop',true
  );
  v_event_key:='emergency-stop:'||gen_random_uuid()::text;
  insert into public.hq_workforce_owner_control_events(event_key,action,actor_id,reason,previous_state,resulting_state)
  values(v_event_key,'emergency_stop',v_uid,btrim(p_reason),v_before,v_after);

  return jsonb_build_object('event_key',v_event_key,'action','emergency_stop','previous_state',v_before,'resulting_state',v_after,'stopped',true);
end $$;

revoke all on function public.hq_workforce_owner_emergency_stop(text) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_emergency_stop(text) to authenticated;
comment on function public.hq_workforce_owner_emergency_stop(text) is 'Owner-only auditable one-way emergency stop. Can only disable runtime/shadow/factory/heartbeat and establish Global Stop.';

-- Executable reconstruction guard backing the authorization-test declaration.
-- Fail the migration if any direct client/service privilege is accidentally introduced.
do $$
begin
  if has_table_privilege('anon','public.hq_workforce_owner_control_events','SELECT')
     or has_table_privilege('anon','public.hq_workforce_owner_control_events','INSERT')
     or has_table_privilege('anon','public.hq_workforce_owner_control_events','UPDATE')
     or has_table_privilege('anon','public.hq_workforce_owner_control_events','DELETE')
     or has_table_privilege('authenticated','public.hq_workforce_owner_control_events','SELECT')
     or has_table_privilege('authenticated','public.hq_workforce_owner_control_events','INSERT')
     or has_table_privilege('authenticated','public.hq_workforce_owner_control_events','UPDATE')
     or has_table_privilege('authenticated','public.hq_workforce_owner_control_events','DELETE')
     or has_table_privilege('service_role','public.hq_workforce_owner_control_events','SELECT')
     or has_table_privilege('service_role','public.hq_workforce_owner_control_events','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_owner_control_events','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_owner_control_events','DELETE') then
    raise exception 'hq_workforce_owner_control_events direct access contract violated';
  end if;
  if has_function_privilege('anon','public.hq_workforce_owner_emergency_stop(text)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_owner_emergency_stop(text)','EXECUTE')
     or not has_function_privilege('authenticated','public.hq_workforce_owner_emergency_stop(text)','EXECUTE') then
    raise exception 'hq_workforce_owner_emergency_stop execute contract violated';
  end if;
end $$;
