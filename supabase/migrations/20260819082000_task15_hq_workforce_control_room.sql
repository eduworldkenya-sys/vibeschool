-- VIBESCHOOL TASK 15: HQ Workforce Control Room owner operations.
-- NON-ACTIVATING. Installs owner controls/read models only; no runtime, authority,
-- scheduler, heartbeat, factory or Global Stop state is changed by migration install.
-- access: owner-only public.hq_workforce_owner_control_events
-- authorization-test: public.hq_workforce_owner_control_events denies public/anon/authenticated direct access; service_role is read-only and owner reads use an owner-gated RPC.

create table if not exists public.hq_workforce_owner_control_events (
  id bigint generated always as identity primary key,
  action_key text not null check (action_key in (
    'start_controlled_operations','stop_operations','global_stop_activate','global_stop_release',
    'runtime_policy_change','authority_change','decision_review','breaker_reset'
  )),
  actor_id uuid not null,
  previous_state jsonb not null default '{}'::jsonb check (jsonb_typeof(previous_state)='object'),
  requested_state jsonb not null default '{}'::jsonb check (jsonb_typeof(requested_state)='object'),
  result_state jsonb not null default '{}'::jsonb check (jsonb_typeof(result_state)='object'),
  outcome text not null check (outcome in ('succeeded','rejected','idempotent')),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  created_at timestamptz not null default clock_timestamp()
);

alter table public.hq_workforce_owner_control_events enable row level security;
revoke all on table public.hq_workforce_owner_control_events from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_owner_control_events to service_role;

create or replace function public.hq_workforce_owner_control_snapshot(p_recent_limit integer default 30)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  lim integer:=greatest(1,least(coalesce(p_recent_limit,30),100));
  ec public.hq_workforce_engine_contract%rowtype;
  result jsonb;
begin
  perform public.hq_assert_owner();
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;

  select jsonb_build_object(
    'generated_at',clock_timestamp(),
    'engine',jsonb_build_object(
      'runtime_execution_enabled',ec.runtime_execution_enabled,
      'runtime_autonomy_level',ec.runtime_autonomy_level,
      'runtime_max_risk',ec.runtime_max_risk,
      'runtime_anomaly_paused',ec.runtime_anomaly_paused,
      'runtime_max_concurrency',ec.runtime_max_concurrency,
      'runtime_max_executions_per_minute',ec.runtime_max_executions_per_minute,
      'heartbeat_enabled',ec.heartbeat_enabled,
      'factory_enabled',ec.factory_enabled,
      'shadow_enabled',ec.shadow_enabled,
      'shadow_scheduler_enabled',ec.shadow_scheduler_enabled,
      'shadow_global_stop',ec.shadow_global_stop,
      'shadow_anomaly_paused',ec.shadow_anomaly_paused,
      'updated_at',ec.updated_at
    ),
    'global_policy',(
      select to_jsonb(p) from (
        select id,policy_key,enabled,max_autonomy_level,max_risk_class,max_concurrency,
               max_executions_per_minute,reason,updated_at
        from public.hq_workforce_runtime_policies
        where status='active' and scope_kind='global' and scope_key='global'
        order by updated_at desc limit 1
      ) p
    ),
    'authority',coalesce((
      select jsonb_agg(to_jsonb(g) order by g.expires_at,g.grant_key)
      from (
        select id,grant_key,capability_key,capability_version,permitted_worker_key,operation,resource_type,
               scope_type,scope_ref,autonomy_level,risk_class,max_operations_per_cycle,max_records_per_operation,
               max_concurrency,max_executions_per_minute,status,issued_at,certified_at,activated_at,expires_at,
               revoked_at,lifecycle_reason
        from public.hq_workforce_capability_authority_grants
        where status in ('draft','certified','active','suspended')
        order by case status when 'active' then 1 when 'certified' then 2 when 'draft' then 3 else 4 end,expires_at
        limit lim
      ) g
    ),'[]'::jsonb),
    'breakers',coalesce((
      select jsonb_agg(to_jsonb(b) order by b.created_at desc)
      from (
        select id,scope_type,scope_ref,status,reason_code,tripped_by,tripped_at,reset_by,reset_reason,reset_at,created_at
        from public.hq_workforce_execution_breakers
        order by case status when 'tripped' then 1 else 2 end,created_at desc
        limit lim
      ) b
    ),'[]'::jsonb),
    'executions',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at desc)
      from (
        select id,task_key,worker_key,capability_key,operation,resource_type,scope_type,status,attempt_count,last_error,
               autonomous_authority_grant_id,verification_status,created_at,started_at,completed_at
        from public.hq_workforce_task_contracts
        order by created_at desc limit lim
      ) t
    ),'[]'::jsonb),
    'budgets',coalesce((
      select jsonb_agg(to_jsonb(b) order by b.period_start desc)
      from (
        select id,worker_key,budget_key,unit,limit_amount,reserved_amount,consumed_amount,status,period_start,period_end
        from public.hq_workforce_execution_budgets
        order by period_start desc limit lim
      ) b
    ),'[]'::jsonb),
    'control_events',coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at desc)
      from (
        select id,action_key,actor_id,previous_state,requested_state,result_state,outcome,reason,created_at
        from public.hq_workforce_owner_control_events
        order by created_at desc limit lim
      ) a
    ),'[]'::jsonb),
    'counts',jsonb_build_object(
      'active_authority',(select count(*) from public.hq_workforce_capability_authority_grants
        where status='active' and coalesce(activated_at,issued_at)<=clock_timestamp() and expires_at>clock_timestamp()),
      'expiring_authority',(select count(*) from public.hq_workforce_capability_authority_grants
        where status='active' and expires_at>clock_timestamp() and expires_at<=clock_timestamp()+interval '60 minutes'),
      'tripped_breakers',(select count(*) from public.hq_workforce_execution_breakers where status='tripped'),
      'queued_jobs',(select count(*) from public.hq_workforce_task_contracts where status='queued'),
      'running_jobs',(select count(*) from public.hq_workforce_task_contracts where status='running'),
      'completed_jobs',(select count(*) from public.hq_workforce_task_contracts where status='completed'),
      'failed_jobs',(select count(*) from public.hq_workforce_task_contracts where status in ('failed','dead_letter')),
      'open_decisions',(select count(*) from public.hq_workforce_shadow_decisions where state in ('proposed','awaiting_review','revise')),
      'active_workers',(select count(*) from public.hq_workforce_workers where status='active')
    )
  ) into result;
  return result;
