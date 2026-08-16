-- WE-R1.4.17: owner-governed runtime control plane.
-- NON-ACTIVATING. service_role is transport, never authority to enable runtime or write
-- execution policy. Runtime ON requires authenticated platform-owner identity, an
-- explicit enabled global policy, bounded autonomy/risk and at least one active R1.4
-- capability-authority grant. Runtime OFF remains always available to the owner.

-- Direct configuration writes are no longer a service transport capability.
revoke insert,update,delete,truncate on table public.hq_workforce_engine_contract from service_role;
revoke insert,update,delete,truncate on table public.hq_workforce_runtime_policies from service_role;
grant select on table public.hq_workforce_engine_contract to service_role;
grant select on table public.hq_workforce_runtime_policies to service_role;

create or replace function public.hq_workforce_owner_put_runtime_policy(
  p_policy_key text,
  p_scope_kind text,
  p_scope_key text,
  p_enabled boolean,
  p_max_autonomy_level smallint,
  p_max_risk_class smallint,
  p_max_concurrency integer,
  p_max_executions_per_minute integer,
  p_reason text,
  p_jurisdiction_key text default null,
  p_tenant_key text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_id uuid; v_uid uuid;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'runtime_policy_requires_authenticated_owner'; end if;
  if char_length(btrim(coalesce(p_policy_key,'')))<3 then raise exception 'runtime_policy_key_invalid'; end if;
  if p_scope_kind not in ('global','jurisdiction','tenant','lane','worker','skill') then raise exception 'runtime_policy_scope_invalid'; end if;
  if char_length(btrim(coalesce(p_scope_key,'')))<1 then raise exception 'runtime_policy_scope_key_invalid'; end if;
  if p_scope_kind='global' and btrim(p_scope_key)<>'global' then raise exception 'global_runtime_policy_scope_key_must_be_global'; end if;
  if p_max_autonomy_level not between 0 and 4 then raise exception 'runtime_policy_autonomy_invalid'; end if;
  if p_max_risk_class not between 0 and 5 then raise exception 'runtime_policy_risk_invalid'; end if;
  if p_max_concurrency not between 1 and 1000 then raise exception 'runtime_policy_concurrency_invalid'; end if;
  if p_max_executions_per_minute not between 1 and 100000 then raise exception 'runtime_policy_rate_invalid'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'runtime_policy_reason_required'; end if;

  insert into public.hq_workforce_runtime_policies(
    policy_key,scope_kind,scope_key,enabled,max_autonomy_level,max_risk_class,
    max_concurrency,max_executions_per_minute,jurisdiction_key,tenant_key,reason,status,updated_at
  ) values(
    btrim(p_policy_key),p_scope_kind,btrim(p_scope_key),coalesce(p_enabled,false),
    p_max_autonomy_level,p_max_risk_class,p_max_concurrency,p_max_executions_per_minute,
    p_jurisdiction_key,p_tenant_key,btrim(p_reason)||' [owner:'||v_uid::text||']','active',clock_timestamp()
  )
  on conflict(policy_key) do update set
    scope_kind=excluded.scope_kind,scope_key=excluded.scope_key,enabled=excluded.enabled,
    max_autonomy_level=excluded.max_autonomy_level,max_risk_class=excluded.max_risk_class,
    max_concurrency=excluded.max_concurrency,max_executions_per_minute=excluded.max_executions_per_minute,
    jurisdiction_key=excluded.jurisdiction_key,tenant_key=excluded.tenant_key,
    reason=excluded.reason,status='active',updated_at=clock_timestamp()
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.hq_workforce_owner_set_runtime(
  p_enabled boolean,
  p_autonomy_level smallint,
  p_max_risk smallint,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid;
  gp public.hq_workforce_runtime_policies%rowtype;
  v_authority integer;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'runtime_change_requires_authenticated_owner'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'runtime_change_reason_required'; end if;

  if not coalesce(p_enabled,false) then
    update public.hq_workforce_engine_contract
       set runtime_execution_enabled=false,runtime_autonomy_level=0,runtime_max_risk=0,
           heartbeat_enabled=false,factory_enabled=false,updated_at=clock_timestamp()
     where singleton=true;
    return jsonb_build_object('runtime_execution_enabled',false,'runtime_autonomy_level',0,'runtime_max_risk',0,'changed_by',v_uid,'reason',btrim(p_reason));
  end if;

  if p_autonomy_level not between 1 and 4 then raise exception 'runtime_activation_autonomy_invalid'; end if;
  if p_max_risk not between 0 and 5 then raise exception 'runtime_activation_risk_invalid'; end if;
  if exists(select 1 from public.hq_workforce_execution_breakers where scope_type='global' and scope_ref='global' and status='tripped') then
    raise exception 'runtime_activation_global_breaker_tripped';
  end if;
  select * into gp from public.hq_workforce_runtime_policies
   where status='active' and scope_kind='global' and scope_key='global' and enabled
   order by updated_at desc limit 1;
  if not found then raise exception 'runtime_activation_enabled_global_policy_required'; end if;
  if p_autonomy_level>gp.max_autonomy_level or p_max_risk>gp.max_risk_class then
    raise exception 'runtime_activation_exceeds_global_policy';
  end if;
  if exists(select 1 from public.hq_workforce_engine_contract where singleton=true and (shadow_enabled or shadow_scheduler_enabled or not shadow_global_stop)) then
    raise exception 'runtime_activation_requires_shadow_stopped';
  end if;
  select count(*) into v_authority from public.hq_workforce_capability_authority_grants
   where status='active' and effective_from<=clock_timestamp() and expires_at>clock_timestamp();
  if v_authority<1 then raise exception 'runtime_activation_active_capability_authority_required'; end if;

  update public.hq_workforce_engine_contract
     set runtime_execution_enabled=true,runtime_autonomy_level=p_autonomy_level,runtime_max_risk=p_max_risk,
         heartbeat_enabled=false,factory_enabled=false,updated_at=clock_timestamp()
   where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;

  return jsonb_build_object('runtime_execution_enabled',true,'runtime_autonomy_level',p_autonomy_level,
    'runtime_max_risk',p_max_risk,'heartbeat_enabled',false,'factory_enabled',false,'changed_by',v_uid,'reason',btrim(p_reason));
end $$;

-- Runtime policy assertion now fails closed when there is no explicit enabled global
-- policy. The full inherited R1.2 intersection remains unchanged behind this gate.
alter function public.hq_workforce_assert_runtime_task_authorized(uuid)
  rename to hq_workforce_assert_runtime_task_authorized_r12_internal;

create or replace function public.hq_workforce_assert_runtime_task_authorized(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if not exists(
    select 1 from public.hq_workforce_runtime_policies
     where status='active' and scope_kind='global' and scope_key='global' and enabled
  ) then raise exception 'worker_runtime_explicit_global_policy_required'; end if;
  return public.hq_workforce_assert_runtime_task_authorized_r12_internal(p_task_id);
end $$;

revoke all on function public.hq_workforce_owner_put_runtime_policy(text,text,text,boolean,smallint,smallint,integer,integer,text,text,text)
  from public,anon,service_role;
grant execute on function public.hq_workforce_owner_put_runtime_policy(text,text,text,boolean,smallint,smallint,integer,integer,text,text,text)
  to authenticated;
revoke all on function public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)
  from public,anon,service_role;
grant execute on function public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text)
  to authenticated;
revoke all on function public.hq_workforce_assert_runtime_task_authorized_r12_internal(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_assert_runtime_task_authorized(uuid)
  from public,anon,authenticated,service_role;

-- Installation itself is strictly non-activating.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.17 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.17 violated fail_closed_activation_boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.17 cannot install with active capability authority'; end if;
  if has_table_privilege('service_role','public.hq_workforce_engine_contract','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_runtime_policies','UPDATE') then
    raise exception 'WE-R1.4.17 direct runtime control write remains';
  end if;
end $$;