end $$;

create or replace function public.hq_workforce_owner_start_controlled_operations(
  p_expected_updated_at timestamptz,
  p_autonomy_level smallint,
  p_max_risk smallint,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_uid uuid;
  v_result jsonb;
  v_previous jsonb;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'control_room_owner_required'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'control_room_reason_required'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  v_previous:=jsonb_build_object(
    'runtime_execution_enabled',ec.runtime_execution_enabled,
    'runtime_autonomy_level',ec.runtime_autonomy_level,
    'runtime_max_risk',ec.runtime_max_risk,
    'updated_at',ec.updated_at
  );

  if ec.runtime_execution_enabled and ec.runtime_autonomy_level=p_autonomy_level and ec.runtime_max_risk=p_max_risk then
    insert into public.hq_workforce_owner_control_events(
      action_key,actor_id,previous_state,requested_state,result_state,outcome,reason
    ) values(
      'start_controlled_operations',v_uid,v_previous,
      jsonb_build_object('runtime_execution_enabled',true,'runtime_autonomy_level',p_autonomy_level,'runtime_max_risk',p_max_risk),
      v_previous,'idempotent',btrim(p_reason)
    );
    return v_previous||jsonb_build_object('idempotent',true);
  end if;
  if p_expected_updated_at is null or ec.updated_at is distinct from p_expected_updated_at then
    raise exception 'control_room_stale_runtime_state';
  end if;
  if ec.shadow_global_stop then raise exception 'control_room_global_stop_active'; end if;

  v_result:=public.hq_workforce_owner_set_runtime(true,p_autonomy_level,p_max_risk,p_reason);
  insert into public.hq_workforce_owner_control_events(
    action_key,actor_id,previous_state,requested_state,result_state,outcome,reason
  ) values(
    'start_controlled_operations',v_uid,v_previous,
    jsonb_build_object('runtime_execution_enabled',true,'runtime_autonomy_level',p_autonomy_level,'runtime_max_risk',p_max_risk),
    v_result,'succeeded',btrim(p_reason)
  );
  return v_result;
end $$;

create or replace function public.hq_workforce_owner_stop_operations(
  p_expected_updated_at timestamptz,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_uid uuid;
  v_result jsonb;
  v_previous jsonb;
  g record;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'control_room_owner_required'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'control_room_reason_required'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  v_previous:=jsonb_build_object(
    'runtime_execution_enabled',ec.runtime_execution_enabled,
    'runtime_autonomy_level',ec.runtime_autonomy_level,
    'runtime_max_risk',ec.runtime_max_risk,
    'updated_at',ec.updated_at
  );

  if not ec.runtime_execution_enabled and ec.runtime_autonomy_level=0 and ec.runtime_max_risk=0 then
    insert into public.hq_workforce_owner_control_events(
      action_key,actor_id,previous_state,requested_state,result_state,outcome,reason
    ) values(
      'stop_operations',v_uid,v_previous,
      jsonb_build_object('runtime_execution_enabled',false,'runtime_autonomy_level',0,'runtime_max_risk',0),
      v_previous,'idempotent',btrim(p_reason)
    );
    return v_previous||jsonb_build_object('idempotent',true);
  end if;
  if p_expected_updated_at is null or ec.updated_at is distinct from p_expected_updated_at then
    raise exception 'control_room_stale_runtime_state';
  end if;

  v_result:=public.hq_workforce_owner_set_runtime(false,0,0,p_reason);
  for g in
    select id from public.hq_workforce_capability_authority_grants where status='active' order by id for update
  loop
    perform public.hq_workforce_owner_transition_capability_authority(
      g.id,'suspend',p_reason,
      jsonb_build_array(jsonb_build_object('source','hq_control_room','action','stop_operations'))
    );
  end loop;
  insert into public.hq_workforce_owner_control_events(
    action_key,actor_id,previous_state,requested_state,result_state,outcome,reason
  ) values(
    'stop_operations',v_uid,v_previous,
    jsonb_build_object('runtime_execution_enabled',false,'runtime_autonomy_level',0,'runtime_max_risk',0),
    v_result,'succeeded',btrim(p_reason)
  );
  return v_result;
end $$;

create or replace function public.hq_workforce_owner_set_global_stop(
  p_active boolean,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_uid uuid;
  v_breaker uuid;
  v_previous jsonb;
  g record;
  b record;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'control_room_owner_required'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'control_room_reason_required'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  v_previous:=jsonb_build_object(
    'shadow_global_stop',ec.shadow_global_stop,
    'runtime_execution_enabled',ec.runtime_execution_enabled,
    'runtime_autonomy_level',ec.runtime_autonomy_level,
    'runtime_max_risk',ec.runtime_max_risk
  );

  if coalesce(p_active,false) then
    update public.hq_workforce_engine_contract
       set runtime_execution_enabled=false,runtime_autonomy_level=0,runtime_max_risk=0,
           heartbeat_enabled=false,factory_enabled=false,shadow_enabled=false,
           shadow_scheduler_enabled=false,shadow_global_stop=true,updated_at=clock_timestamp()
     where singleton=true;
    v_breaker:=public.hq_workforce_trip_execution_breaker(
      'global','global','owner_global_stop','hq-owner:'||v_uid::text,
      jsonb_build_object('reason',btrim(p_reason))
    );
    for g in
      select id from public.hq_workforce_capability_authority_grants where status='active' order by id for update
    loop
      perform public.hq_workforce_owner_transition_capability_authority(
        g.id,'suspend',p_reason,
        jsonb_build_array(jsonb_build_object('source','hq_control_room','action','global_stop'))
      );
    end loop;
    insert into public.hq_workforce_owner_control_events(
      action_key,actor_id,previous_state,requested_state,result_state,outcome,reason
    ) values(
      'global_stop_activate',v_uid,v_previous,jsonb_build_object('global_stop',true),
      jsonb_build_object('global_stop',true,'runtime_execution_enabled',false,'breaker_id',v_breaker),
      'succeeded',btrim(p_reason)
    );
    return jsonb_build_object('global_stop',true,'runtime_execution_enabled',false,'breaker_id',v_breaker);
  end if;

  -- Releasing the emergency prohibition never restarts runtime or reactivates authority.
  update public.hq_workforce_engine_contract
     set shadow_global_stop=false,runtime_execution_enabled=false,runtime_autonomy_level=0,
         runtime_max_risk=0,heartbeat_enabled=false,factory_enabled=false,updated_at=clock_timestamp()
   where singleton=true;
  for b in
    select id from public.hq_workforce_execution_breakers
    where scope_type='global' and scope_ref='global' and status='tripped'
    order by created_at for update
  loop
    perform public.hq_workforce_reset_execution_breaker(
      b.id,'hq-owner:'||v_uid::text,p_reason,
      jsonb_build_object('source','hq_control_room','authority_effect','none')
    );
  end loop;
  insert into public.hq_workforce_owner_control_events(
    action_key,actor_id,previous_state,requested_state,result_state,outcome,reason
  ) values(
    'global_stop_release',v_uid,v_previous,jsonb_build_object('global_stop',false),
    jsonb_build_object('global_stop',false,'runtime_execution_enabled',false,'authority_reactivated',false),
    'succeeded',btrim(p_reason)
  );
  return jsonb_build_object('global_stop',false,'runtime_execution_enabled',false,'authority_reactivated',false);
end $$;

revoke all on function public.hq_workforce_owner_control_snapshot(integer) from public,anon;
revoke all on function public.hq_workforce_owner_start_controlled_operations(timestamptz,smallint,smallint,text) from public,anon,service_role;
revoke all on function public.hq_workforce_owner_stop_operations(timestamptz,text) from public,anon,service_role;
revoke all on function public.hq_workforce_owner_set_global_stop(boolean,text) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_control_snapshot(integer) to authenticated;
grant execute on function public.hq_workforce_owner_start_controlled_operations(timestamptz,smallint,smallint,text) to authenticated;
grant execute on function public.hq_workforce_owner_stop_operations(timestamptz,text) to authenticated;
grant execute on function public.hq_workforce_owner_set_global_stop(boolean,text) to authenticated;

-- Installation invariant: Task 15 must never be the thing that activates production.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'task15_requires_engine_contract'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'task15_migration_must_not_activate_runtime';
  end if;
end $$;